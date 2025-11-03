const User = require("../../../models/auth");
const Withdrawal = require("../../../models/Withdrawal");
const Competition = require("../../../models/Competetion");
const Order = require("../../../models/Order");
const checkAuthorization = require("../../../middlewares/authMiddleware");
const Transaction = require("../../../models/Transaction");

/**
 * Get admin dashboard data including:
 * 1. Monthly user signups and total users (excluding admins)
 * 2. Ticket sales based on selected timespan (hourly/daily/weekly/monthly)
 * 3. Pending withdrawals with timespan data and user info
 * 4. 5 recent active competitions
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with dashboard data
 */
exports.getAdminDashboardData = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Get the selected timespan from request body
    const timespan = req.body.selectedOption || "daily"; // Default to daily if not provided

    // Get date boundaries based on selected timespan
    const { startDate, endDate } = getDateRangeForTimespan(timespan);

    // 1. Get user signups data based on timespan and total users (excluding admins)
    const userSignups = await getUserSignupsByTimespan(timespan);
    const totalUsers = await User.countDocuments({ roles: { $ne: "Admin" } });

    // 2. Get ticket sales based on timespan
    const recentOrders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    const ticketSalesData = await getTicketSalesByTimespan(
      timespan,
      startDate,
      endDate
    );

    const buyerDetails = recentOrders.map((order) => ({
      name: `${order.firstName} ${order.lastName}`,
      email: order.email,
      ticketsPurchased: order.ticketQuantity,
      value: order.totalCost,
      time: order.createdAt,
    }));

    // 3. Get pending withdrawals with timespan data and user details
    const pendingWithdrawals = await Withdrawal.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(5);

    const withdrawalsData = await getWithdrawalsByTimespan(
      timespan,
      startDate,
      endDate
    );

    // Get user details for pending withdrawals
    const withdrawalDetails = await Promise.all(
      pendingWithdrawals.map(async (withdrawal) => {
        const user = await User.findOne({ _id: withdrawal.userId });
        return {
          username: user ? user.username : "Unknown",
          email: user ? user.email : "Unknown",
          amount: withdrawal.amount,
          paymentMethod: withdrawal.paymentMethod,
          payoutAddress: withdrawal.payoutAddress,
          time: withdrawal.createdAt,
        };
      })
    );

    // 4. Get 5 recent active competitions
    const activeCompetitions = await Competition.find({
      isPublished: true,
      endDateTime: { $gte: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        users: {
          monthlySignups: userSignups,
          totalUsers,
        },
        ticketsSold: {
          hourlyData: ticketSalesData,
          buyerDetails,
        },
        withdrawals: {
          hourlyData: withdrawalsData,
          pendingDetails: withdrawalDetails,
        },
        activeCompetitions,
      },
    });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
  }
};
exports.getAllWalletsData = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Aggregate all user wallet data
    const walletAggregation = await User.aggregate([
      {
        $group: {
          _id: null,
          totalWalletBalance: { $sum: "$walletBalance" },
          totalCommissionEarned: { $sum: "$commissionEarned" },
          totalCommissionLocked: { $sum: "$commissionLocked" },
          totalCommissionWithdrawable: { $sum: "$commissionWithdrawable" },
          totalPendingCommissions: { $sum: "$pendingCommissions" },
          totalUsers: { $sum: 1 },
        },
      },
    ]);

    // Get USDT transactions (Master wallet)
    const usdtTransactions = await Transaction.aggregate([
      {
        $match: {
          paymentMethod: { $in: ["USDT", "USDC"] },
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          totalUSDTIn: {
            $sum: {
              $cond: [
                { $eq: ["$receiverId", 0] }, // Admin is receiver
                "$amount",
                0,
              ],
            },
          },
          totalUSDTOut: {
            $sum: {
              $cond: [
                { $eq: ["$senderId", 0] }, // Admin is sender
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get PayPal transactions
    const paypalTransactions = await Transaction.aggregate([
      {
        $match: {
          paymentMethod: "paypal",
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          totalPayPalIn: {
            $sum: {
              $cond: [
                { $eq: ["$receiverId", 0] }, // Admin is receiver
                "$amount",
                0,
              ],
            },
          },
          totalPayPalOut: {
            $sum: {
              $cond: [
                { $eq: ["$senderId", 0] }, // Admin is sender
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get total orders value for additional context
    const ordersData = await Order.aggregate([
      {
        $match: {
          paymentStatus: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalOrdersValue: { $sum: "$totalCost" },
          totalTicketsSold: { $sum: "$ticketQuantity" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    // Extract aggregated data
    const walletData = walletAggregation[0] || {
      totalWalletBalance: 0,
      totalCommissionEarned: 0,
      totalCommissionLocked: 0,
      totalCommissionWithdrawable: 0,
      totalPendingCommissions: 0,
      totalUsers: 0,
    };

    const usdtData = usdtTransactions[0] || {
      totalUSDTIn: 0,
      totalUSDTOut: 0,
    };

    const paypalData = paypalTransactions[0] || {
      totalPayPalIn: 0,
      totalPayPalOut: 0,
    };

    const orderData = ordersData[0] || {
      totalOrdersValue: 0,
      totalTicketsSold: 0,
      totalOrders: 0,
    };

    // Calculate balances
    const masterWalletUSDT = usdtData.totalUSDTIn - usdtData.totalUSDTOut;
    const paypalWallet = paypalData.totalPayPalIn - paypalData.totalPayPalOut;
    const totalAvailableWallet = walletData.totalCommissionWithdrawable;
    const totalReserveWallet = walletData.totalCommissionLocked;
    const win4LuxTotalWallet = walletData.totalWalletBalance;

    // Prepare response data
    const walletsData = {
      // 1. Master wallet with all USDT
      masterWallet: {
        currency: "USDT",
        balance: masterWalletUSDT,
        totalIn: usdtData.totalUSDTIn,
        totalOut: usdtData.totalUSDTOut,
        description: "Master wallet containing all USDT/USDC funds",
      },

      // 2. PayPal wallet
      paypalWallet: {
        currency: "USD",
        balance: paypalWallet,
        totalIn: paypalData.totalPayPalIn,
        totalOut: paypalData.totalPayPalOut,
        description: "PayPal wallet for fiat transactions",
      },

      // 3. Total available wallet (Lux Points) commission unlocked
      totalAvailableWallet: {
        currency: "Lux Points",
        balance: totalAvailableWallet,
        description: "Total withdrawable commission across all users",
      },

      // 4. Total reserve wallet (Lux Points) commission locked
      totalReserveWallet: {
        currency: "Lux Points",
        balance: totalReserveWallet,
        description: "Total locked commission across all users",
      },

      // 5. Win4Lux available wallet locked + unlocked
      win4LuxWallet: {
        currency: "Lux Points",
        totalBalance: win4LuxTotalWallet,
        availableBalance: totalAvailableWallet,
        lockedBalance: totalReserveWallet,
        pendingCommissions: walletData.totalPendingCommissions,
        description: "Combined user wallet balances (locked + unlocked)",
      },

      // Summary statistics
      summary: {
        totalUsers: walletData.totalUsers,
        totalCommissionEarned: walletData.totalCommissionEarned,
        totalOrdersValue: orderData.totalOrdersValue,
        totalTicketsSold: orderData.totalTicketsSold,
        totalOrders: orderData.totalOrders,
      },

      // Wallet health indicators
      healthIndicators: {
        commissionRatio:
          walletData.totalCommissionEarned > 0
            ? (
                (walletData.totalCommissionWithdrawable /
                  walletData.totalCommissionEarned) *
                100
              ).toFixed(2) + "%"
            : "0%",
        lockedRatio:
          walletData.totalCommissionEarned > 0
            ? (
                (walletData.totalCommissionLocked /
                  walletData.totalCommissionEarned) *
                100
              ).toFixed(2) + "%"
            : "0%",
        averageWalletBalance:
          walletData.totalUsers > 0
            ? (walletData.totalWalletBalance / walletData.totalUsers).toFixed(2)
            : 0,
      },
    };

    return res.status(200).json({
      success: true,
      message: "Wallet data retrieved successfully",
      data: walletsData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching wallet data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
/**
 * Helper function to determine date range based on timespan
 * @param {string} timespan - Selected timespan (hourly, daily, last week, monthly)
 * @returns {Object} Object containing start and end dates
 */
function getDateRangeForTimespan(timespan) {
  const now = new Date();
  let startDate, endDate;

  switch (timespan) {
    case "hourly":
      // Last 24 hours
      startDate = new Date(now);
      startDate.setHours(now.getHours() - 24);
      endDate = new Date(now);
      break;

    case "daily":
      // Today
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "last week":
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      // Current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now);
      break;

    default:
      // Default to today
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

/**
 * Helper function to get user signups based on timespan
 * @param {string} timespan - Selected timespan (hourly, daily, last week, monthly)
 * @returns {Array} User signup data based on timespan
 */
async function getUserSignupsByTimespan(timespan) {
  const currentYear = new Date().getFullYear();
  const now = new Date();

  if (timespan === "monthly") {
    // Return monthly data for the current year (original functionality)
    return await getUserSignupsByMonth();
  } else if (timespan === "last week") {
    // Last 7 days grouped by day
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const dailyData = await User.aggregate([
      {
        $match: {
          roles: { $ne: "Admin" },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Create array of past 7 days
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      result.push({
        month: dayName, // Use day name as month field to maintain response structure
        count: 0,
      });
    }

    // Fill in data where it exists
    dailyData.forEach((item) => {
      const date = new Date(
        now.getFullYear(),
        item._id.month - 1,
        item._id.day
      );
      const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      if (daysAgo < 7) {
        result[6 - daysAgo].count = item.count;
      }
    });

    return result;
  } else if (timespan === "daily" || timespan === "hourly") {
    // Hourly data for today/yesterday
    const { startDate, endDate } = getDateRangeForTimespan(timespan);

    const hourlyData = await User.aggregate([
      {
        $match: {
          roles: { $ne: "Admin" },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { hour: { $hour: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.hour": 1 },
      },
    ]);

    // Format to include all hours (24 or 24 hours depending on timespan)
    const hours = timespan === "hourly" ? 24 : 24;
    const result = Array(hours)
      .fill()
      .map((_, i) => ({
        month: `${i}:00`, // Use hour as month field to maintain response structure
        count: 0,
      }));

    hourlyData.forEach((item) => {
      const hourIndex = item._id.hour;
      if (hourIndex < hours) {
        result[hourIndex].count = item.count;
      }
    });

    return result;
  }

  // Default to monthly data
  return await getUserSignupsByMonth();
}

/**
 * Helper function to get monthly user signups
 * @returns {Array} Array of monthly user signup counts
 */
async function getUserSignupsByMonth() {
  const currentYear = new Date().getFullYear();

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Aggregate monthly signup counts
  const monthlyData = await User.aggregate([
    {
      $match: {
        roles: { $ne: "Admin" },
        createdAt: { $gte: new Date(currentYear, 0, 1) },
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.month": 1 },
    },
  ]);

  // Initialize result with all months
  const result = monthNames.map((name) => ({ month: name, count: 0 }));

  // Replace counts where data exists
  monthlyData.forEach((item) => {
    const index = item._id.month - 1; // months are 1-indexed in Mongo
    result[index].count = item.count;
  });

  return result;
}

/**
 * Helper function to get ticket sales data based on timespan
 * @param {string} timespan - Selected timespan
 * @param {Date} startDate - Start date for the range
 * @param {Date} endDate - End date for the range
 * @returns {Array} Ticket sales data
 */
async function getTicketSalesByTimespan(timespan, startDate, endDate) {
  let groupBy, sortBy, labels;

  if (timespan === "hourly") {
    // Group by hour
    groupBy = { hour: { $hour: "$createdAt" } };
    sortBy = { "_id.hour": 1 };
    labels = Array(24)
      .fill()
      .map((_, i) => ({ hour: i, count: 0, revenue: 0 }));
  } else if (timespan === "daily") {
    // Group by hour (for today)
    groupBy = { hour: { $hour: "$createdAt" } };
    sortBy = { "_id.hour": 1 };
    labels = Array(24)
      .fill()
      .map((_, i) => ({ hour: i, count: 0, revenue: 0 }));
  } else if (timespan === "last week") {
    // Group by day
    groupBy = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
    };
    sortBy = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };

    // Create array for past 7 days
    labels = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push({
        hour: date.toLocaleDateString("en-US", { weekday: "short" }),
        count: 0,
        revenue: 0,
      });
    }
  } else if (timespan === "monthly") {
    // Group by month
    groupBy = { month: { $month: "$createdAt" } };
    sortBy = { "_id.month": 1 };

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    labels = monthNames.map((month) => ({ hour: month, count: 0, revenue: 0 }));
  }

  // Perform the aggregation
  const aggregatedData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: groupBy,
        count: { $sum: "$ticketQuantity" },
        revenue: { $sum: "$totalCost" },
      },
    },
    {
      $sort: sortBy,
    },
  ]);

  // Map the results to the labels
  if (timespan === "hourly" || timespan === "daily") {
    // Hourly mapping
    aggregatedData.forEach((item) => {
      const hourIndex = item._id.hour;
      if (hourIndex < 24) {
        labels[hourIndex] = {
          hour: hourIndex,
          count: item.count,
          revenue: item.revenue,
        };
      }
    });
  } else if (timespan === "last week") {
    // Daily mapping for last week
    const now = new Date();
    aggregatedData.forEach((item) => {
      const date = new Date(
        now.getFullYear(),
        item._id.month - 1,
        item._id.day
      );
      const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      if (daysAgo < 7) {
        labels[6 - daysAgo] = {
          hour: labels[6 - daysAgo].hour, // Keep the weekday name
          count: item.count,
          revenue: item.revenue,
        };
      }
    });
  } else if (timespan === "monthly") {
    // Monthly mapping
    aggregatedData.forEach((item) => {
      const monthIndex = item._id.month - 1; // months are 1-indexed in Mongo
      if (monthIndex >= 0 && monthIndex < 12) {
        labels[monthIndex] = {
          hour: labels[monthIndex].hour, // Keep the month name
          count: item.count,
          revenue: item.revenue,
        };
      }
    });
  }

  return labels;
}

/**
 * Helper function to get withdrawal data based on timespan
 * @param {string} timespan - Selected timespan
 * @param {Date} startDate - Start date for the range
 * @param {Date} endDate - End date for the range
 * @returns {Array} Withdrawal data
 */
async function getWithdrawalsByTimespan(timespan, startDate, endDate) {
  let groupBy, sortBy, labels;

  if (timespan === "hourly") {
    // Group by hour
    groupBy = { hour: { $hour: "$createdAt" } };
    sortBy = { "_id.hour": 1 };
    labels = Array(24)
      .fill()
      .map((_, i) => ({ hour: i, count: 0, totalAmount: 0 }));
  } else if (timespan === "daily") {
    // Group by hour (for today)
    groupBy = { hour: { $hour: "$createdAt" } };
    sortBy = { "_id.hour": 1 };
    labels = Array(24)
      .fill()
      .map((_, i) => ({ hour: i, count: 0, totalAmount: 0 }));
  } else if (timespan === "last week") {
    // Group by day
    groupBy = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
    };
    sortBy = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };

    // Create array for past 7 days
    labels = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push({
        hour: date.toLocaleDateString("en-US", { weekday: "short" }),
        count: 0,
        totalAmount: 0,
      });
    }
  } else if (timespan === "monthly") {
    // Group by month
    groupBy = { month: { $month: "$createdAt" } };
    sortBy = { "_id.month": 1 };

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    labels = monthNames.map((month) => ({
      hour: month,
      count: 0,
      totalAmount: 0,
    }));
  }

  // Perform the aggregation
  const aggregatedData = await Withdrawal.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: "pending",
      },
    },
    {
      $group: {
        _id: groupBy,
        count: { $sum: 1 },
        totalAmount: { $sum: { $toDouble: "$amount" } },
      },
    },
    {
      $sort: sortBy,
    },
  ]);

  // Map the results to the labels
  if (timespan === "hourly" || timespan === "daily") {
    // Hourly mapping
    aggregatedData.forEach((item) => {
      const hourIndex = item._id.hour;
      if (hourIndex < 24) {
        labels[hourIndex] = {
          hour: hourIndex,
          count: item.count,
          totalAmount: item.totalAmount,
        };
      }
    });
  } else if (timespan === "last week") {
    // Daily mapping for last week
    const now = new Date();
    aggregatedData.forEach((item) => {
      const date = new Date(
        now.getFullYear(),
        item._id.month - 1,
        item._id.day
      );
      const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      if (daysAgo < 7) {
        labels[6 - daysAgo] = {
          hour: labels[6 - daysAgo].hour, // Keep the weekday name
          count: item.count,
          totalAmount: item.totalAmount,
        };
      }
    });
  } else if (timespan === "monthly") {
    // Monthly mapping
    aggregatedData.forEach((item) => {
      const monthIndex = item._id.month - 1; // months are 1-indexed in Mongo
      if (monthIndex >= 0 && monthIndex < 12) {
        labels[monthIndex] = {
          hour: labels[monthIndex].hour, // Keep the month name
          count: item.count,
          totalAmount: item.totalAmount,
        };
      }
    });
  }

  return labels;
}
