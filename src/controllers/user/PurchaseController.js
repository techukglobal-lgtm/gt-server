const mongoose = require("mongoose");
const User = require("../../models/auth");
const Package = require("../../models/pakages");
const Investment = require("../../models/Investment");
const Transaction = require("../../models/Transaction");
const BinaryPlacement = require("../../models/BinarySchema");
const { settingsdata, getCumulativeHubAmount, getCumulativeBuildingBonus, hasGreenID } = require('../../helpers/functions');

exports.purchasePackage = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId, packageId } = req.body;

    // Input validation
    if (!userId || !packageId) {
      
      return res.status(400).json({
        success: false,
        message: "User ID and Package ID are required",
      });
    }

    // Validate ObjectId format
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(packageId)
    ) {
      
      return res.status(400).json({
        success: false,
        message: "Invalid User ID or Package ID format",
      });
    }

    // Fetch user and package data
    const user = await User.findById(userId);
    const packageData = await Package.findById(packageId);

    if (!user || !packageData) {
      
      return res.status(404).json({
        success: false,
        message: !user ? "User not found" : "Package not found",
      });
    }

    // Parse and validate numeric values
    const packagePrice = parseFloat(packageData.hubPrice);
    const investmentAmount = parseFloat(packageData.hubCapacity);
    const userCryptoBalance = parseFloat(user.cryptoWallet) || 0;

    if (
      isNaN(packagePrice) ||
      isNaN(investmentAmount) ||
      packagePrice <= 0 ||
      investmentAmount <= 0
    ) {
      
      return res.status(400).json({
        success: false,
        message: "Invalid package price or investment amount",
      });
    }

    // Check sufficient balance
    if (userCryptoBalance < packagePrice) {
      
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Required: $${packagePrice}, Available: $${userCryptoBalance}`,
      });
    }

    // Generate unique transaction ID
    const transactionId = `TXN${Date.now()}${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;

    // Create investment record
    const investment = new Investment({
      userId: user._id,
      hubPackage: {
        amount: parseFloat(packageData.amount),
        hubPrice: packagePrice,
        hubCapacity: investmentAmount,
        minimumMinting: parseFloat(packageData.minimumMinting),
        packageId: packageData._id.toString(),
      },
      amount: investmentAmount,
      cryptoUsed: "USDT",
      txHash: transactionId,
      isMintingActive: false,
      mintingType: "manual",
      purchaseDate: new Date(),
    });

    await investment.save();

    // Update user balances and stats
    user.cryptoWallet = parseFloat(user.cryptoWallet) - packagePrice;
    user.walletBalance =
      (parseFloat(user.walletBalance) || 0) + investmentAmount;
    user.totalPackageInvestment =
      (parseFloat(user.totalPackageInvestment) || 0) + investmentAmount;
    user.activePackageCount = (parseInt(user.activePackageCount) || 0) + 1;

    await user.save();

    // Handle Direct Sponsor Commission
    if (user.refferBy) {
      // Find sponsor by referral code (refferBy stores the referrer's refferrCode)
      const sponsor = await User.findOne({
        refferrCode: user.refferBy,
      });

      if (sponsor) {

        const direct_commission_per = await settingsdata('Direct Bonus');

        const commissionAmount = parseFloat((parseFloat(packageData.amount) * (direct_commission_per.value) / 100).toFixed(2));

        const greenId = await hasGreenID(sponsor._id)
        console.log(`Sponsor Green ID status: ${greenId} for user: ${user.username} with referral code: ${user.refferBy}`);
        if (greenId === true) {

          const updatedUser = await User.findByIdAndUpdate(
            sponsor._id,
            { $inc: { currentBalance: commissionAmount } },
            { new: true } // returns the updated document
          );

          // Create commission transaction record
          const sponsorTx = new Transaction({
            senderId: user._id,
            receiverId: sponsor._id,
            amount: commissionAmount,
            paymentMethod: "SYSTEM",
            transactionType: "direct_commission",
            status: "approved",
            commissionDetails: {
              level: "direct",
              percentage: direct_commission_per.value,
              buyerId: user._id,
              buyerUsername: user.username,
              sponsorReferralCode: sponsor.refferrCode,
            },
            transactionDate: new Date(),
          });

          await sponsorTx.save();
        }
        else {
          const sponsorTx = new Transaction({
            senderId: user._id,
            receiverId: sponsor._id,
            amount: commissionAmount,
            paymentMethod: "SYSTEM",
            transactionType: "direct_commission_flushed",
            status: "flushed",
            commissionDetails: {
              level: "direct",
              percentage: direct_commission_per.value,
              buyerId: user._id,
              buyerUsername: user.username,
              sponsorReferralCode: sponsor.refferrCode,
              note: "direct commission flushed bcz user is not an Green ID"
            },
            transactionDate: new Date(),
          });

          await sponsorTx.save();
        }

        // console.log(
        //   `Direct commission of $${commissionAmount} credited to sponsor: ${sponsor.username} (${sponsor.refferrCode})`
        // );
      } else {
        console.log(`Sponsor not found for referral code: ${user.refferBy}`);
      }
    }


    // Start Community Building Bonus
    const buyerPlacement = await BinaryPlacement.findOne({ userId: user._id });

    const buyerLeg = buyerPlacement.leg; // L or R
    const sponsorUser = await BinaryPlacement.findOne({ userId: buyerPlacement.sid });

    if (sponsorUser) {
      // Update sponsor’s points
      if (buyerLeg === "L") {
        sponsorUser.leftPoints += parseInt(packageData.amount, 10);
        sponsorUser.totalLeftPoints += parseInt(packageData.amount, 10);
      } else {
        sponsorUser.rightPoints += parseInt(packageData.amount, 10);
        sponsorUser.totalRightPoints += parseInt(packageData.amount, 10);
      }

      await sponsorUser.save();

      let level1Status = false

      // Check if sponsor has both legs filled
      if (sponsorUser.leftPoints > 0 && sponsorUser.rightPoints > 0) {
        const communityBonusdata = await settingsdata('Level1 Building Bonus');
        const communityBonusPercent = communityBonusdata.value;

        // Calculate weaker leg points
        const weakerLegPoints = Math.min(sponsorUser.leftPoints, sponsorUser.rightPoints);

        // Calculate community bonus
        const communityBonusAmount = (weakerLegPoints * communityBonusPercent) / 100;

        // Deduct used points from both legs
        sponsorUser.leftPoints -= weakerLegPoints;
        sponsorUser.rightPoints -= weakerLegPoints;

        // Optional: Save the updated sponsorUser and record bonus
        await sponsorUser.save();

        const sponsor = await User.findOne({ _id: sponsorUser.userId });
        const totalHubPrice = await getCumulativeHubAmount(sponsorUser.userId)
        const totalBuildingBonus = await getCumulativeBuildingBonus(sponsorUser.userId)
        const greenId = await hasGreenID(sponsorUser.userId)

        if (greenId === true && totalBuildingBonus < totalHubPrice) {
          sponsor.currentBalance =
            (parseFloat(sponsor.currentBalance) || 0) + communityBonusAmount;
          await sponsor.save();

          await new Transaction({
            senderId: user._id,
            receiverId: sponsor._id,
            amount: communityBonusAmount,
            paymentMethod: "SYSTEM",
            transactionType: "community_building_bonus",
            status: "approved",
            commissionDetails: {
              buyerId: user._id,
              buyerUsername: user.username,
              leg: buyerLeg,
              percentage: communityBonusPercent,
              convertedPoints: weakerLegPoints
            },
            transactionDate: new Date(),
          }).save();
        }
        else {
          let note = ""
          if (greenId === false) {
            note = "community building bonus flushed bcz user is not an Green ID"
          }
          if (totalBuildingBonus > totalHubPrice) {
            note = "community building bonus flushed bcz bonus hit the cap"
          }
          if (greenId === false && totalBuildingBonus > totalHubPrice) {
            note = "community building bonus flushed bcz user is not an Green ID and bonus hit the cap"
          }

          await new Transaction({
            senderId: user._id,
            receiverId: sponsor._id,
            amount: communityBonusAmount,
            paymentMethod: "SYSTEM",
            transactionType: "community_building_bonus_flushed",
            status: "flushed",
            commissionDetails: {
              buyerId: user._id,
              buyerUsername: user.username,
              leg: buyerLeg,
              percentage: communityBonusPercent,
              convertedPoints: weakerLegPoints,
              note: note
            },
            transactionDate: new Date(),
          }).save();
        }

        level1Status = true
      }


      // Distribute 30% to uplines who fulfill binary condition
      const uplineList = [];
      let currentUserId = sponsorUser.pid;
      while (currentUserId) {
        const currentPlacement = await BinaryPlacement.findOne({ userId: currentUserId });
        if (!currentPlacement) break;

        let teamLeg = currentPlacement.leg

        if (teamLeg === "L") {
          currentPlacement.leftPoints += parseInt(packageData.amount, 10);
          currentPlacement.totalLeftPoints += parseInt(packageData.amount, 10);
        } else {
          currentPlacement.rightPoints += parseInt(packageData.amount, 10);
          currentPlacement.totalRightPoints += parseInt(packageData.amount, 10);
        }

        await currentPlacement.save();

        if (currentPlacement.leftPoints > 0 && currentPlacement.rightPoints > 0) {
          const convertedPoints = Math.min(currentPlacement.leftPoints, currentPlacement.rightPoints);
          uplineList.push({
            userId: currentUserId,
            convertedPoints,
            teamLeg: teamLeg
          });
        }

        currentUserId = currentPlacement.pid;
      }


      // start if sponosr will not able to get as level1 bonus then first avaliable user will get level1 bonus
      let newList = []
      let uplineLength
      let forDataProcess
      if (level1Status === false) {
        newList = uplineList.slice(1);
        uplineLength = newList.length
        forDataProcess = newList

        let firstUpline = null;

        if (uplineList.length > 0) {
          firstUpline = uplineList[0];
          const sponsorUser = await BinaryPlacement.findOne({ userId: firstUpline.userId });

          const communityBonusdata = await settingsdata('Level1 Building Bonus');
          const communityBonusPercent = communityBonusdata.value;

          // Calculate weaker leg points
          const weakerLegPoints = firstUpline.convertedPoints

          // Calculate community bonus
          const communityBonusAmount = (weakerLegPoints * communityBonusPercent) / 100;

          // Deduct used points from both legs
          sponsorUser.leftPoints -= weakerLegPoints;
          sponsorUser.rightPoints -= weakerLegPoints;

          // Optional: Save the updated sponsorUser and record bonus
          await sponsorUser.save();

          const sponsor = await User.findOne({ _id: sponsorUser.userId });
          const totalHubPrice = await getCumulativeHubAmount(sponsorUser.userId)
          const totalBuildingBonus = await getCumulativeBuildingBonus(sponsorUser.userId)
          const greenId = await hasGreenID(sponsorUser.userId)

          if (greenId === true && totalBuildingBonus < totalHubPrice) {
            sponsor.currentBalance =
              (parseFloat(sponsor.currentBalance) || 0) + communityBonusAmount;
            await sponsor.save();

            await new Transaction({
              senderId: user._id,
              receiverId: sponsor._id,
              amount: communityBonusAmount,
              paymentMethod: "SYSTEM",
              transactionType: "community_building_bonus",
              status: "approved",
              commissionDetails: {
                buyerId: user._id,
                buyerUsername: user.username,
                leg: firstUpline.teamLeg,
                percentage: communityBonusPercent,
                convertedPoints: weakerLegPoints
              },
              transactionDate: new Date(),
            }).save();

          }
          else {
            let note = ""
            if (greenId === false) {
              note = "community building bonus flushed bcz user is not an Green ID"
            }
            if (totalBuildingBonus > totalHubPrice) {
              note = "community building bonus flushed bcz bonus hit the cap"
            }
            if (greenId === false && totalBuildingBonus > totalHubPrice) {
              note = "community building bonus flushed bcz user is not an Green ID and bonus hit the cap"
            }
            await new Transaction({
              senderId: user._id,
              receiverId: sponsor._id,
              amount: communityBonusAmount,
              paymentMethod: "SYSTEM",
              transactionType: "community_building_bonus_flushed",
              status: "flushed",
              commissionDetails: {
                buyerId: user._id,
                buyerUsername: user.username,
                leg: firstUpline.teamLeg,
                percentage: communityBonusPercent,
                convertedPoints: weakerLegPoints,
                note: note
              },
              transactionDate: new Date(),
            }).save();
          }

        }

      }
      else {
        uplineLength = uplineList.length
        forDataProcess = uplineList
      }

      // end if sponosr will not able to get as level1 bonus then first avaliable user will get level1 bonus

      const communityBonusRemainingData = await settingsdata('Remaining Level Building Bonus');
      const communityBonusRemainingPercent = communityBonusRemainingData.value;

      let communityBonusRemainingPercentForEachUser = communityBonusRemainingPercent / uplineLength

      if (communityBonusRemainingPercentForEachUser > 10) {
        communityBonusRemainingPercentForEachUser = 10
      }
      else {
        communityBonusRemainingPercentForEachUser = communityBonusRemainingPercentForEachUser
      }

      for (const uplineData of forDataProcess) {
        const uplineUser = await User.findById(uplineData.userId);

        let convertedPoints = uplineData.convertedPoints
        const communityBonusAmount = (convertedPoints * communityBonusRemainingPercentForEachUser) / 100;


        const uplineUserTree = await BinaryPlacement.findOne({ userId: uplineData.userId });

        uplineUserTree.leftPoints -= convertedPoints;
        uplineUserTree.rightPoints -= convertedPoints;

        // Optional: Save the updated sponsorUser and record bonus
        await uplineUserTree.save();

        const totalHubPrice = await getCumulativeHubAmount(uplineData.userId)
        const totalBuildingBonus = await getCumulativeBuildingBonus(uplineData.userId)
        const greenId = await hasGreenID(uplineData.userId)

        if (greenId === true && totalBuildingBonus < totalHubPrice) {
          uplineUser.currentBalance = (parseFloat(uplineUser.currentBalance) || 0) + communityBonusAmount;
          await uplineUser.save();

          await new Transaction({
            senderId: user._id,
            receiverId: uplineData.userId,
            amount: communityBonusAmount,
            paymentMethod: "SYSTEM",
            transactionType: "community_building_bonus",
            status: "approved",
            commissionDetails: {
              buyerId: user._id,
              buyerUsername: user.username,
              leg: uplineData.teamLeg,
              percentage: communityBonusRemainingPercentForEachUser,
              convertedPoints: convertedPoints
            },
            transactionDate: new Date(),
          }).save();
        }
        else {
          let note = ""
          if (greenId === false) {
            note = "community building bonus flushed bcz user is not an Green ID"
          }
          if (totalBuildingBonus > totalHubPrice) {
            note = "community building bonus flushed bcz bonus hit the cap"
          }
          if (greenId === false && totalBuildingBonus > totalHubPrice) {
            note = "community building bonus flushed bcz user is not an Green ID and bonus hit the cap"
          }
          await new Transaction({
            senderId: user._id,
            receiverId: uplineData.userId,
            amount: communityBonusAmount,
            paymentMethod: "SYSTEM",
            transactionType: "community_building_bonus_flushed",
            status: "flushed",
            commissionDetails: {
              buyerId: user._id,
              buyerUsername: user.username,
              leg: uplineData.teamLeg,
              percentage: communityBonusRemainingPercentForEachUser,
              convertedPoints: convertedPoints,
              note: note
            },
            transactionDate: new Date(),
          }).save();
        }

      }
    }
    // End Community Building Bonus



    // Create main purchase transaction record
    const purchaseTx = new Transaction({
      senderId: user._id,
      receiverId: "system",
      amount: packagePrice,
      paymentMethod: "USDT",
      transactionType: "purchase",
      status: "approved",
      packageDetails: {
        packageId: packageData._id,
        packageName: packageData.name || `Package ${packageData._id}`,
        investmentAmount: investmentAmount,
      },
      transactionDate: new Date(),
    });

    await purchaseTx.save();

    // Commit transaction
    // await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Package purchased successfully! $${investmentAmount} added to your wallet.`,
      data: {
        investment: {
          id: investment._id,
          amount: investment.amount,
          txHash: investment.txHash,
          purchaseDate: investment.purchaseDate,
        },
        transactions: {
          purchase: purchaseTx._id,
          commission: user.refferBy
            ? "Commission transaction created"
            : "No referrer",
        },
        transactionId,
        packagePrice,
        investmentAmount,
        user: {
          walletBalance: user.walletBalance,
          cryptoWallet: user.cryptoWallet,
          totalInvestment: user.totalPackageInvestment,
          activePackageCount: user.activePackageCount,
        },
      },
    });
  } catch (error) {
    
    console.error("Package purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to purchase package",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } 
};
