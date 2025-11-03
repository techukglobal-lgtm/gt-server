// Transaction Controllers
const checkAuthorization = require("../../../middlewares/authMiddleware");
const User = require("../../../models/auth");
const Transaction = require("../../../models/Transaction");
const mongoose = require("mongoose");

// Create a new pending transaction
exports.createPendingTransaction = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { senderId, receiverId, amount, paymentMethod } = req.body;

    // Validate transaction - ensure one party is admin (0)
    if (senderId !== 0 && receiverId !== 0) {
      return res.status(400).json({
        success: false,
        message: "Either senderId or receiverId must be 0 (admin)",
      });
    }

    const transaction = new Transaction({
      senderId,
      receiverId,
      amount,
      paymentMethod,
      status: "pending",
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      data: transaction,
      message: "Transaction created and pending approval",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating transaction",
      error: error.message,
    });
  }
};

// Approve or reject a pending transaction
exports.updateTransactionStatus = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { transactionId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either approved or rejected",
      });
    }

    // If rejecting, reason is required
    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending transactions can be updated",
      });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update transaction status
      transaction.status = status;
      if (status === "rejected") {
        transaction.rejectionReason = rejectionReason;
      }

      // If approved and it's a deposit (user to admin)
      if (status === "approved" && transaction.receiverId === 0) {
        // This is a deposit from user to admin
        const user = await User.findOne({ _id: transaction.senderId }).session(
          session
        );

        if (!user) {
          throw new Error("User not found");
        }

        // Update user's wallet balance
        user.walletBalance += transaction.amount;
        await user.save({ session });
      }

      // If approved and it's a withdrawal (admin to user)
      if (status === "approved" && transaction.senderId === 0) {
        // This is a withdrawal from admin to user
        const user = await User.findOne({
          _id: transaction.receiverId,
        }).session(session);

        if (!user) {
          throw new Error("User not found");
        }

        // Ensure user has sufficient balance for withdrawal
        if (user.walletBalance < transaction.amount) {
          throw new Error("Insufficient balance for withdrawal");
        }

        // Update user's wallet balance
        user.walletBalance -= transaction.amount;
        await user.save({ session });
      }

      await transaction.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      res.status(200).json({
        success: true,
        data: transaction,
        message: `Transaction ${status} successfully`,
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating transaction status",
      error: error.message,
    });
  }
};

// Get all transactions
exports.getAllTransactions = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    // Extract query parameters for filtering (optional)
    const { status, senderId, receiverId, paymentMethod } = req.body;

    // Build filter object based on provided query parameters
    const filter = {};

    if (status) filter.status = status;
    if (senderId) filter.senderId = senderId;
    if (receiverId) filter.receiverId = receiverId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Find transactions with the applied filters
    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};
