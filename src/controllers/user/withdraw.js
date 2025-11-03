const checkAuthorization = require("../../middlewares/authMiddleware");
const User = require("../../models/auth");
const Withdrawal = require("../../models/Withdrawal");
const Transaction = require("../../models/Transaction"); // Add this import

exports.createWithdrawRequest = async (req, res) => {
  try {
    const userId = await checkAuthorization(req, res);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }
    const { amount, payoutAddress, deductedFrom } = req.body;

    if (!amount || !payoutAddress || !deductedFrom) {
      return res.status(400).json({ success: false, message: "Amount, address and deductedFrom are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // ✅ Minimum withdrawal limit
    if (numericAmount < 25) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal amount is $25" });
    }

    // ✅ Balance check
    if (numericAmount > user.cryptoWallet) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    // 🧮 Calculate 6% fee
    const fee = (numericAmount * 6) / 100;
    const netAmount = numericAmount - fee;

    // ✅ Deduct balance atomically
    if (deductedFrom === "walletBalance") {
      user.walletBalance = Number((user.walletBalance - netAmount).toFixed(2));
    } else if (deductedFrom === "cryptoWallet") {
      user.cryptoWallet = Number((user.cryptoWallet - numericAmount).toFixed(2));
    } else {
      return res.status(400).json({ success: false, message: "Invalid deductedFrom value" });
    }
    await user.save();

    // ✅ Create withdrawal record
    const withdrawal = await Withdrawal.create({
      userId,
      amount: numericAmount,
      amount2: netAmount,
      paymentMethod: "BEP20",
      deductedFrom: deductedFrom,
      payoutAddress,
      status: "pending",
      feeInfo: {
        percentageFee: 6,
        totalFees: fee,
      },
    });

    // ✅ Create related transaction record
    await Transaction.create({
      senderId: userId, // user is sender
      receiverId: 0, // admin/system is receiver
      amount: numericAmount,
      paymentMethod: "BEP20",
      transactionType: "withdrawal_request",
      status: "pending",
      withdrawalDetails: {
        withdrawalId: withdrawal._id,
        payoutAddress,
        feeInfo: {
          percentageFee: 6,
          totalFees: fee,
        },
        grossAmount: numericAmount,
        netAmount,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: withdrawal,
    });
  } catch (err) {
    console.error("Withdraw Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getAllWithdrawals = async (req, res) => {
  try {
    // Populate userId to get username from User model
    const withdrawals = await Withdrawal.find().populate({
      path: "userId",
      select: "username",
    });

    const withdrawalsWithUsername = withdrawals.map((w) => ({
      ...w.toObject(),
      username: w.userId && w.userId.username ? w.userId.username : null,
    }));

    return res.status(200).json({
      success: true,
      data: withdrawalsWithUsername,
    });
  } catch (error) {
    console.error("Get withdrawals error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching withdrawals.",
    });
  }
};

exports.getUserWithdrawals = async (req, res) => {
  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    // Fetch withdrawals for the user
    const withdrawals = await Withdrawal.find({
      userId: authuser,
    });

    return res.status(200).json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
    console.error("Get user withdrawals error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching user withdrawals.",
    });
  }
};

exports.updateWithdrawalStatus = async (req, res) => {
  const { status, withdrawalId, rejectionReason, deductedFrom } = req.body;

  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    if (!withdrawalId || !status) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal ID and status are required.",
      });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found.",
      });
    }

    const user = await User.findById(withdrawal.userId);

    // Handle rejection - refund balance
    if (status === "rejected" && withdrawal.status !== "rejected") {
      if (user) {
        if (deductedFrom === "walletBalance") {
          user.walletBalance += parseFloat(withdrawal.amount2);
        } else if (deductedFrom === "cryptoWallet") {
          user.cryptoWallet += parseFloat(withdrawal.amount);
        }
        await user.save();
      }

      // Create refund transaction
      const refundTransaction = new Transaction({
        senderId: 0, // Admin
        receiverId: withdrawal.userId,
        amount: withdrawal.amount,
        paymentMethod: "SYSTEM",
        transactionType: "withdrawal_refund",
        status: "completed",
        withdrawalDetails: {
          withdrawalId: withdrawal._id,
          payoutAddress: withdrawal.payoutAddress,
          feeInfo: withdrawal.feeInfo,
          netAmount: withdrawal.amount2,
          grossAmount: withdrawal.amount,
        },
        rejectionReason: rejectionReason || "Withdrawal request rejected",
      });

      await refundTransaction.save();

      // Create rejection transaction
      const rejectionTransaction = new Transaction({
        senderId: withdrawal.userId,
        receiverId: 0, // Admin
        amount: withdrawal.amount,
        paymentMethod: withdrawal.paymentMethod,
        transactionType: "withdrawal_rejected",
        status: "rejected",
        withdrawalDetails: {
          withdrawalId: withdrawal._id,
          payoutAddress: withdrawal.payoutAddress,
          feeInfo: withdrawal.feeInfo,
          netAmount: withdrawal.amount2,
          grossAmount: withdrawal.amount,
        },
        rejectionReason: rejectionReason || "Withdrawal request rejected",
      });

      await rejectionTransaction.save();
    }

    // Handle approval
    if (status === "approved" && withdrawal.status !== "approved") {
      const approvalTransaction = new Transaction({
        senderId: withdrawal.userId,
        receiverId: 0, // Admin
        amount: withdrawal.amount,
        paymentMethod: withdrawal.paymentMethod,
        transactionType: "withdrawal_approved",
        status: "completed",
        withdrawalDetails: {
          withdrawalId: withdrawal._id,
          payoutAddress: withdrawal.payoutAddress,
          feeInfo: withdrawal.feeInfo,
          netAmount: withdrawal.amount2,
          grossAmount: withdrawal.amount,
        },
      });

      await approvalTransaction.save();
    }

    // Update withdrawal status
    withdrawal.status = status;
    await withdrawal.save();

    return res.status(200).json({
      success: true,
      message: "Withdrawal status updated successfully.",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Update withdrawal status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating withdrawal status.",
    });
  }
};

exports.deleteWithdrawal = async (req, res) => {
  const { withdrawalId } = req.body;

  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    if (!withdrawalId) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal ID is required.",
      });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found.",
      });
    }

    // Delete related transactions
    await Transaction.deleteMany({
      "withdrawalDetails.withdrawalId": withdrawalId,
    });

    // Delete withdrawal
    await Withdrawal.findByIdAndDelete(withdrawalId);

    return res.status(200).json({
      success: true,
      message: "Withdrawal and related transactions deleted successfully.",
    });
  } catch (error) {
    console.error("Delete withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting withdrawal.",
    });
  }
};
