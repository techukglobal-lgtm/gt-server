const express = require("express");
const router = express.Router();
const User = require("../models/auth");
const setting = require("../models/settings");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const MintingActivity = require("../models/MintingActivity");
const LevelBonus = require("../models/levelBonus");
const MintingCommission = require("../models/MintingCommission");
const mongoose = require("mongoose");
const BinarySchema = require("../models/BinarySchema");

exports.userdata = async (id) => {
  try {
    // Check if a wallet already exists for this coin and user
    const user = await User.findOne({
      _id: id,
    });
    return user;
  } catch (error) {
    console.error("🚀 ~ buyCrypto ~ error:", error);
  }
};

exports.sponsordata = async (id) => {
  try {
    // Check if a wallet already exists for this coin and user
    const user = await User.findOne({
      _id: id,
    });

    const sponsor = await User.findOne({
      _id: user.sponsorid,
    });

    return sponsor;
  } catch (error) {
    console.error("🚀 ~ buyCrypto ~ error:", error);
  }
};

exports.settingsdata = async (value) => {
  try {
    // Check if a wallet already exists for this coin and user
    const settings = await setting.findOne({
      keyname: value,
    });

    return settings;
  } catch (error) {
    console.error("🚀 ~ buyCrypto ~ error:", error);
  }
};

exports.settingsdataById = async (value) => {
  try {
    // Check if a wallet already exists for this coin and user
    const settings = await setting.findOne({
      _id: value,
    });

    return settings;
  } catch (error) {
    console.error("🚀 ~ buyCrypto ~ error:", error);
  }
};

exports.getCumulativeHubAmount = async (userId) => {
  const session = await mongoose.startSession();
  try {
    const sponsorInvestments = await Investment.aggregate([
      {
        $match: {
          userId: userId,
        },
      },
      {
        $group: {
          _id: null,
          totalHubPrice: { $sum: "$hubPackage.hubPrice" },
        },
      },
    ]);

    const totalHubPrice = sponsorInvestments[0]?.totalHubPrice || 0;
    return totalHubPrice;
  } catch (error) {
    console.error("🚀 ~ getCumulativeHubAmount ~ error:", error);
    return 0;
  }
};

exports.getCumulativeBuildingBonus = async (userId) => {
  try {
    const result = await Transaction.aggregate([
      {
        $match: {
          receiverId: userId,
          transactionType: "community_building_bonus",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalAmount = result[0]?.totalAmount || 0;
    return totalAmount;
  } catch (error) {
    console.error("Error getting community building bonus sum:", error);
    return 0;
  }
};

exports.hasGreenID = async (userId) => {
  try {
    const objectId = new mongoose.Types.ObjectId(userId);

    const [investmentExists, activeMintingExists] = await Promise.all([
      Investment.exists({ userId: objectId }),
      MintingActivity.exists({ userId: objectId, isActive: true }),
    ]);

    return Boolean(investmentExists && activeMintingExists);
  } catch (error) {
    console.error("Error checking user minting and investment status:", error);
    return false;
  }
};

exports.mintingAndBoosterCommission = async (value) => {
  try {
    console.log(value);
    // Check if a wallet already exists for this coin and user
    const commission = await MintingCommission.findOne({
      commissionType: value,
    });

    return commission;
  } catch (error) {
    console.error("🚀 ~ buyCrypto ~ error:", error);
  }
};

exports.getDirectReferralBusinessHubCapacity = async (userId) => {
  try {
    const objectId = new mongoose.Types.ObjectId(userId);

    // Step 1: Get the user to retrieve their referral code
    const user = await User.findById(objectId);
    if (!user || !user.refferrCode) {
      return 0;
    }

    // Step 2: Get direct referrals using the referral code
    const directReferrals = await User.find({
      refferBy: user.refferrCode,
    }).select("_id");
    const referralIds = directReferrals.map((ref) => ref._id);

    if (referralIds.length === 0) return 0;

    // Step 3: Get all investments by direct referrals
    const referralInvestments = await Investment.find({
      userId: { $in: referralIds },
    });

    // Step 4: Sum up the hubCapacity values
    const totalBusiness = referralInvestments.reduce((sum, inv) => {
      const capacity = inv.hubPackage?.hubCapacity || 0;
      return sum + capacity;
    }, 0);

    return totalBusiness;
  } catch (error) {
    console.error("Error calculating direct referral business:", error);
    return 0;
  }
};

exports.getTotalReceivedByMinting = async (userId, mintingId, type) => {
  try {
    const receiverObjectId = userId;
    const mintingObjectId = new mongoose.Types.ObjectId(mintingId);

    const result = await Transaction.aggregate([
      {
        $match: {
          receiverId: receiverObjectId,
          transactionType: type,
          "commissionDetails.mintingId": mintingObjectId,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    return result[0]?.totalAmount || 0;
  } catch (error) {
    console.error("Error calculating total received amount:", error);
    return 0;
  }
};

exports.getDaysPassedByMinting = async (userId, mintingId) => {
  try {
    const mintingObjectId = new mongoose.Types.ObjectId(mintingId);

    const daysPassed = await Transaction.countDocuments({
      receiverId: userId, // string format
      transactionType: "self_minting_bonus",
      "commissionDetails.mintingId": mintingObjectId,
    });

    return daysPassed;
  } catch (error) {
    console.error("Error calculating minting days passed:", error);
    return 0;
  }
};

exports.getMonthsPassedByMinting = async (userId, mintingId) => {
  try {
    const mintingObjectId = new mongoose.Types.ObjectId(mintingId);

    // Count number of transactions (each = 1 month passed)
    const monthsPassed = await Transaction.countDocuments({
      receiverId: userId,
      transactionType: "auto_minting_bonus",
      "commissionDetails.mintingId": mintingObjectId,
    });

    return monthsPassed;
  } catch (error) {
    console.error("Error calculating months passed:", error);
    return 0;
  }
};

exports.calculatePhase = async (date) => {
  try {
    const now = new Date();
    const createdDate = new Date(date);
    const msSinceCreated = now - createdDate;
    const msIn24h = 24 * 60 * 60 * 1000;
    const msIn12h = 12 * 60 * 60 * 1000;

    const timeInCurrentCycle = msSinceCreated % msIn24h;
    const isFirstHalf = timeInCurrentCycle < msIn12h;

    let phaseValue;
    if (isFirstHalf) {
      phaseValue = 1;
    } else {
      phaseValue = 2;
    }

    console.log("function phase", phaseValue);
    return phaseValue;
  } catch (error) {
    console.log("Error calculating months passed:", error);
    console.error("Error calculating months passed:", error);
    return 0;
  }
};

exports.getUserEarnings = async (userId) => {
  try {
    const allowedTypes = [
      "direct_commission",
      "community_building_bonus",
      "self_minting_bonus",
      "auto_minting_bonus",
      "community_self_minting_bonus",
      "community_auto_minting_bonus",
    ];

    const earnings = await Transaction.aggregate([
      {
        $match: {
          receiverId: {
            $in: [userId, new mongoose.Types.ObjectId(userId)],
          },
          status: "approved",
          transactionType: { $in: allowedTypes },
        },
      },
      {
        $group: {
          _id: "$transactionType",
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const earningsByType = {};
    let grandTotal = 0;

    earnings.forEach((entry) => {
      earningsByType[entry._id] = entry.totalAmount;
      grandTotal += entry.totalAmount;
    });

    return {
      earningsByType,
      grandTotal,
    };
  } catch (error) {
    console.error("Error calculating earnings:", error);
    return {
      earningsByType: {},
      grandTotal: 0,
    };
  }
};

exports.getBestPerformer = async (referrCode) => {
  try {
    // 1. Get direct referrals of the given user
    const directReferrals = await User.find({ refferBy: referrCode });

    let topPerformer = null;
    let maxInvestment = 0;

    // 2. For each direct referral, check their own referrals (2nd-level)
    for (const ref of directReferrals) {
      const secondLevelReferrals = await User.find({
        refferBy: ref.refferrCode,
      });

      const secondLevelIds = secondLevelReferrals.map((user) => user._id);

      if (secondLevelIds.length === 0) continue;

      // 3. Sum their hubPackage.hubPrice from Investment collection
      const investments = await Investment.aggregate([
        { $match: { userId: { $in: secondLevelIds } } },
        {
          $group: {
            _id: null,
            totalHubPrice: { $sum: "$hubPackage.hubPrice" },
          },
        },
      ]);

      const total = investments[0]?.totalHubPrice || 0;

      if (total > maxInvestment) {
        maxInvestment = total;
        topPerformer = ref;
      }
    }

    return topPerformer;
  } catch (error) {
    console.error("Error finding top performer:", error);
    return null;
  }
};

// get minting results and remainign for user with respect to cap

exports.getMintingInsights = async (userId) => {
  const settings = await setting.findOne({ keyname: "Minting Cap" });
  const mintingCapPercentage = parseFloat(settings?.value); // default to 250 if not found

  const userActivities = await MintingActivity.find({ userId }).lean();

  const autoActivities = [];
  const manualActivities = [];

  let totalAutoProfit = 0;
  let totalManualProfit = 0;
  let totalAutoCap = 0;
  let totalManualCap = 0;

  for (const activity of userActivities) {
    const { mintingType, investedAmount, totalProfitEarned } = activity;

    const maxCap = investedAmount * (mintingCapPercentage / 100);
    const remainingCap = maxCap - totalProfitEarned;

    const formattedActivity = {
      _id: activity._id,
      investedAmount,
      totalProfitEarned,
      maxCap,
      remainingCap: Math.max(0, remainingCap),
    };

    if (mintingType === "AUTO") {
      autoActivities.push(formattedActivity);
      totalAutoProfit += totalProfitEarned;
      totalAutoCap += maxCap;
    } else if (mintingType === "MANUAL") {
      manualActivities.push(formattedActivity);
      totalManualProfit += totalProfitEarned;
      totalManualCap += maxCap;
    }
  }

  return [
    {
      type: "SELF",
      allSelfMintingEarning: totalManualProfit,
      remaining: Math.max(0, totalManualCap - totalManualProfit),
      activities: manualActivities,
    },
    {
      type: "AUTO",
      allAutoMintingEarning: totalAutoProfit,
      remaining: Math.max(0, totalAutoCap - totalAutoProfit),
      activities: autoActivities,
    },
  ];
};

exports.leftOrRightPoints = async (userId) => {
  try {
    const placement = BinarySchema.findOne({ userId }).select(
      "totalRightPoints totalLeftPoints"
    );
    return placement;
  } catch (error) {
    return "placement not found";
  }
};
