const Transaction = require("../../models/Transaction");
const mongoose = require("mongoose");
const Withdrawal = require("../../models/Withdrawal");
const checkAuthorization = require("../../middlewares/authMiddleware");

const getTransactionReports = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { transactionType, userId } = req.body;

    // Validate transaction type
    const validTransactionTypes = [
      "purchase",
      "withdrawal",
      "referral_bonus",
      "direct_referral_bonus",
      "auto-purchase",
      "refund",
      "all",
    ];
    if (!validTransactionTypes.includes(transactionType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid transaction type. Valid types are: purchase, withdrawal, referral_bonus, direct_referral_bonus, or all",
      });
    }

    // Validate userId
    if (!userId || (userId !== "0" && !mongoose.isValidObjectId(userId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Create filter object
    const filter = {};

    // Add userId to filter (as either sender or receiver)
    if (userId === "0") {
      // Admin transactions (either as sender or receiver)
      filter["$or"] = [{ senderId: 0 }, { receiverId: 0 }];
    } else {
      // User transactions (either as sender or receiver)
      // Fix: Convert string userId to ObjectId for proper comparison
      const userIdObject = new mongoose.Types.ObjectId(userId);

      filter["$or"] = [
        // Include both possible formats for sender/receiver
        { senderId: userId }, // String format
        { senderId: userIdObject }, // ObjectId format
        { receiverId: userId }, // String format
        { receiverId: userIdObject }, // ObjectId format
      ];
    }

    // Add transaction type to filter if not "all"
    if (transactionType !== "all") {
      filter.transactionType = transactionType;
    }

    // Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1 })
      .lean();

    // Generate summary statistics
    const summary = {
      totalTransactions: transactions.length,
      totalAmount: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      byPaymentMethod: {},
      recentActivity: transactions.slice(0, 5),
    };

    // Calculate statistics
    transactions.forEach((transaction) => {
      summary.totalAmount += transaction.amount;

      // Count by status
      summary[transaction.status]++;

      // Count by payment method
      if (!summary.byPaymentMethod[transaction.paymentMethod]) {
        summary.byPaymentMethod[transaction.paymentMethod] = {
          count: 0,
          amount: 0,
        };
      }
      summary.byPaymentMethod[transaction.paymentMethod].count++;
      summary.byPaymentMethod[transaction.paymentMethod].amount +=
        transaction.amount;
    });

    // Return response
    return res.status(200).json({
      success: true,
      summary,
      transactions,
    });
  } catch (error) {
    console.error("Error in getTransactionReports:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching transaction reports",
      error: error.message,
    });
  }
};

const getUserTransactionSummary = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    const idQuery = {
      $or: [{ receiverId: userId }],
    };

    if (userObjectId) {
      idQuery.$or.push({ receiverId: userObjectId });
    }

    // 1. Referral Bonus
    const referralBonus = await Transaction.aggregate([
      {
        $match: {
          ...idQuery,
          transactionType: "referral_bonus",
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // 2. Level Bonus
    const levelBonus = await Transaction.aggregate([
      {
        $match: {
          ...idQuery,
          transactionType: "direct_referral_bonus",
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // 3. Completed Withdrawals
    let completedPayouts;
    try {
      completedPayouts = await Withdrawal.aggregate([
        {
          $match: {
            userId,
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $convert: { input: "$amount", to: "double", onError: 0 },
              },
            },
          },
        },
      ]);
    } catch {
      completedPayouts = await Withdrawal.aggregate([
        {
          $match: {
            userId,
            status: "Completed",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]);
    }

    const referralBonusAmount =
      referralBonus.length > 0 ? referralBonus[0].total : 0;
    const levelBonusAmount = levelBonus.length > 0 ? levelBonus[0].total : 0;
    const completedPayoutsAmount =
      completedPayouts.length > 0 ? completedPayouts[0].total : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalReferralBonus: referralBonusAmount,
        totalLevelBonus: levelBonusAmount,
        totalCompletedPayouts: completedPayoutsAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching user transaction summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { getUserTransactionSummary };

module.exports = {
  getTransactionReports,
  getUserTransactionSummary,
};
