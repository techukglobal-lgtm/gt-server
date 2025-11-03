const User = require("../../models/auth");
const Investment = require("../../models/Investment");
const Deposit = require("../../models/deposit");
const MintingActivity = require("../../models/MintingActivity");
const Rank = require("../../models/Rank");
const Withdrawal = require("../../models/Withdrawal");
const BinaryPlacement = require("../../models/BinarySchema");
const checkAuthorization = require("../../middlewares/authMiddleware");
const mongoose = require("mongoose");
const {
  getUserEarnings,
  getBestPerformer,
  getMintingInsights,
} = require("../../helpers/functions");

exports.getDashboardAnalytics = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userId = authUser;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Get current user for referral code
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const rank = await Rank.findById(currentUser.rank);

    // Parallel execution of required queries only
    const [
      totalInvestmentData,
      binaryPoints,
      referredUsersCount,
      boughtPackagesCount,
      recentMintingClicks,
      depositHistory,
      withdrawHistory,
      boughtPackages,
      totalApprovedWithdrawalsData,
      totalDepositsData,
      highestRankReferredUser,
      pendingWithdrawalsAmount,
      topPerformer,
      mintingInsights,
    ] = await Promise.all([
      // All time invested
      MintingActivity.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, totalInvested: { $sum: "$investedAmount" } } },
      ]),

      // Binary points
      BinaryPlacement.findOne({ userId: authUser }).select(
        "totalLeftPoints totalRightPoints"
      ),

      // Referred users count
      User.countDocuments({ refferBy: currentUser.refferrCode }),

      // Bought packages count
      Investment.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
      }),

      // Recent minting clicks (last 10)
      MintingActivity.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$clickHistory" },
        { $sort: { "clickHistory.clickTime": -1 } },
        { $limit: 10 },
        {
          $project: {
            clickTime: "$clickHistory.clickTime",
            profitEarned: "$clickHistory.profitEarned",
            clickNumber: "$clickHistory.clickNumber",
            investedAmount: 1,
            mintingType: 1,
          },
        },
      ]),

      // Deposit history (last 10)
      Deposit.find({ userId })
        .select("coin chain amount status txHash createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Withdraw history (last 10)
      Withdrawal.find({ userId })
        .select(
          "amount amount2 paymentMethod payoutAddress status feeInfo createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Bought packages (last 10)
      Investment.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select(
          "hubPackage amount cryptoUsed txHash isMintingActive mintingType purchaseDate"
        )
        .sort({ purchaseDate: -1 })
        .limit(10)
        .lean(),

      // Total approved withdrawals
      Withdrawal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: "approved",
          },
        },
        {
          $group: { _id: null, totalApprovedWithdrawals: { $sum: "$amount" } },
        },
      ]),

      // Total deposits
      Deposit.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: "confirmed",
          },
        },
        { $group: { _id: null, totalDepositsAmount: { $sum: "$amount" } } },
      ]),

      // Highest rank referred user
      getHighestRankReferredUser(currentUser.refferrCode),

      // Pending withdrawals amount
      Withdrawal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: "pending",
          },
        },
        {
          $group: { _id: null, totalPendingAmount: { $sum: "$amount" } },
        },
      ]),

      // Top performers
      getBestPerformer(currentUser.refferrCode),
      getMintingInsights(currentUser._id),
    ]);

    // Get total earnings
    let totalEarning = await getUserEarnings(userId);

    // Format response with only required data
    const dashboardData = {
      currentUser,
      totalEarning: totalEarning,
      allTimeInvested: totalInvestmentData[0]?.totalInvested || 0,
      referredUsers: referredUsersCount,
      boughtPackages: boughtPackagesCount,
      totalApprovedWithdrawals:
        totalApprovedWithdrawalsData[0]?.totalApprovedWithdrawals || 0,
      totalDepositsAmount: totalDepositsData[0]?.totalDepositsAmount || 0,
      pendingWithdrawalsAmount:
        pendingWithdrawalsAmount[0]?.totalPendingAmount || 0,
      totalLeftPoints: binaryPoints?.totalLeftPoints || 0,
      totalRightPoints: binaryPoints?.totalRightPoints || 0,

      // Recent minting clicks
      recentMintingClicks: recentMintingClicks.map((click) => ({
        clickTime: click.clickTime,
        profitEarned: click.profitEarned || 0,
        clickNumber: click.clickNumber,
        investedAmount: click.investedAmount,
        mintingType: click.mintingType,
      })),

      // Deposit history
      depositHistory: depositHistory.map((deposit) => ({
        id: deposit._id,
        coin: deposit.coin,
        chain: deposit.chain,
        amount: deposit.amount,
        status: deposit.status,
        txHash: deposit.txHash,
        date: deposit.createdAt,
      })),

      // Withdraw history
      withdrawHistory: withdrawHistory.map((withdrawal) => ({
        id: withdrawal._id,
        amount: withdrawal.amount,
        netAmount: withdrawal.amount2,
        paymentMethod: withdrawal.paymentMethod,
        payoutAddress: withdrawal.payoutAddress,
        status: withdrawal.status,
        fees: withdrawal.feeInfo,
        date: withdrawal.createdAt,
      })),

      // Top performers
      topPerformer,

      // Bought packages list
      boughtPackagesList: boughtPackages.map((investment) => ({
        _id: investment._id,
        amount: investment.amount,
        cryptoUsed: investment.cryptoUsed,
        txHash: investment.txHash,
        isMintingActive: investment.isMintingActive,
        mintingType: investment.mintingType,
        purchaseDate: investment.purchaseDate,
        hubPackage: {
          hubPrice: investment.hubPackage?.hubPrice,
          hubCapacity: investment.hubPackage?.hubCapacity,
          minimumMinting: investment.hubPackage?.minimumMinting,
        },
      })),

      // Rank info (from current user's rank)
      rankInfo: {
        rank: rank.rank || "No Rank",
      },
      mintingInsights,

      // Highest rank referred user
      highestRankReferredUser: highestRankReferredUser
        ? {
            _id: highestRankReferredUser._id,
            username: highestRankReferredUser.username,
            firstName: highestRankReferredUser.firstName,
            lastName: highestRankReferredUser.lastName,
            email: highestRankReferredUser.email,
            profileImg: highestRankReferredUser.profileImg,
            refferrCode: highestRankReferredUser.refferrCode,
            rankDetails: highestRankReferredUser.rankDetails,
          }
        : {},
    };

    return res.status(200).json({
      success: true,
      message: "Dashboard analytics retrieved successfully",
      data: dashboardData,
    });
  } catch (error) {
    console.error("Dashboard Analytics Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard analytics",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Helper function for highest rank referred user
const getHighestRankReferredUser = async (authUserReferralCode) => {
  try {
    const highestRankUser = await User.aggregate([
      {
        $match: {
          refferBy: authUserReferralCode,
        },
      },
      {
        $lookup: {
          from: "ranks",
          localField: "rank",
          foreignField: "_id",
          as: "rankDetails",
        },
      },
      {
        $unwind: {
          path: "$rankDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          rankDetails: { $exists: true, $ne: null },
        },
      },
      {
        $sort: {
          "rankDetails.sortOrder": -1,
          createdAt: 1,
        },
      },
      {
        $limit: 1,
      },
      {
        $project: {
          _id: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          profileImg: 1,
          refferrCode: 1,
          rankDetails: 1,
        },
      },
    ]);

    return highestRankUser.length > 0 ? highestRankUser[0] : null;
  } catch (error) {
    console.error("getHighestRankReferredUser error:", error);
    return null;
  }
};

exports.getRegistraions = async (req, res) => {
  try {
    const userId = await checkAuthorization(req, res);
    const { timeFrame } = req.body;

    const now = new Date();
    let startDate;

    switch (timeFrame) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "thisWeek":
        const firstDayOfWeek = now.getDate() - now.getDay();
        startDate = new Date(now.setDate(firstDayOfWeek));
        startDate.setHours(0, 0, 0, 0);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return res.status(400).json({ message: "Invalid time frame" });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const registeredUsers = await User.find({
      refferBy: currentUser.refferrCode,
      createdAt: { $gte: startDate },
    }).select("_id username firstName");

    const userIds = registeredUsers.map((u) => u._id);

    const placements = await BinaryPlacement.find({ userId: { $in: userIds } })
      .select("userId totalLeftPoints totalRightPoints")
      .populate("userId", "username firstName");

    const result = placements.map((p) => ({
      userId: p.userId._id,
      username: p.userId.username,
      firstName: p.userId.firstName,
      totalLeftPoints: p.totalLeftPoints,
      totalRightPoints: p.totalRightPoints,
    }));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getRegistrations:", error);
    return res.status(500).json({ message: "Failed to get: " + error.message });
  }
};
