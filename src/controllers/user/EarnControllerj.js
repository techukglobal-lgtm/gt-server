const Deposit = require("../../models/deposit");
const User = require("../../models/auth");
const ProfitClaim = require("../../models/profitClaim");
const Transaction = require("../../models/Transaction");
const mongoose = require("mongoose");
const MiningSession = require("../../models/MiningSession");
const checkAuthorization = require("../../middlewares/authMiddleware");
const {
  default: dailyCommissionSettings,
} = require("../../models/dailyCommissionSettings");

exports.claimDailyProfit = async (req, res) => {
  try {
    const userId = await checkAuthorization(req, res);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Find approved deposits
    const deposits = await Deposit.find({ userId, status: "approved" });
    if (!deposits.length) {
      return res
        .status(400)
        .json({ success: false, message: "No approved deposits found" });
    }

    // 2. Calculate total investment
    const totalDeposit = deposits.reduce((sum, dep) => sum + dep.amount, 0);

    // 3. Get existing mining session if any
    let session = await MiningSession.findOne({ userId });

    const now = Date.now();

    if (session && session.nextMineTime > now) {
      // Still under cooldown
      const hoursLeft = (session.nextMineTime - now) / (1000 * 60 * 60);
      return res.status(400).json({
        success: false,
        message: `You can mine again after ${Math.ceil(hoursLeft)} hours.`,
      });
    }
    const user = await User.findById(userId);

    // 4️⃣ Fetch commission range dynamically from DB
    const settingsDoc = await dailyCommissionSettings.findOne({
      keyname: "Daily Commission Settings",
    });

    if (!settingsDoc) {
      return res
        .status(500)
        .json({ success: false, message: "Commission settings not found" });
    }

    const { startingLevel, endingLevel } = settingsDoc.value;

    // ✅ Ensure they’re valid numbers
    const start = Number(startingLevel) / 100;
    const end = Number(endingLevel) / 100;

    if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0 || end < start) {
      return res.status(500).json({
        success: false,
        message: "Invalid commission range in settings",
      });
    }

    // 5️⃣ Calculate random profit between start% and end%
    const randomPercentage = start + Math.random() * (end - start);

    const profit = user.walletBalance * randomPercentage;

    // 5. Update user's wallet
    user.cryptoWallet += profit;
    await user.save();

    // 6. Record Profit Claim
    const newClaim = await ProfitClaim.create({
      userId,
      depositId: deposits[0]._id,
      profitAmount: profit,
    });

    // 7. Add Transaction
    await Transaction.create({
      senderId: 0,
      receiverId: userId,
      amount: profit,
      paymentMethod: "System",
      transactionType: "mining_earning",
      note: `${user.username} mined $${profit}`,
      status: "completed",
      transactionDate: new Date(),
    });

    // 8. Create/Update Mining Session (24h cooldown)
    const nextMineTime = now + 24 * 60 * 60 * 1000;
    if (session) {
      session.lastMineTime = now;
      session.nextMineTime = nextMineTime;
      await session.save();
    } else {
      await MiningSession.create({
        userId,
        lastMineTime: now,
        nextMineTime,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully mined $${profit.toFixed(
        2
      )}. Next mining available in 24h.`,
      profit,
      newWalletBalance: user.walletBalance,
      nextMineTime,
    });
  } catch (error) {
    console.error("Error in claimDailyProfit:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getMiningStatus = async (req, res) => {
  try {
    const userId = await checkAuthorization(req, res);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Check if mining session exists
    const session = await MiningSession.findOne({ userId });

    if (!session) {
      // No mining yet
      return res.json({
        success: true,
        active: false,
        remainingTime: 0,
        lastMineTime: null,
      });
    }

    const now = Date.now();
    const remaining = Math.max(0, session.nextMineTime - now);

    res.json({
      success: true,
      active: remaining > 0,
      remainingTime: remaining,
      lastMineTime: session.lastMineTime,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getProfitHistory = async (req, res) => {
  try {
    const userId = await checkAuthorization(req, res);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const profitHistory = await ProfitClaim.find({ userId });
    // console.log(profitHistory);

    res.json({
      success: true,
      data: profitHistory,
      message: "Profit History Fetched",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
