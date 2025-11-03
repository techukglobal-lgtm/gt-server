const checkAuthorization = require("../../middlewares/authMiddleware");
const User = require("../../models/auth");
// const Setting = require("../../models/Setting");
const Withdrawal = require("../../models/Withdrawal");

exports.createWithdrawal = async (req, res) => {
  const { amount, paymentMethod, payoutAddress } = req.body;
  const authuser = await checkAuthorization(req, res);

  if (!authuser) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
    });
  }

  if (!amount || !paymentMethod || !payoutAddress) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (amount, paymentMethod, payoutAddress) are required.",
    });
  }

  try {
    const user = await User.findById(authuser);

    if (!user?.isKycVerified) {
      return res.status(403).json({
        success: false,
        message: "KYC verification is required for withdrawal.",
      });
    }

    const settings = await Setting.findOne();
    if (!settings || !settings.isWithdrawalEnabled) {
      return res.status(403).json({
        success: false,
        message: "Withdrawals are currently disabled.",
      });
    }

    const numericAmount = parseFloat(amount);

    if (numericAmount > user.commissionWithdrawable) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal amount exceeds your withdrawable commission.",
      });
    }

    const withdrawalFee = settings.withdrawalFee || 0;
    const feeAmount = (numericAmount * withdrawalFee) / 100;
    const finalAmount = numericAmount - feeAmount;

    user.commissionWithdrawable -= numericAmount;
    user.walletBalance -= numericAmount;
    user.commissionEarned -= numericAmount; // since it's same as walletBalance

    await user.save();

    const newWithdrawal = new Withdrawal({
      userId: authuser,
      amount: finalAmount,
      amount2: numericAmount,
      paymentMethod,
      payoutAddress,
      status: "pending",
    });

    await newWithdrawal.save();

    res.status(201).json({
      success: true,
      message: "Withdrawal request created successfully.",
      data: newWithdrawal,
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to create withdrawal request.",
    });
  }
};

exports.updateWithdrawalStatus = async (req, res) => {
  const { id, status, amount, reason } = req.body;

  if (!id || !status || !amount) {
    return res.status(400).json({
      success: false,
      message: "id, status, and amount are required.",
    });
  }

  try {
    const withdrawal = await Withdrawal.findOne({ _id: id });
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found.",
      });
    }

    const user = await User.findById(withdrawal.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const numericAmount = parseFloat(amount);
    withdrawal.status = status;
    withdrawal.reason = reason || "";

    if (status === "rejected") {
      user.commissionWithdrawable += numericAmount;
      user.walletBalance += numericAmount;
      user.commissionEarned += numericAmount;
    }

    await withdrawal.save();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Withdrawal status updated successfully.",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to update withdrawal status.",
    });
  }
};

exports.getUserWithdrawals = async (req, res) => {
  const authuser = await checkAuthorization(req, res);
  if (!authuser) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
    });
  }

  try {
    const user = await User.findById(authuser);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let withdrawals;

    if (user.roles && user.roles.includes("Admin")) {
      withdrawals = await Withdrawal.find();
    } else {
      withdrawals = await Withdrawal.find({ userId: authuser });
    }

    res.status(200).json({
      success: true,
      message: "User withdrawals fetched successfully.",
      data: withdrawals,
    });
  } catch (error) {
    console.error("Error fetching user withdrawals:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to fetch user withdrawals.",
    });
  }
};
