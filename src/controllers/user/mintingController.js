const MintingActivity = require("../../models/MintingActivity");
const Investment = require("../../models/Investment");
const Package = require("../../models/pakages");
const mongoose = require("mongoose");
const User = require("../../models/auth");
const Transaction = require("../../models/Transaction");
const checkAuthorization = require("../../middlewares/authMiddleware");
const MintingCommission = require("../../models/MintingCommission");
const BinaryPlacement = require("../../models/BinarySchema");
const LevelBonus = require("../../models/levelBonus");
const {
  mintingAndBoosterCommission,
  getDirectReferralBusinessHubCapacity,
  hasGreenID,
  getTotalReceivedByMinting,
  getDaysPassedByMinting,
  getMonthsPassedByMinting,
  calculatePhase,
  userdata,
  settingsdata,
  getMintingInsights,
} = require("../../helpers/functions");

const settings = require("../../models/settings");

exports.startMinting = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { investmentId, mintingType, investedAmount } = req.body;

  if (!mongoose.Types.ObjectId.isValid(investmentId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid investment ID." });
  }

  if (!["AUTO", "MANUAL"].includes(mintingType)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid minting type." });
  }

  const investedAmt = parseFloat(investedAmount);
  if (!investedAmt || investedAmt <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid invested amount." });
  }

  try {
    const userObjectId = new mongoose.Types.ObjectId(authUser);

    const investment = await Investment.findOne({
      _id: investmentId,
      userId: userObjectId,
    });

    if (!investment) {
      return res
        .status(404)
        .json({ success: false, message: "Investment not found." });
    }

    const { amount: totalPackageAmount, hubPackage } = investment;
    const { packageId } = hubPackage;

    const packageDetails = await Package.findById(packageId);
    if (!packageDetails) {
      return res
        .status(404)
        .json({ success: false, message: "Linked package not found." });
    }

    const minRequired = packageDetails.minimumMintingRequired === true;
    const minAmount = parseFloat(packageDetails.minimumMinting || "0");

    const totalInvestedResult = await MintingActivity.aggregate([
      { $match: { investmentId: new mongoose.Types.ObjectId(investmentId) } },
      { $group: { _id: null, total: { $sum: "$investedAmount" } } },
    ]);

    const currentTotalInvested =
      totalInvestedResult.length > 0 ? totalInvestedResult[0].total : 0;
    const remainingAmount = totalPackageAmount - currentTotalInvested;

    if (investedAmt > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Invested amount exceeds remaining package allowance. Remaining: $${remainingAmount.toFixed(
          2
        )}.`,
      });
    }

    if (parseFloat(investedAmt) < minAmount && minRequired) {
      return res.status(400).json({
        success: false,
        message: `Minimum investment amount is $${minAmount}. Please invest at least the minimum amount.`,
      });
    }

    // Always create a new minting activity (removed re-investment logic)
    const newMinting = new MintingActivity({
      investmentId,
      userId: userObjectId,
      mintingType,
      clicksDone: 0,
      investedAmount: investedAmt,
      isActive: true,
      startDate: new Date(),
      profitPerClick: 0,
    });

    await newMinting.save();

    // Check if there are existing minting activities of the same type for informational purposes
    const existingCount = await MintingActivity.countDocuments({
      investmentId,
      mintingType: mintingType,
      isActive: true,
    });

    const message =
      existingCount > 1
        ? `New ${mintingType} minting activity created successfully with $${investedAmt}. You now have ${existingCount} active ${mintingType} minting activities.`
        : `New ${mintingType} minting started successfully with $${investedAmt}`;

    return res.status(201).json({
      success: true,
      message: message,
      data: newMinting,
      isReInvestment: false,
      activeMintingCount: existingCount,
    });
  } catch (err) {
    console.error("Error starting minting:", err);
    return res.status(500).json({
      success: false,
      message: "Server error occurred while processing minting request.",
    });
  }
};

exports.recordSelfClick = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const userId = await checkAuthorization(req, res);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { mintingActivityId } = req.body;

    // Validate input
    if (!mintingActivityId) {
      return res.status(400).json({
        success: false,
        message: "Minting activity ID is required",
      });
    }

    // Find the minting activity
    const mintingActivity = await MintingActivity.findById(
      mintingActivityId
    ).session(session);

    if (!mintingActivity) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Minting activity not found",
      });
    }

    // Check if the activity belongs to the user
    if (mintingActivity.userId.toString() !== userId) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Unauthorized: This minting activity doesn't belong to you",
      });
    }

    // Check if activity is still active
    if (!mintingActivity.isActive) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Minting activity is not active",
      });
    }

    // Check if end date has passed (if set)
    if (mintingActivity.endDate && new Date() > mintingActivity.endDate) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Minting activity has expired",
      });
    }

    // Find the user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate profit for this click
    const profitPerClick = mintingActivity.profitPerClick;
    const currentClickNumber = mintingActivity.clicksDone + 1;

    // Create click record
    const clickRecord = {
      clickTime: new Date(),
      profitEarned: profitPerClick,
      clickNumber: currentClickNumber,
    };

    // Update minting activity
    mintingActivity.clicksDone += 1;
    mintingActivity.totalProfitEarned += profitPerClick;
    mintingActivity.clickHistory.push(clickRecord);

    // Update user's crypto wallet
    user.cryptoWallet += profitPerClick;

    // Save both documents
    await mintingActivity.save({ session });
    await user.save({ session });

    // Commit transaction
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Click recorded successfully",
      data: {
        clickNumber: currentClickNumber,
        profitEarned: profitPerClick,
        totalClicksDone: mintingActivity.clicksDone,
        totalProfitEarned: mintingActivity.totalProfitEarned,
        newCryptoWalletBalance: user.cryptoWallet,
        clickTime: clickRecord.clickTime,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error recording click:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get click history for a minting activity
exports.getClickHistory = async (req, res) => {
  try {
    const { mintingActivityId } = req.params;
    const userId = req.user.id;

    const mintingActivity = await MintingActivity.findById(mintingActivityId);

    if (!mintingActivity) {
      return res.status(404).json({
        success: false,
        message: "Minting activity not found",
      });
    }

    // Check if the activity belongs to the user
    if (mintingActivity.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: This minting activity doesn't belong to you",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        mintingActivityId: mintingActivity._id,
        totalClicks: mintingActivity.clicksDone,
        totalProfitEarned: mintingActivity.totalProfitEarned,
        profitPerClick: mintingActivity.profitPerClick,
        clickHistory: mintingActivity.clickHistory,
        isActive: mintingActivity.isActive,
      },
    });
  } catch (error) {
    console.error("Error getting click history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's total earnings from all minting activities
exports.getUserTotalEarnings = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalEarnings = await MintingActivity.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$totalProfitEarned" },
          totalClicks: { $sum: "$clicksDone" },
          totalActivities: { $sum: 1 },
        },
      },
    ]);

    const user = await User.findById(userId).select("cryptoWallet");

    res.status(200).json({
      success: true,
      data: {
        totalEarningsFromMinting:
          totalEarnings.length > 0 ? totalEarnings[0].totalEarnings : 0,
        totalClicksAcrossAllActivities:
          totalEarnings.length > 0 ? totalEarnings[0].totalClicks : 0,
        totalMintingActivities:
          totalEarnings.length > 0 ? totalEarnings[0].totalActivities : 0,
        currentCryptoWalletBalance: user ? user.cryptoWallet : 0,
      },
    });
  } catch (error) {
    console.error("Error getting user total earnings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getMintingActivity = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { type } = req.body; // e.g. "AUTO" or "MANUAL"

  try {
    const userObjectId = new mongoose.Types.ObjectId(authUser);

    // Step 1: Get all investment IDs for this user
    const userInvestments = await Investment.find({
      userId: userObjectId,
    }).select("_id");
    const investmentIds = userInvestments.map((inv) => inv._id);

    // Step 2: Find matching minting activities
    const query = {
      investmentId: { $in: investmentIds },
      // isActive: true,
    };

    if (type) {
      query.mintingType = type; // optional filter
    }

    let mintingActivities = await MintingActivity.find(query)
      .populate("investmentId", "amount hubPackage")
      .sort({ startDate: -1 });

    let manualClickStatus = false;
    if (type === "MANUAL") {
      if (mintingActivities.length > 0) {
        const minting = mintingActivities[mintingActivities.length - 1];
        const startDate = new Date(minting.startDate);
        const now = new Date();

        const msInDay = 24 * 60 * 60 * 1000;

        // ✅ 1. Calculate full days passed since start
        const daysSinceStart = Math.floor((now - startDate) / msInDay);

        // ✅ 2. How many 24-hour cycles have passed
        const cyclesPassed = daysSinceStart; // because 1 cycle = 1 day

        // ✅ 3. Only continue if there's at least 1 day passed
        if (cyclesPassed >= 1) {
          const clickHistory = minting.clickHistory || [];

          let lastClick = null;

          if (clickHistory.length > 0) {
            lastClick = clickHistory[clickHistory.length - 1]; // Latest click
          }

          let clickFoundInAnyCycle = false;

          if (lastClick) {
            const lastClickTime = new Date(lastClick.clickTime);

            // ✅ Loop through each past 24-hour cycle
            for (let i = 0; i < cyclesPassed; i++) {
              const cycleStart = new Date(startDate.getTime() + msInDay * i);
              const cycleEnd = new Date(
                startDate.getTime() + msInDay * (i + 1)
              );

              if (lastClickTime >= cycleStart && lastClickTime <= cycleEnd) {
                clickFoundInAnyCycle = true;
                break;
              }
            }
          }

          // ✅ Reset if lastClick is found in any past 24-hour cycle
          if (clickFoundInAnyCycle) {
            console.log(
              "✅ Last click was found in some 24-hour cycle, resetting clicksDone"
            );
            minting.clicksDone = 0;
            await minting.save();
          }
        }

        let clicksDone = minting.clicksDone;
        let phase = await calculatePhase(minting.startDate);

        if ((clicksDone === 1) & (phase === 1)) {
          manualClickStatus = true;
        }
        if ((clicksDone === 2) & (phase === 2)) {
          manualClickStatus = true;
        }
      }
    }

    // manualClickStatus = false;

    let autoClickStatus = false;
    if (type === "AUTO") {
      if (mintingActivities.length > 0) {
        const minting = mintingActivities[mintingActivities.length - 1];
        const startDate = new Date(minting.startDate);
        const now = new Date();

        const msInDay = 24 * 60 * 60 * 1000;
        const msIn30Days = 30 * msInDay;

        // ✅ 1. Calculate full days passed
        const daysSinceStart = Math.floor((now - startDate) / msInDay);

        // ✅ 2. How many 30-day cycles have passed
        const cyclesPassed = Math.floor(daysSinceStart / 30);

        // ✅ 3. Only continue if there's at least 1 cycle
        if (cyclesPassed >= 1) {
          const clickHistory = minting.clickHistory || [];

          let lastClick = null;

          if (clickHistory.length > 0) {
            lastClick = clickHistory[clickHistory.length - 1]; // Latest click
          }

          let clickFoundInAnyCycle = false;

          if (lastClick) {
            const lastClickTime = new Date(lastClick.clickTime);

            // ✅ Loop through each past cycle
            for (let i = 0; i < cyclesPassed; i++) {
              const cycleStart = new Date(startDate.getTime() + msIn30Days * i);
              const cycleEnd = new Date(
                startDate.getTime() + msIn30Days * (i + 1)
              );

              if (lastClickTime >= cycleStart && lastClickTime <= cycleEnd) {
                clickFoundInAnyCycle = true;
                break;
              }
            }
          }

          // ✅ Reset if lastClick is found in any previous 30-day cycle
          if (clickFoundInAnyCycle) {
            console.log(
              "✅ Last click was found in some cycle, resetting clicksDone"
            );
            minting.clicksDone = 0;
            await minting.save();
          }
        }

        let clicksDone = minting.clicksDone;
        if (clicksDone === 1) {
          autoClickStatus = true;
        }
      }
    }

    const mintingInsights = await getMintingInsights(authUser);

    return res.status(200).json({
      success: true,
      data: mintingActivities,
      manualClickStatus: manualClickStatus,
      autoClickStatus: autoClickStatus,
      mintingInsights,
    });
  } catch (err) {
    console.error("Error fetching minting activities:", err);
    return res.status(500).json({
      success: false,
      message: "Server error occurred while fetching minting activities.",
    });
  }
};

// Record click for both self and auto minting
exports.recordClick = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const userId = await checkAuthorization(req, res);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    let { mintingType } = req.body; // Changed from mintingActivityId to mintingType

    const currentUser = await User.findOne({ _id: userId }).session(session);

    const mintingCapData = await settingsdata("Minting Cap");
    let mintingCapPercentge = mintingCapData.value;

    // Validate input
    if (!mintingType || !["MANUAL", "AUTO"].includes(mintingType)) {
      return res.status(400).json({
        success: false,
        message: "Valid minting type (MANUAL or AUTO) is required",
      });
    }

    if (mintingType === "MANUAL") {
      const mintingAndBoosterCommissionData = await mintingAndBoosterCommission(
        "selfMinting"
      );
      const hubs = await Investment.find({
        userId,
      });
      for (const hub of hubs) {
        const mintings = await MintingActivity.find({
          userId,
          investmentId: hub._id,
          mintingType,
          // isActive: true
        });

        for (const [index, minting] of mintings.entries()) {
          // let phase = 0;

          // if (index === 0) {
          //   phase = await calculatePhase(minting.startDate)
          //   console.log('yes2')

          //   if (minting.clicksDone === 1 & phase === 1) {
          //     return {
          //       success: false,
          //       message: `Minting already has 1 click. No further processing.`,
          //     };
          //   }

          //   if (minting.clicksDone === 2 & phase === 2) {
          //     return {
          //       success: false,
          //       message: `Minting already has 2 clicks. No further processing.`,
          //     };
          //   }
          // }

          const newClickNumber = minting.clicksDone + 1;
          minting.clicksDone = newClickNumber;
          minting.clickHistory.push({
            clickTime: new Date(),
            clickNumber: newClickNumber,
            processed: false,
          });

          await minting.save(); // Save individually

          let mintingAmount = minting.investedAmount;
          const greenId = await hasGreenID(userId);

          const receivedMintingBonus = await getTotalReceivedByMinting(
            userId,
            minting._id,
            "self_minting_bonus"
          );

          const receivedPercentage =
            (receivedMintingBonus / mintingAmount) * 100;

          if (receivedPercentage >= mintingCapPercentge) {
            // const singleMinting = await MintingActivity.findOne({
            //   _id: minting._id
            // });
            minting.isActive = false;
            await minting.save();
          }

          if (receivedPercentage < mintingCapPercentge) {
            if (index === 0) {
              let directBusinessHubCapcity =
                await getDirectReferralBusinessHubCapacity(userId);

              // directBusinessHubCapcity = 1000

              const commissionRates = mintingAndBoosterCommissionData.rates;

              // Calculate multiple
              const multiple = directBusinessHubCapcity / mintingAmount;

              // Extract numeric keys from rates (ignore 'noInvestment')
              const numericRateKeys = Object.keys(commissionRates)
                .filter((key) => key.endsWith("x"))
                .map((key) => parseInt(key));

              // Sort the keys in ascending order
              numericRateKeys.sort((a, b) => a - b);

              // Determine applicable rate key
              let applicableRateKey = "noInvestment";

              if (multiple >= 5) {
                // Find the highest x not exceeding the multiple
                for (let i = numericRateKeys.length - 1; i >= 0; i--) {
                  if (multiple >= numericRateKeys[i]) {
                    applicableRateKey = `${numericRateKeys[i]}x`;
                    break;
                  }
                }
              }

              // Get the final percentage value
              const percentageString = commissionRates[applicableRateKey]; // e.g. '0.5%'
              let mintingPercentage = parseFloat(
                percentageString.replace("%", "")
              );

              mintingPercentage = mintingPercentage / 2;

              // You can now apply this percentage on mintingAmount or use as needed

              let mintingCommission = (mintingAmount * mintingPercentage) / 100;

              if (greenId === true) {
                const updatedUser = await User.findByIdAndUpdate(
                  currentUser._id,
                  { $inc: { currentBalance: mintingCommission } },
                  { new: true } // returns the updated document
                );

                const totalEarned =
                  minting.totalProfitEarned + mintingCommission;
                minting.totalProfitEarned = totalEarned;

                await minting.save();

                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "self_minting_bonus",
                  status: "approved",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: mintingPercentage,
                    totalReceivedMintingPercentage: receivedPercentage,
                    note: `That is the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}. Total business is $${directBusinessHubCapcity}. Booster minting percentage is ${mintingPercentage}%.`,
                  },
                  transactionDate: new Date(),
                }).save();

                // start Minting Comunity Bonus

                // Step 1: Get level bonuses config
                const bonusConfig = await LevelBonus.findOne().lean();
                const levelBonuses = bonusConfig?.levelBonuses || [];

                let uplines = [];
                let current = currentUser;

                // Step 2: Find up to 10 upline users
                for (let i = 0; i < 10; i++) {
                  if (!current.refferBy) break;

                  const upline = await User.findOne({
                    refferrCode: current.refferBy,
                  }).session(session);
                  if (!upline) break;

                  uplines.push(upline);
                  current = upline;
                }

                // level bonus according to ranks
                if (bonusConfig.checkRank) {
                  // Step 3: Loop through each level and apply bonus conditionally
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const uplineRank = await Rank.findById(upline.rank).lean();
                    const requiredSortOrder = levelIndex + 1; // level 1 needs sortOrder 1

                    if (
                      uplineRank &&
                      uplineRank.sortOrder === requiredSortOrder
                    ) {
                      const percentage = levelBonuses[levelIndex].percentage;
                      const bonusAmount =
                        (mintingCommission * percentage) / 100;

                      let levelUserData = await userdata(upline._id);

                      let levelUserGreenId = await hasGreenID(upline._id);

                      if (levelUserGreenId) {
                        // Update upline's wallet or create bonus log here

                        const updatedUser = await User.findByIdAndUpdate(
                          levelUserData._id,
                          { $inc: { currentBalance: bonusAmount } },
                          { new: true } // returns the updated document
                        );

                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType: "community_self_minting_bonus",
                          status: "approved",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has got community_self_minting_bonus. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      } else {
                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType:
                            "community_self_minting_bonus_flushed",
                          status: "flushed",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has not got community_self_minting_bonus bcz user is not green ID. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      }
                    }
                  }
                }

                // level bonus according to without ranks
                else {
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const percentage = levelBonuses[levelIndex].percentage;
                    const bonusAmount = (mintingCommission * percentage) / 100;

                    let levelUserData = await userdata(upline._id);

                    let levelUserGreenId = await hasGreenID(upline._id);

                    if (levelUserGreenId) {
                      // Update upline's wallet or create bonus log here

                      const updatedUser = await User.findByIdAndUpdate(
                        levelUserData._id,
                        { $inc: { currentBalance: bonusAmount } },
                        { new: true } // returns the updated document
                      );

                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_self_minting_bonus",
                        status: "approved",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has got community_self_minting_bonus. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    } else {
                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_self_minting_bonus_flushed",
                        status: "flushed",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has not got community_self_minting_bonus bcz user is not green ID. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    }
                  }
                }

                // end Minting Comunity Bonus
              } else {
                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "self_minting_bonus_flushed",
                  status: "flushed",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: mintingPercentage,
                    note: `That is the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}. Total business is $${directBusinessHubCapcity}. Booster minting percentage is ${mintingPercentage}%.`,
                  },
                  transactionDate: new Date(),
                }).save();
              }
            } else {
              const commissionRates = mintingAndBoosterCommissionData.rates;

              // Convert to array of entries
              const rateEntries = Object.entries(commissionRates);

              // Get the 0th index value (e.g., '0.33%' from 'noInvestment')
              const firstPercentageString = rateEntries[0][1]; // '0.33%'
              let firstPercentage = parseFloat(
                firstPercentageString.replace("%", "")
              ); // 0.33
              firstPercentage = firstPercentage / 2;

              let mintingCommission = (mintingAmount * firstPercentage) / 100;

              if (greenId === true) {
                const updatedUser = await User.findByIdAndUpdate(
                  currentUser._id,
                  { $inc: { currentBalance: mintingCommission } },
                  { new: true } // returns the updated document
                );

                const totalEarned =
                  minting.totalProfitEarned + mintingCommission;
                minting.totalProfitEarned = totalEarned;

                await minting.save();

                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "self_minting_bonus",
                  status: "approved",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: firstPercentage,
                    totalReceivedMintingPercentage: receivedPercentage,
                    note: `That is not the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}.`,
                  },
                  transactionDate: new Date(),
                }).save();

                // start Minting Comunity Bonus

                // Step 1: Get level bonuses config
                const bonusConfig = await LevelBonus.findOne().lean();
                const levelBonuses = bonusConfig?.levelBonuses || [];

                let uplines = [];
                let current = currentUser;

                // Step 2: Find up to 10 upline users
                for (let i = 0; i < 10; i++) {
                  if (!current.refferBy) break;

                  const upline = await User.findOne({
                    refferrCode: current.refferBy,
                  }).session(session);
                  if (!upline) break;

                  uplines.push(upline);
                  current = upline;
                }

                // level bonus according to ranks
                if (bonusConfig.checkRank) {
                  // Step 3: Loop through each level and apply bonus conditionally
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const uplineRank = await Rank.findById(upline.rank).lean();
                    const requiredSortOrder = levelIndex + 1; // level 1 needs sortOrder 1

                    if (
                      uplineRank &&
                      uplineRank.sortOrder === requiredSortOrder
                    ) {
                      const percentage = levelBonuses[levelIndex].percentage;
                      const bonusAmount =
                        (mintingCommission * percentage) / 100;

                      let levelUserData = await userdata(upline._id);

                      let levelUserGreenId = await hasGreenID(upline._id);

                      if (levelUserGreenId) {
                        // Update upline's wallet or create bonus log here

                        const updatedUser = await User.findByIdAndUpdate(
                          levelUserData._id,
                          { $inc: { currentBalance: bonusAmount } },
                          { new: true } // returns the updated document
                        );

                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType: "community_self_minting_bonus",
                          status: "approved",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has got community_self_minting_bonus. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      } else {
                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType:
                            "community_self_minting_bonus_flushed",
                          status: "flushed",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has not got community_self_minting_bonus bcz user is not green ID. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      }
                    }
                  }
                }

                // level bonus according to without ranks
                else {
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const percentage = levelBonuses[levelIndex].percentage;
                    const bonusAmount = (mintingCommission * percentage) / 100;

                    let levelUserData = await userdata(upline._id);

                    let levelUserGreenId = await hasGreenID(upline._id);

                    if (levelUserGreenId) {
                      // Update upline's wallet or create bonus log here

                      const updatedUser = await User.findByIdAndUpdate(
                        levelUserData._id,
                        { $inc: { currentBalance: bonusAmount } },
                        { new: true } // returns the updated document
                      );

                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_self_minting_bonus",
                        status: "approved",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has got community_self_minting_bonus. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    } else {
                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_self_minting_bonus_flushed",
                        status: "flushed",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has not got community_self_minting_bonus bcz user is not green ID. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    }
                  }
                }

                // end Minting Comunity Bonus
              } else {
                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "self_minting_bonus_flushed",
                  status: "flushed",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: firstPercentage,
                    note: `That is not the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}.`,
                  },
                  transactionDate: new Date(),
                }).save();
              }
            }
          }
        }
      }
    }

    if (mintingType === "AUTO") {
      const mintingAndBoosterCommissionData = await mintingAndBoosterCommission(
        "autoMinting"
      );
      const hubs = await Investment.find({
        userId,
      });
      for (const hub of hubs) {
        const mintings = await MintingActivity.find({
          userId,
          investmentId: hub._id,
          mintingType,
          // isActive: true
        });

        for (const [index, minting] of mintings.entries()) {
          // if (minting.clicksDone === 1 & index === 0) {
          //   return {
          //     success: false,
          //     message: `Minting already has 1 click. No further processing.`,
          //   };
          // }

          const newClickNumber = minting.clicksDone + 1;
          minting.clicksDone = newClickNumber;
          minting.clickHistory.push({
            clickTime: new Date(),
            clickNumber: newClickNumber,
            processed: false,
          });

          await minting.save(); // Save individually

          let mintingAmount = minting.investedAmount;
          const greenId = await hasGreenID(userId);

          const receivedMintingBonus = await getTotalReceivedByMinting(
            userId,
            minting._id,
            "auto_minting_bonus"
          );

          const receivedPercentage =
            (receivedMintingBonus / mintingAmount) * 100;

          if (receivedPercentage >= mintingCapPercentge) {
            // const singleMinting = await MintingActivity.findOne({
            //   _id: minting._id
            // });
            minting.isActive = false;
            await minting.save();
          }

          if (receivedPercentage < mintingCapPercentge) {
            if (index === 0) {
              let directBusinessHubCapcity =
                await getDirectReferralBusinessHubCapacity(userId);

              const commissionRates = mintingAndBoosterCommissionData.rates;

              // Calculate multiple
              const multiple = directBusinessHubCapcity / mintingAmount;

              // Extract numeric keys from rates (ignore 'noInvestment')
              const numericRateKeys = Object.keys(commissionRates)
                .filter((key) => key.endsWith("x"))
                .map((key) => parseInt(key));

              // Sort the keys in ascending order
              numericRateKeys.sort((a, b) => a - b);

              // Determine applicable rate key
              let applicableRateKey = "noInvestment";

              if (multiple >= 5) {
                // Find the highest x not exceeding the multiple
                for (let i = numericRateKeys.length - 1; i >= 0; i--) {
                  if (multiple >= numericRateKeys[i]) {
                    applicableRateKey = `${numericRateKeys[i]}x`;
                    break;
                  }
                }
              }

              // Get the final percentage value
              const percentageString = commissionRates[applicableRateKey]; // e.g. '0.5%'
              const mintingPercentage = parseFloat(
                percentageString.replace("%", "")
              );

              // You can now apply this percentage on mintingAmount or use as needed

              let mintingCommission = (mintingAmount * mintingPercentage) / 100;

              if (greenId === true) {
                const updatedUser = await User.findByIdAndUpdate(
                  currentUser._id,
                  { $inc: { currentBalance: mintingCommission } },
                  { new: true } // returns the updated document
                );

                const totalEarned =
                  minting.totalProfitEarned + mintingCommission;
                minting.totalProfitEarned = totalEarned;

                await minting.save();

                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "auto_minting_bonus",
                  status: "approved",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: mintingPercentage,
                    totalReceivedMintingPercentage: receivedPercentage,
                    note: `That is the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}. Total business is $${directBusinessHubCapcity}. Booster minting percentage is ${mintingPercentage}%.`,
                  },
                  transactionDate: new Date(),
                }).save();

                // start Minting Comunity Bonus

                // Step 1: Get level bonuses config
                const bonusConfig = await LevelBonus.findOne().lean();
                const levelBonuses = bonusConfig?.levelBonuses || [];

                let uplines = [];
                let current = currentUser;

                // Step 2: Find up to 10 upline users
                for (let i = 0; i < 10; i++) {
                  if (!current.refferBy) break;

                  const upline = await User.findOne({
                    refferrCode: current.refferBy,
                  }).session(session);
                  if (!upline) break;

                  uplines.push(upline);
                  current = upline;
                }

                // level bonus according to ranks
                if (bonusConfig.checkRank) {
                  // Step 3: Loop through each level and apply bonus conditionally
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const uplineRank = await Rank.findById(upline.rank).lean();
                    const requiredSortOrder = levelIndex + 1; // level 1 needs sortOrder 1

                    if (
                      uplineRank &&
                      uplineRank.sortOrder === requiredSortOrder
                    ) {
                      const percentage = levelBonuses[levelIndex].percentage;
                      const bonusAmount =
                        (mintingCommission * percentage) / 100;

                      let levelUserData = await userdata(upline._id);

                      let levelUserGreenId = await hasGreenID(upline._id);

                      if (levelUserGreenId) {
                        // Update upline's wallet or create bonus log here

                        const updatedUser = await User.findByIdAndUpdate(
                          levelUserData._id,
                          { $inc: { currentBalance: bonusAmount } },
                          { new: true } // returns the updated document
                        );

                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType: "community_auto_minting_bonus",
                          status: "approved",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has got community_auto_minting_bonus. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      } else {
                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType:
                            "community_auto_minting_bonus_flushed",
                          status: "flushed",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has not got community_auto_minting_bonus bcz user is not green ID. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      }
                    }
                  }
                }

                // level bonus according to without ranks
                else {
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const percentage = levelBonuses[levelIndex].percentage;
                    const bonusAmount = (mintingCommission * percentage) / 100;

                    let levelUserData = await userdata(upline._id);

                    let levelUserGreenId = await hasGreenID(upline._id);

                    if (levelUserGreenId) {
                      // Update upline's wallet or create bonus log here

                      const updatedUser = await User.findByIdAndUpdate(
                        levelUserData._id,
                        { $inc: { currentBalance: bonusAmount } },
                        { new: true } // returns the updated document
                      );

                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_auto_minting_bonus",
                        status: "approved",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has got community_auto_minting_bonus. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    } else {
                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_auto_minting_bonus_flushed",
                        status: "flushed",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has not got community_auto_minting_bonus bcz user is not green ID. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    }
                  }
                }

                // end Minting Comunity Bonus
              } else {
                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "auto_minting_bonus_flushed",
                  status: "flushed",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: mintingPercentage,
                    note: `That is the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}. Total business is $${directBusinessHubCapcity}. Booster minting percentage is ${mintingPercentage}%.`,
                  },
                  transactionDate: new Date(),
                }).save();
              }
            } else {
              const commissionRates = mintingAndBoosterCommissionData.rates;

              // Convert to array of entries
              const rateEntries = Object.entries(commissionRates);

              // Get the 0th index value (e.g., '0.33%' from 'noInvestment')
              const firstPercentageString = rateEntries[0][1]; // '0.33%'
              const firstPercentage = parseFloat(
                firstPercentageString.replace("%", "")
              ); // 0.33

              let mintingCommission = (mintingAmount * firstPercentage) / 100;

              if (greenId === true) {
                const updatedUser = await User.findByIdAndUpdate(
                  currentUser._id,
                  { $inc: { currentBalance: mintingCommission } },
                  { new: true } // returns the updated document
                );

                const totalEarned =
                  minting.totalProfitEarned + mintingCommission;
                minting.totalProfitEarned = totalEarned;

                await minting.save();

                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "auto_minting_bonus",
                  status: "approved",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: firstPercentage,
                    totalReceivedMintingPercentage: receivedPercentage,
                    note: `That is not the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}.`,
                  },
                  transactionDate: new Date(),
                }).save();

                // start Minting Comunity Bonus

                // Step 1: Get level bonuses config
                const bonusConfig = await LevelBonus.findOne().lean();
                const levelBonuses = bonusConfig?.levelBonuses || [];

                let uplines = [];
                let current = currentUser;

                // Step 2: Find up to 10 upline users
                for (let i = 0; i < 10; i++) {
                  if (!current.refferBy) break;

                  const upline = await User.findOne({
                    refferrCode: current.refferBy,
                  }).session(session);
                  if (!upline) break;

                  uplines.push(upline);
                  current = upline;
                }

                // level bonus according to ranks
                if (bonusConfig.checkRank) {
                  // Step 3: Loop through each level and apply bonus conditionally
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const uplineRank = await Rank.findById(upline.rank).lean();
                    const requiredSortOrder = levelIndex + 1; // level 1 needs sortOrder 1

                    if (
                      uplineRank &&
                      uplineRank.sortOrder === requiredSortOrder
                    ) {
                      const percentage = levelBonuses[levelIndex].percentage;
                      const bonusAmount =
                        (mintingCommission * percentage) / 100;

                      let levelUserData = await userdata(upline._id);

                      let levelUserGreenId = await hasGreenID(upline._id);

                      if (levelUserGreenId) {
                        // Update upline's wallet or create bonus log here

                        const updatedUser = await User.findByIdAndUpdate(
                          levelUserData._id,
                          { $inc: { currentBalance: bonusAmount } },
                          { new: true } // returns the updated document
                        );

                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType: "community_auto_minting_bonus",
                          status: "approved",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has got community_auto_minting_bonus. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      } else {
                        await new Transaction({
                          senderId: currentUser._id,
                          receiverId: upline._id,
                          amount: bonusAmount,
                          paymentMethod: "SYSTEM",
                          transactionType:
                            "community_auto_minting_bonus_flushed",
                          status: "flushed",
                          commissionDetails: {
                            mintingId: minting._id,
                            percentage: percentage,
                            note: `That is according to Ranks. ${
                              levelUserData.username
                            } has not got community_auto_minting_bonus bcz user is not green ID. Level is ${
                              i + 1
                            }. Percentage is ${percentage}.`,
                          },
                          transactionDate: new Date(),
                        }).save();
                      }
                    }
                  }
                }

                // level bonus according to without ranks
                else {
                  for (let i = 0; i < levelBonuses.length; i++) {
                    const levelIndex = i; // 0-based index = level 1
                    const upline = uplines[levelIndex];

                    if (!upline) continue;

                    const percentage = levelBonuses[levelIndex].percentage;
                    const bonusAmount = (mintingCommission * percentage) / 100;

                    let levelUserData = await userdata(upline._id);

                    let levelUserGreenId = await hasGreenID(upline._id);

                    if (levelUserGreenId) {
                      // Update upline's wallet or create bonus log here

                      const updatedUser = await User.findByIdAndUpdate(
                        levelUserData._id,
                        { $inc: { currentBalance: bonusAmount } },
                        { new: true } // returns the updated document
                      );

                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_auto_minting_bonus",
                        status: "approved",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has got community_auto_minting_bonus. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    } else {
                      await new Transaction({
                        senderId: currentUser._id,
                        receiverId: upline._id,
                        amount: bonusAmount,
                        paymentMethod: "SYSTEM",
                        transactionType: "community_auto_minting_bonus_flushed",
                        status: "flushed",
                        commissionDetails: {
                          mintingId: minting._id,
                          percentage: percentage,
                          note: `That is according to without Ranks. ${
                            levelUserData.username
                          } has not got community_auto_minting_bonus bcz user is not green ID. Level is ${
                            i + 1
                          }. Percentage is ${percentage}.`,
                        },
                        transactionDate: new Date(),
                      }).save();
                    }
                  }
                }

                // end Minting Comunity Bonus
              } else {
                await new Transaction({
                  senderId: userId,
                  receiverId: userId,
                  amount: mintingCommission,
                  paymentMethod: "SYSTEM",
                  transactionType: "auto_minting_bonus_flushed",
                  status: "flushed",
                  commissionDetails: {
                    mintingId: minting._id,
                    buyerId: userId,
                    buyerUsername: currentUser.username,
                    percentage: firstPercentage,
                    note: `That is not the initial minting. User has got $${mintingCommission} as community minting bonus. Minting amount is $${mintingAmount}.`,
                  },
                  transactionDate: new Date(),
                }).save();
              }
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error recording click:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

let TOGGLE_RESTRICTION_DAYS = 7; // Days before free toggle is allowed
let EARLY_TOGGLE_FEE_PERCENTAGE = 10; // Fee percentage for early toggle

exports.toggleMintingType = async (req, res) => {
  try {
    // Check authorization
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = authUser;
    const { mintingActivityId } = req.body;
    // Find the minting activity by its ID
    let keyname = "Switching Fee";
    let setting = await settings.findOne({ keyname });

    const mintingActivity = await MintingActivity.findOne({
      _id: mintingActivityId,
      isActive: true,
    });
    EARLY_TOGGLE_FEE_PERCENTAGE = setting.value;

    // Ensure the activity belongs to the user
    if (!mintingActivity || mintingActivity.userId.toString() !== userId) {
      return res.status(404).json({
        success: false,
        message: "No active minting activity found for this user",
      });
    }

    if (!mintingActivity) {
      return res.status(404).json({
        success: false,
        message: "No active minting activity found for this user",
      });
    }

    // Check if 7 days have passed since the activity creation
    const currentDate = new Date();
    const creationDate = new Date(mintingActivity.createdAt);
    const daysDifference = Math.floor(
      (currentDate - creationDate) / (1000 * 60 * 60 * 24)
    );

    const canToggleFree = daysDifference > TOGGLE_RESTRICTION_DAYS;

    const toggleFee = canToggleFree
      ? 0
      : (mintingActivity.investedAmount * EARLY_TOGGLE_FEE_PERCENTAGE) / 100;

    // Toggle the minting type
    const newMintingType =
      mintingActivity.mintingType === "AUTO" ? "MANUAL" : "AUTO";

    // Update the minting activity
    const updatedActivity = await MintingActivity.findByIdAndUpdate(
      mintingActivity._id,
      {
        investedAmount: mintingActivity.investedAmount - toggleFee,
        mintingType: newMintingType,
        // You might want to add a lastModified timestamp
        updatedAt: new Date(),
      },
      { new: true } // Return the updated document
    );

    // Prepare response message
    let message = `Minting type successfully changed to ${newMintingType}`;
    if (!canToggleFree) {
      message += `. A fee of ${toggleFee} (${EARLY_TOGGLE_FEE_PERCENTAGE}% of investment) has been deducted as you switched within ${TOGGLE_RESTRICTION_DAYS} days of investment creation.`;
    }

    return res.status(200).json({
      success: true,
      message: message,
      data: {
        mintingActivityId: updatedActivity._id,
        previousType: mintingActivity.mintingType,
        currentType: newMintingType,
        userId: userId,
        feeApplied: !canToggleFree,
        feeAmount: toggleFee,
        daysSinceCreation: daysDifference,
        minimumDaysForFreeToggle: TOGGLE_RESTRICTION_DAYS,
        investmentAmount: mintingActivity.investedAmount,
      },
    });
  } catch (error) {
    console.error("Error toggling minting type:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while toggling minting type",
    });
  }
};
