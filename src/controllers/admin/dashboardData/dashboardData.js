const express = require("express");
const User = require("../../../models/auth");
const Withdrawal = require("../../../models/Withdrawal");
const Investment = require("../../../models/Investment");
const deposit = require("../../../models/deposit");

exports.AdminDashboardDataNew = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ roles: "User" });
    const totalActiveUsers = await User.countDocuments({
      status: "active",
      roles: "User",
    });

    const totalInactiveUsers = await User.countDocuments({
      status: "inactive",
      roles: "User",
    });

    const walletBalances = await User.aggregate([
      { $match: { roles: "User" } },
      { $group: { _id: null, total: { $sum: "$walletBalance" } } },
    ]);
    const totalWalletBalance = walletBalances[0]?.total || 0;

    const cryptoWallets = await User.aggregate([
      { $match: { roles: "User" } },
      { $group: { _id: null, total: { $sum: "$cryptoWallet" } } },
    ]);
    const totalCryptoWallet = cryptoWallets[0]?.total || 0;

    const currentBalances = await User.aggregate([
      {
        $match: { roles: "User", currentBalance: { $exists: true, $ne: null } },
      },
      { $group: { _id: null, total: { $sum: "$currentBalance" } } },
    ]);
    const totalcurrentBalances = currentBalances[0]?.total || 0;

    const pendingWithdrawals = await Withdrawal.find({ status: "pending" });
    const totalPendingWithdrawalAmount = pendingWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    );

    await Withdrawal.populate(pendingWithdrawals, {
      path: "userId",
      select: "username",
    });
    const pendingWithdrawalDetails = pendingWithdrawals.map((w) => ({
      ...w.toObject(),
      username: w.userId && w.userId.username ? w.userId.username : null,
    }));

    // Get today's date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayPackages = await Investment.find({
      purchaseDate: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    const todayDeposits = await deposit.find({
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    const todayWithdrawals = await Withdrawal.find({
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    const todayTotalDepositAmount = todayDeposits.reduce(
      (sum, d) => sum + d.amount,
      0
    );
    const todayTotalWithdrawalAmount = todayWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    );

    const totalApprovedWithdrawals = await Withdrawal.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalApprovedWithdrawalAmount = totalApprovedWithdrawals[0]?.total || 0;

    const totalPendingWithdrawals = await Withdrawal.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalPendingWithdrawalAmountAll = totalPendingWithdrawals[0]?.total || 0;

    res.json({
      totalUsers,
      totalActiveUsers,
      totalInactiveUsers,
      totalWalletBalance,
      totalCryptoWallet,
      totalcurrentBalances,
      totalPendingWithdrawalAmount, 
      pendingWithdrawalDetails,
      todayPackages,
      todayDeposits,
      todayTotalDepositAmount,
      totalApprovedWithdrawalAmount,
      totalPendingWithdrawalAmountAll,
      currentTime: now,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};
