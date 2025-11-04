// Transaction controller with refactored functionality
const moment = require("moment");
const checkAuthorization = require("../../../middlewares/authMiddleware");
const User = require("../../../models/auth");
const Order = require("../../../models/Order");
// const Settings = require("../../../models/Setting");
const Transaction = require("../../../models/Transaction");
const { processAutoPurchaseRefund } = require("../Scheduled/AutoPurchase");
const BinaryPlacement = require("../../../models/BinarySchema");
const Rank = require("../../../models/Rank");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const { leftOrRightPoints, hasGreenID } = require("../../../helpers/functions");
const Deposit = require("../../../models/deposit");
const distributeMLMCommissions = require("../../../helpers/commissionController/commissionController");

const ObjectId = mongoose.Types.ObjectId;
exports.getTransactions = async (req, res) => {
  try {
    // 🔒 1. Check if user is authorized
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { status, type, page = 1, limit = 50 } = req.body;

    // 🧾 2. Validate user ID
    if (!mongoose.isValidObjectId(authUser)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    // 🎯 3. Build base filter
    const filter = {
      $or: [
        { senderId: authUser },
        { receiverId: authUser },
        { senderId: new ObjectId(authUser) },
        { receiverId: new ObjectId(authUser) },
      ],
    };

    if (type) filter.transactionType = type;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 📦 4. Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Transaction.countDocuments(filter);

    // 💰 5. Collect all deposit IDs
    const depositIds = transactions
      .filter(
        (tx) => tx.transactionType === "deposit" && tx.depositDetails?.depositId
      )
      .map((tx) => tx.depositDetails.depositId);

    // 🏦 6. Fetch all deposits and map them
    let depositMap = {};
    if (depositIds.length > 0) {
      const deposits = await Deposit.find({ _id: { $in: depositIds } }).lean();
      depositMap = deposits.reduce((acc, dep) => {
        acc[dep._id.toString()] = dep;
        return acc;
      }, {});
    }

    // 👥 7. Collect all related user IDs
    const userIds = new Set();
    transactions.forEach((tx) => {
      const sId = tx.senderId?.toString?.();
      const rId = tx.receiverId?.toString?.();

      if (sId !== "0" && sId !== "system" && sId !== authUser) {
        userIds.add(sId);
      }
      if (rId !== "0" && rId !== "system" && rId !== authUser) {
        userIds.add(rId);
      }
    });

    userIds.add(authUser);

    const validIds = Array.from(userIds).filter((id) =>
      mongoose.isValidObjectId(id)
    );

    const users = await User.find({ _id: { $in: validIds } }).select(
      "_id name email username profileImage"
    );

    // 👤 8. Create user lookup map
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = {
        name: user.name || user.username || "Unknown User",
        email: user.email,
        profileImage: user.profileImg || null,
      };
    });

    // 🔄 9. Enrich transactions with user & deposit details
    const enrichedTransactions = transactions.map((tx) => {
      const txObj = tx.toObject();
      const sender = tx.senderId?.toString?.();
      const receiver = tx.receiverId?.toString?.();

      // Sender info
      txObj.senderDetails =
        sender === "0" || sender === "system"
          ? { name: "Admin", isAdmin: true }
          : userMap[sender] || { name: "Unknown User" };

      // Receiver info
      txObj.receiverDetails =
        receiver === "0" || receiver === "system"
          ? { name: "Admin", isAdmin: true }
          : userMap[receiver] || { name: "Unknown User" };

      // Default order details for purchase
      if (tx.transactionType === "purchase" && !txObj.orderDetails) {
        txObj.orderDetails = {
          packageName: "Package Purchase",
          quantity: 1,
        };
      }

      // ✅ Attach deposit details
      if (tx.transactionType === "deposit" && tx.depositDetails?.depositId) {
        const depId = tx.depositDetails.depositId.toString();
        if (depositMap[depId]) {
          txObj.depositDetails = {
            ...depositMap[depId],
            depositId: depId,
          };
        }
      }

      return txObj;
    });

    // 📤 10. Send final response
    return res.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};

exports.getAllDepositTransactions = async (req, res) => {
  try {
    // 🔒 1. Authorization
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { page = 1, limit = 50 } = req.body;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 🎯 2. Filter only deposit transactions
    const filter = { transactionType: "deposit" };

    // 📦 3. Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Transaction.countDocuments(filter);

    // 💰 4. Collect all deposit IDs from these transactions
    const depositIds = transactions
      .filter((tx) => tx.depositDetails?.depositId)
      .map((tx) => tx.depositDetails.depositId);

    // 🏦 5. Fetch all related deposit documents
    let depositMap = {};
    if (depositIds.length > 0) {
      const deposits = await Deposit.find({ _id: { $in: depositIds } }).lean();
      depositMap = deposits.reduce((acc, dep) => {
        acc[dep._id.toString()] = dep;
        return acc;
      }, {});
    }

    // 👥 6. Collect all related user IDs
    const userIds = new Set();
    transactions.forEach((tx) => {
      const sId = tx.senderId?.toString?.();
      const rId = tx.receiverId?.toString?.();
      if (sId && sId !== "0" && sId !== "system") userIds.add(sId);
      if (rId && rId !== "0" && rId !== "system") userIds.add(rId);
    });

    const validIds = Array.from(userIds).filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const users = await User.find({ _id: { $in: validIds } }).select(
      "_id name email username profileImage"
    );

    // 👤 7. Build user lookup
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = {
        name: user.name || user.username || "Unknown User",
        email: user.email,
        profileImage: user.profileImage || null,
      };
    });

    // 🔄 8. Enrich transactions with user + deposit details
    const enrichedTransactions = transactions.map((tx) => {
      const txObj = tx.toObject();
      const sender = tx.senderId?.toString?.();
      const receiver = tx.receiverId?.toString?.();

      // Sender details
      txObj.senderDetails =
        sender === "0" || sender === "system"
          ? { name: "Admin", isAdmin: true }
          : userMap[sender] || { name: "Unknown User" };

      // Receiver details
      txObj.receiverDetails =
        receiver === "0" || receiver === "system"
          ? { name: "Admin", isAdmin: true }
          : userMap[receiver] || { name: "Unknown User" };

      // ✅ Attach deposit details
      if (tx.depositDetails?.depositId) {
        const depId = tx.depositDetails.depositId.toString();
        if (depositMap[depId]) {
          txObj.depositDetails = {
            ...depositMap[depId],
            depositId: depId,
          };
        }
      }

      return txObj;
    });

    // 📤 9. Final response
    return res.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching deposit transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching deposit transactions",
      error: error.message,
    });
  }
};
exports.getAllDepositByAdminTransactions = async (req, res) => {
  try {
    // 🔒 1. Authorization
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { page = 1, limit = 50 } = req.body;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 🎯 2. Filter only deposit transactions
    const filter = { transactionType: "deposit_by-admin" };

    // 📦 3. Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Transaction.countDocuments(filter);

    // 💰 4. Collect all deposit IDs from these transactions
    const depositIds = transactions
      .filter((tx) => tx.depositDetails?.depositId)
      .map((tx) => tx.depositDetails.depositId);

    // 🏦 5. Fetch all related deposit documents
    let depositMap = {};
    if (depositIds.length > 0) {
      const deposits = await Deposit.find({ _id: { $in: depositIds } }).lean();
      depositMap = deposits.reduce((acc, dep) => {
        acc[dep._id.toString()] = dep;
        return acc;
      }, {});
    }

    // 👥 6. Collect all related user IDs
    const userIds = new Set();
    transactions.forEach((tx) => {
      const sId = tx.senderId?.toString?.();
      const rId = tx.receiverId?.toString?.();
      if (sId && sId !== "0" && sId !== "system") userIds.add(sId);
      if (rId && rId !== "0" && rId !== "system") userIds.add(rId);
    });

    const validIds = Array.from(userIds).filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const users = await User.find({ _id: { $in: validIds } }).select(
      "_id name email username profileImage"
    );

    // 👤 7. Build user lookup
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = {
        name: user.name || user.username || "Unknown User",
        email: user.email,
        profileImage: user.profileImage || null,
      };
    });

    // 🔄 8. Enrich transactions with user + deposit details
    const enrichedTransactions = transactions.map((tx) => {
      const txObj = tx.toObject();
      const sender = tx.senderId?.toString?.();
      const receiver = tx.receiverId?.toString?.();

      // Sender details
      txObj.senderDetails =
        sender === "0" || sender === "system"
          ? { name: "Admin", isAdmin: true }
          : userMap[sender] || { name: "Unknown User" };

      // Receiver details
      txObj.receiverDetails =
        receiver === "0" || receiver === "system"
          ? { name: "Admin", isAdmin: true }
          : userMap[receiver] || { name: "Unknown User" };

      // ✅ Attach deposit details
      if (tx.depositDetails?.depositId) {
        const depId = tx.depositDetails.depositId.toString();
        if (depositMap[depId]) {
          txObj.depositDetails = {
            ...depositMap[depId],
            depositId: depId,
          };
        }
      }

      return txObj;
    });

    // 📤 9. Final response
    return res.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching deposit transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching deposit transactions",
      error: error.message,
    });
  }
};

// Add this to your transaction controller

exports.updateDepositStatus = async (req, res) => {
  try {
    // 🔒 1. Authorization
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Check if user is admin
    const admin = await User.findById(authUser);
    if (!admin || !admin.roles.includes("Admin")) {
      return res.status(403).json({
        success: false,
        message: "Only admins can update deposit status",
      });
    }

    // 🧾 2. Get data
    const { transactionId, status, rejectionReason } = req.body;

    if (!transactionId || !status) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID and status are required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved' or 'rejected'",
      });
    }

    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required for rejected deposits",
      });
    }

    // 📦 3. Find the transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (transaction.transactionType !== "deposit") {
      return res
        .status(400)
        .json({ success: false, message: "This is not a deposit transaction" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Transaction already ${transaction.status}`,
      });
    }

    // 🧠 4. Find linked deposit (if exists)
    let deposit = null;
    if (transaction.depositDetails && transaction.depositDetails.depositId) {
      deposit = await Deposit.findById(transaction.depositDetails.depositId);
    }

    // 💰 5. Handle based on status
    if (status === "approved") {
      const user = await User.findById(transaction.receiverId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // ✅ Update wallet balance
      user.walletBalance = (user.walletBalance || 0) + transaction.amount;
      await user.save();

      // ✅ Update transaction
      transaction.status = "approved";
      transaction.processedAt = new Date();
      transaction.processedBy = authUser;
      await transaction.save();

      // ✅ Update deposit
      if (deposit) {
        deposit.status = "approved";
        deposit.processedAt = new Date();
        deposit.processedBy = authUser;
        await deposit.save();
      }

      // ✅ Distribute MLM commission in the upline
      const commissionResult = await distributeMLMCommissions(
        transaction.receiverId,
        transaction.amount
      );

      return res.json({
        success: true,
        message:
          "Deposit approved successfully. Funds credited to user wallet.",
        commissionResult,
        updatedTransaction: transaction,
        updatedDeposit: deposit,
        newWalletBalance: user.walletBalance,
      });
    } else {
      // ❌ Rejected case
      transaction.status = "rejected";
      transaction.rejectionReason = rejectionReason;
      transaction.processedAt = new Date();
      transaction.processedBy = authUser;
      await transaction.save();

      if (deposit) {
        deposit.status = "rejected";
        deposit.adminNotes = rejectionReason;
        deposit.processedAt = new Date();
        deposit.processedBy = authUser;
        await deposit.save();
      }

      return res.json({
        success: true,
        message: "Deposit rejected successfully.",
        updatedTransaction: transaction,
        updatedDeposit: deposit,
      });
    }
  } catch (error) {
    console.error("Error updating deposit:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating deposit status",
      error: error.message,
    });
  }
};

async function recordPurchaseTransaction(orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { success: false, message: "Order not found" };
    }

    // Create transaction record for the purchase
    const transaction = new Transaction({
      senderId: order.buyerId, // User is the sender (they're paying)
      receiverId: 0, // Admin is the receiver
      amount: order.totalCost,
      paymentMethod: order.paymentMethod || "USDT", // Default if not specified
      transactionType: "purchase",
      status: "approved", // Auto approve purchases
      orderDetails: {
        orderId: order._id,
        competitionTitle: order.competitionTitle,
        ticketQuantity: order.ticketQuantity,
      },
    });

    await transaction.save();

    return {
      success: true,
      message: "Purchase transaction recorded",
      transaction,
    };
  } catch (error) {
    console.error("Error recording purchase transaction:", error);
    return {
      success: false,
      message: "Error recording purchase transaction",
      error: error.message,
    };
  }
}

exports.createWithdrawalRequest = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId, amount, paymentMethod } = req.body;

    // Input validation
    if (!userId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has enough balance
    if (user.walletBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // Create withdrawal transaction
    const transaction = new Transaction({
      senderId: 0, // Admin is the sender in withdrawals
      receiverId: userId, // User is the receiver
      amount,
      paymentMethod,
      transactionType: "withdrawal",
      status: "pending",
    });

    await transaction.save();

    return res.json({
      success: true,
      message: "Withdrawal request submitted",
      transaction,
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating withdrawal request",
      error: error.message,
    });
  }
};

exports.processWithdrawalRequest = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { transactionId, status, rejectionReason } = req.body;

    // Input validation
    if (
      !transactionId ||
      !status ||
      !["approved", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid parameters. Required: transactionId and status (approved/rejected)",
      });
    }

    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a withdrawal",
      });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.transactionType !== "withdrawal") {
      return res.status(404).json({
        success: false,
        message: "Withdrawal transaction not found",
      });
    }

    // Prevent double processing
    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Withdrawal has already been ${transaction.status}`,
      });
    }

    transaction.status = status;

    if (status === "rejected") {
      transaction.rejectionReason = rejectionReason;
    } else if (status === "approved") {
      // Reduce user's wallet balance when approved
      const user = await User.findById(transaction.receiverId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.walletBalance < transaction.amount) {
        return res.status(400).json({
          success: false,
          message: "User has insufficient balance",
        });
      }

      user.walletBalance -= transaction.amount;
      await user.save();
    }

    await transaction.save();

    return res.json({
      success: true,
      message: `Withdrawal request ${status}`,
      transaction,
    });
  } catch (error) {
    console.error("Error processing withdrawal request:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing withdrawal request",
      error: error.message,
    });
  }
};

exports.CompleteOrder = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(authUser);

    const { orderId } = req.body;

    // Input validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Prevent double completion
    if (order.paymentStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Order has already been completed",
      });
    }

    // Check if payment method is wallet
    if (order.paymentMethod === "wallet") {
      // Find the buyer/user
      const user = await User.findById(order.buyerId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Calculate total available balance
      const totalAvailable =
        user.commissionLocked +
        user.commissionWithdrawable +
        user.walletBalance;

      // Check if user has enough total balance
      if (totalAvailable < order.totalCost) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance",
        });
      }

      // Deduct from commissionLocked first
      let remainingAmount = order.totalCost;
      if (user.commissionLocked > 0) {
        if (user.commissionLocked >= remainingAmount) {
          user.commissionLocked -= remainingAmount;
          remainingAmount = 0;
        } else {
          remainingAmount -= user.commissionLocked;
          user.commissionLocked = 0;
        }
      }

      // If more funds needed, deduct from commissionWithdrawable
      if (remainingAmount > 0 && user.commissionWithdrawable > 0) {
        if (user.commissionWithdrawable >= remainingAmount) {
          user.commissionWithdrawable -= remainingAmount;
          remainingAmount = 0;
        } else {
          remainingAmount -= user.commissionWithdrawable;
          user.commissionWithdrawable = 0;
        }
      }

      // If still more funds needed, deduct from walletBalance
      if (remainingAmount > 0) {
        user.walletBalance -= remainingAmount;
      }

      // Update commissionEarned to match (since it equals locked + withdrawable)
      user.commissionEarned =
        user.commissionLocked + user.commissionWithdrawable;

      await user.save();
    }
    // Update order status
    order.paymentStatus = "completed";
    await order.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"WIN4LUX Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Your OTP for Password Reset",
      html: `
        <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Successful</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      margin: 20px auto;
      border: 1px solid #e4e4e4;
    }
    .header {
      background-color: #ac9b6d;
      color: white;
      padding: 15px;
      text-align: center;
    }
    .content {
      padding: 20px;
    }
    h1 {
      background-color: #f5f5f5;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      color: #ac9b6d;
      margin: 20px 0;
      border: 1px dashed #ccc;
    }
    .order-summary {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #ddd;
      margin-top: 15px;
    }
    .order-summary p {
      margin: 5px 0;
    }
    .footer {
      background-color: #f5f5f5;
      padding: 10px;
      text-align: center;
      font-size: 12px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="color: white; margin: 0;">WIN4LUX Order Confirmation</h2>
    </div>
    <div class="content">
      <h2>Hello ${user.firstName || ""},</h2>
      <p>Thank you for your order. We're excited to confirm your purchase.</p>
      <h1>Order Successful</h1>

      <div class="order-summary">
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Competition:</strong> ${order.competitionTitle}</p>
        <p><strong>Tickets:</strong> ${order.ticketQuantity}</p>
        <p><strong>Ticket Price:</strong> $${order.ticketPrice}</p>
        ${
          order.isVipPack
            ? `<p><strong>VIP Pack:</strong> Yes - ${order.vipPackDetails.tickets} Tickets, ${order.vipPackDetails.discount}% Discount, Chance: ${order.vipPackDetails.chance}</p>`
            : `<p><strong>VIP Pack:</strong> No</p>`
        }
        <p><strong>Total Cost:</strong> $${order.totalCost}</p>
        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        <p><strong>Status:</strong> ${order.paymentStatus}</p>
      </div>

      <p>If you have any questions, feel free to reply to this email.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 WIN4LUX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>

      `,
    };

    await transporter.sendMail(mailOptions);

    // Record purchase transaction
    const purchaseResult = await recordPurchaseTransaction(orderId);

    // Record commission transactions
    const commissionResult = await recordCommissionTransactions(orderId);
    const buyer = await User.findById(order.buyerId);
    console.log(buyer);
    if (buyer.refferBy) {
      // Call the refund function for the referrer
      await processAutoPurchaseRefund(buyer.refferBy, order.totalCost);
    }
    return res.json({
      success: true,
      message: "Order completed successfully",
      order,
      purchase: purchaseResult,
      commissions: commissionResult,
    });
  } catch (error) {
    console.error("Error completing order:", error);
    return res.status(500).json({
      success: false,
      message: "Error completing order",
      error: error.message,
    });
  }
};

// Tier-based minimum ticket requirements
const TIER_REQUIREMENTS = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Titanium: 5,
  Platinum: 10,
  Diamond: 15,
};

// Helper function to get user's tier/rank
async function getUserTier(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.tier) {
      return "Bronze"; // Default tier if not set
    }
    return user.tier;
  } catch (error) {
    console.error("Error getting user tier:", error);
    return "Bronze";
  }
}

// Helper function to get minimum tickets required based on user's tier
async function getMinTicketsRequired(userId) {
  const userTier = await getUserTier(userId);
  return TIER_REQUIREMENTS[userTier] || TIER_REQUIREMENTS.Bronze;
}

const hasBoughtTicketInLast30Days = async (buyerId) => {
  try {
    // Calculate the date 30 days ago from now
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query for any order placed by this user after that date
    const recentOrder = await Order.findOne({
      buyerId,
      createdAt: { $gte: thirtyDaysAgo },
      paymentStatus: "completed",
    });

    return !!recentOrder;
  } catch (error) {
    console.error("Error checking recent orders:", error);
    return false;
  }
};

async function isWithinEligibilityWindow(user) {
  if (!user) {
    console.log("Cannot check eligibility window: User object is null");
    return false;
  }

  // Find the first ticket purchased by this user
  const firstTicket = await Order.findOne({
    buyerId: user._id,
    paymentStatus: "completed",
  }).sort({ createdAt: 1 });

  // Determine the start date for the eligibility window
  let startDate;
  if (firstTicket) {
    startDate = moment(firstTicket.createdAt);
  } else {
    startDate = moment(user.createdAt);
  }

  // Calculate the end of the eligibility window (30 days from start)
  const endDate = startDate.clone().add(30, "days");

  // Check if current date is within the eligibility window
  const isEligible = moment().isBefore(endDate);

  console.log(`Eligibility window check for ${user.username}:`);
  console.log(
    `- Registration date: ${moment(user.createdAt).format("YYYY-MM-DD")}`
  );
  console.log(
    `- First ticket date: ${
      firstTicket ? moment(firstTicket.createdAt).format("YYYY-MM-DD") : "None"
    }`
  );
  console.log(`- Window start date: ${startDate.format("YYYY-MM-DD")}`);
  console.log(`- Window end date: ${endDate.format("YYYY-MM-DD")}`);
  console.log(`- Current date: ${moment().format("YYYY-MM-DD")}`);
  console.log(`- Is within window: ${isEligible}`);

  return isEligible;
}

async function isQualifiedForCommission(userId) {
  if (!userId) {
    console.log("Cannot check qualification: User ID is null");
    return false;
  }

  const user = await User.findById(userId);

  if (!user) {
    console.log("User not found");
    return false;
  }

  // Find the first ticket purchase
  const firstTicket = await Order.findOne({
    buyerId: userId,
    paymentStatus: "completed",
  }).sort({ createdAt: 1 });

  // If no ticket purchased yet, user is not yet qualified
  if (!firstTicket) {
    console.log(`User ${user.username} hasn't purchased any tickets yet`);
    return false;
  }

  // If user is within their initial eligibility window, they automatically qualify
  const isWithinWindow = await isWithinEligibilityWindow(user);
  if (isWithinWindow) {
    console.log(
      `User ${user.username} is within initial eligibility window - automatically qualified`
    );
    return true;
  }

  // If outside initial window, check qualification criteria from previous month
  console.log(
    `User ${user.username} is outside initial window - checking monthly qualification`
  );
  return await isQualifiedLastMonth(userId);
}

async function isQualifiedLastMonth(userId) {
  if (!userId) {
    console.log("Cannot check qualification: User ID is null");
    return false;
  }

  // Get user's tier and minimum required tickets
  const userTier = await getUserTier(userId);
  const minTicketsRequired = await getMinTicketsRequired(userId);

  const now = moment();
  const startOfLastMonth = now.clone().subtract(1, "month").startOf("month");
  const endOfLastMonth = now.clone().subtract(1, "month").endOf("month");

  console.log(`Qualification check for user ${userId}:`);
  console.log(`- User tier: ${userTier}`);
  console.log(`- Minimum tickets required: ${minTicketsRequired}`);
  console.log(
    `- Last month period: ${startOfLastMonth.format(
      "YYYY-MM-DD"
    )} to ${endOfLastMonth.format("YYYY-MM-DD")}`
  );

  // Check ticket purchase
  const ticketCount = await Order.countDocuments({
    buyerId: userId,
    paymentStatus: "completed",
    createdAt: {
      $gte: startOfLastMonth.toDate(),
      $lte: endOfLastMonth.toDate(),
    },
  });

  console.log(
    `- Tickets purchased last month: ${ticketCount} (minimum required: ${minTicketsRequired})`
  );

  if (ticketCount >= minTicketsRequired) {
    console.log("- Qualified: Has sufficient ticket purchases based on tier");
    return true;
  }

  // Check if sponsored any active user
  const user = await User.findById(userId);
  if (!user || !user.refferrCode) {
    console.log("- User not found or has no referral code");
    return false;
  }

  const sponsoredUsers = await User.find({ refferBy: user.refferrCode });
  console.log(`- Number of sponsored users: ${sponsoredUsers.length}`);

  let activeReferralFound = false;
  for (const sponsored of sponsoredUsers) {
    console.log(
      `-- Checking sponsored user: ${sponsored.username || sponsored._id}`
    );

    // Get sponsored user's tier and minimum requirement
    const sponsoredUserTier = await getUserTier(sponsored._id);
    const sponsoredMinTickets = await getMinTicketsRequired(sponsored._id);

    const sponsoredTicketCount = await Order.countDocuments({
      buyerId: sponsored._id,
      paymentStatus: "completed",
      createdAt: {
        $gte: startOfLastMonth.toDate(),
        $lte: endOfLastMonth.toDate(),
      },
    });

    console.log(
      `-- Sponsored user tier: ${sponsoredUserTier}, required: ${sponsoredMinTickets}, purchased: ${sponsoredTicketCount}`
    );

    if (sponsoredTicketCount >= sponsoredMinTickets) {
      console.log(
        `- Qualified: Sponsored user ${
          sponsored.username || sponsored._id
        } met their tier requirements (${sponsoredTicketCount}/${sponsoredMinTickets} tickets) last month`
      );
      activeReferralFound = true;
      break;
    } else {
      console.log(
        `-- Sponsored user ${
          sponsored.username || sponsored._id
        } did not meet tier requirements`
      );
    }
  }

  return activeReferralFound;
}

async function getUplineUsers(userId, maxLevels = 5) {
  if (!userId) return [];

  const uplineUsers = [];
  let currentUser = await User.findById(userId);

  // Build the upline chain (excluding level checks - we'll check when processing)
  while (
    currentUser &&
    currentUser.refferBy &&
    uplineUsers.length < maxLevels
  ) {
    // Find the referring user
    const referrer = await User.findOne({ refferrCode: currentUser.refferBy });

    if (referrer) {
      uplineUsers.push({
        userId: referrer._id,
        username: referrer.username,
      });

      // Move up the chain
      currentUser = referrer;
    } else {
      break;
    }
  }

  return uplineUsers;
}

// Additional helper function to check if user meets their current tier requirement
async function checkUserTierCompliance(userId, period = "lastMonth") {
  const userTier = await getUserTier(userId);
  const minRequired = await getMinTicketsRequired(userId);

  let startDate, endDate;

  if (period === "lastMonth") {
    const now = moment();
    startDate = now.clone().subtract(1, "month").startOf("month");
    endDate = now.clone().subtract(1, "month").endOf("month");
  } else if (period === "currentMonth") {
    const now = moment();
    startDate = now.clone().startOf("month");
    endDate = now.clone().endOf("month");
  }

  const ticketCount = await Order.countDocuments({
    buyerId: userId,
    paymentStatus: "completed",
    createdAt: {
      $gte: startDate.toDate(),
      $lte: endDate.toDate(),
    },
  });

  return {
    tier: userTier,
    required: minRequired,
    purchased: ticketCount,
    compliant: ticketCount >= minRequired,
    period: period,
  };
}

async function recordCommissionTransactions(orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== "completed") {
      return { success: false, message: "Order not found or not completed" };
    }

    const buyerId = order.buyerId;
    const buyer = await User.findById(buyerId);
    if (!buyer) {
      return { success: false, message: "Buyer not found" };
    }

    const orderAmount = order.totalCost;
    const settings = await Settings.findOne();
    if (!settings || !settings.levels) {
      return { success: false, message: "Commission settings not found" };
    }

    const levelBonus = settings.levelBonus || 0;
    const transactions = [];

    let directReferrerId = null;

    // ---------- Direct Referrer Commission ----------
    if (buyer.refferBy) {
      const directReferrer = await User.findOne({
        refferrCode: buyer.refferBy,
      });

      if (directReferrer) {
        directReferrerId = directReferrer._id.toString();

        const qualified = await isQualifiedForCommission(directReferrer._id);

        if (qualified) {
          const commissionAmount = (orderAmount * levelBonus) / 100;

          await User.findByIdAndUpdate(directReferrer._id, {
            $inc: { pendingCommissions: commissionAmount },
          });

          const transaction = new Transaction({
            senderId: 0,
            receiverId: directReferrer._id,
            amount: commissionAmount,
            paymentMethod: "SYSTEM",
            transactionType: "direct_referral_bonus",
            status: "pending",
            orderDetails: {
              orderId: orderId,
              competitionTitle: order.competitionTitle,
              ticketQuantity: order.ticketQuantity,
            },
            commissionDetails: {
              level: 0,
              percentage: levelBonus,
              buyerId: buyerId,
            },
          });

          await transaction.save();
          transactions.push(transaction);
        } else {
          console.log(
            `Direct referrer ${directReferrer.username} is not eligible for commission`
          );
        }
      }
    }

    // ---------- Upline Commissions ----------
    const uplineUsers = await getUplineUsers(directReferrerId);

    for (let i = 0; i < uplineUsers.length; i++) {
      const upline = uplineUsers[i];
      const userLevel = i + 1;

      const levelSetting = settings.levels.find((l) => l.level === userLevel);
      if (!levelSetting) continue;

      const referrer = await User.findById(upline.userId);
      if (!referrer || referrer.levelsOpen < userLevel) continue;

      // Check both eligibility conditions
      const withinEligibilityWindow = await isWithinEligibilityWindow(referrer);
      const qualifiedLastMonth = await isQualifiedLastMonth(referrer._id);

      // FIX: Changed from AND (&&) to OR (||) to allow either condition to qualify
      if (withinEligibilityWindow || qualifiedLastMonth) {
        const commissionAmount =
          (orderAmount * levelSetting.commissionPercentage) / 100;

        await User.findByIdAndUpdate(upline.userId, {
          $inc: { pendingCommissions: commissionAmount },
        });

        const transaction = new Transaction({
          senderId: 0,
          receiverId: upline.userId,
          amount: commissionAmount,
          paymentMethod: "SYSTEM",
          transactionType: "referral_bonus",
          status: "pending",
          orderDetails: {
            orderId: orderId,
            competitionTitle: order.competitionTitle,
            ticketQuantity: order.ticketQuantity,
          },
          commissionDetails: {
            level: userLevel,
            percentage: levelSetting.commissionPercentage,
            buyerId: buyerId,
          },
        });

        await transaction.save();
        transactions.push(transaction);
      } else {
        console.log(
          `Upline user ${
            referrer?.username || upline.userId
          } is not eligible for level ${userLevel} commission - ` +
            `Within eligibility window: ${withinEligibilityWindow}, ` +
            `Qualified last month: ${qualifiedLastMonth}`
        );
      }
    }

    return {
      success: true,
      message: `${transactions.length} commission transactions recorded`,
      transactions,
    };
  } catch (error) {
    console.error("Error recording commission transactions:", error);
    return {
      success: false,
      message: "Error recording commission transactions",
      error: error.message,
    };
  }
}

// Controller to get detailed referral tree
exports.getReferralTree = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }

    const rootUser = await User.findById(userId);
    if (!rootUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const tree = await buildDetailedBinaryTree(rootUser._id);

    res.json({
      success: true,
      tree,
    });
  } catch (error) {
    console.error("Error building detailed binary tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build detailed binary tree",
      error: error.message,
    });
  }
};

// Controller to get unilevel tree without eligibility check
exports.getUnilevelTree = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const rootUser = await User.findById(userId);
    if (!rootUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const tree = await buildTree(rootUser._id);

    res.json({
      success: true,
      tree,
    });
  } catch (error) {
    console.error("Error building referral tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build referral tree",
      error: error.message,
    });
  }
};

// Helper function to build unilevel tree without eligibility check
async function buildTree(userId) {
  // Fetch user data with rank populated
  const user = await User.findById(userId).lean();
  if (!user) return null;

  // Fetch all children regardless of eligibility
  const children = await User.find({ refferBy: user.refferrCode }).lean();

  const childNodes = await Promise.all(
    children.map((child) => buildTree(child._id))
  );

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    profileImage: user.profileImg,
    children: childNodes.filter(Boolean),
  };
}
// Optimized Controller to get binary tree with batch loading
exports.getBinaryTree = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId, maxDepth = 10 } = req.body; // Add depth limit

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }

    const rootUser = await User.findById(userId);
    if (!rootUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Use optimized batch loading approach
    const tree = await buildBinaryTreeOptimized(rootUser._id, maxDepth);

    res.json({
      success: true,
      tree,
    });
  } catch (error) {
    console.error("Error building binary tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build binary tree",
      error: error.message,
    });
  }
};

// OPTIMIZED: Batch loading approach with BFS traversal
async function buildBinaryTreeOptimized(rootUserId, maxDepth = 10) {
  try {
    // Step 1: Get all user IDs in the tree using BFS
    const allUserIds = await getAllUserIdsInTree(rootUserId, maxDepth);

    if (allUserIds.length === 0) {
      return null;
    }

    // Step 2: Batch load all users with their ranks
    const usersMap = await batchLoadUsers(allUserIds);

    // Step 3: Batch load all binary placements
    const placementsMap = await batchLoadPlacements(allUserIds);

    // Step 4: Batch load referrer information
    const referrersMap = await batchLoadReferrers(usersMap);

    // Step 5: Build the tree structure efficiently
    const tree = buildTreeFromBatchedData(
      rootUserId,
      usersMap,
      placementsMap,
      referrersMap
    );

    return tree;
  } catch (error) {
    console.error("Error in buildBinaryTreeOptimized:", error);
    return null;
  }
}

// Get all user IDs in the binary tree using BFS (single query approach)
async function getAllUserIdsInTree(rootUserId, maxDepth) {
  try {
    const userIds = new Set([rootUserId.toString()]);
    const queue = [{ userId: rootUserId.toString(), depth: 0 }];

    while (queue.length > 0) {
      const currentBatch = [];
      const currentDepth = queue[0].depth;

      // Process all nodes at current depth
      while (queue.length > 0 && queue[0].depth === currentDepth) {
        const { userId } = queue.shift();
        currentBatch.push(new mongoose.Types.ObjectId(userId));
      }

      if (currentDepth >= maxDepth) break;

      // Batch query for all placements at current level
      const placements = await BinaryPlacement.find({
        pid: { $in: currentBatch },
        status: "active",
      }).lean();

      // Add children to queue for next level
      for (const placement of placements) {
        const childId = placement.userId.toString();
        if (!userIds.has(childId)) {
          userIds.add(childId);
          queue.push({ userId: childId, depth: currentDepth + 1 });
        }
      }
    }

    return Array.from(userIds).map((id) => new mongoose.Types.ObjectId(id));
  } catch (error) {
    console.error("Error getting all user IDs:", error);
    return [];
  }
}

// Batch load all users with populated ranks
async function batchLoadUsers(userIds) {
  try {
    const users = await User.find({ _id: { $in: userIds } })
      .populate("rank")
      .lean();

    const usersMap = new Map();
    users.forEach((user) => {
      usersMap.set(user._id.toString(), user);
    });

    return usersMap;
  } catch (error) {
    console.error("Error batch loading users:", error);
    return new Map();
  }
}

// Batch load all binary placements
async function batchLoadPlacements(userIds) {
  try {
    // Get placements where these users are parents (to find their children)
    const parentPlacements = await BinaryPlacement.find({
      pid: { $in: userIds },
      status: "active",
    }).lean();

    // Get placements where these users are children (to find their position)
    const childPlacements = await BinaryPlacement.find({
      userId: { $in: userIds },
    }).lean();

    const placementsMap = new Map();

    // Map parent -> children placements
    parentPlacements.forEach((placement) => {
      const parentId = placement.pid.toString();
      if (!placementsMap.has(parentId)) {
        placementsMap.set(parentId, {
          left: null,
          right: null,
          placement: null,
        });
      }

      if (placement.leg === "L") {
        placementsMap.get(parentId).left = placement;
      } else {
        placementsMap.get(parentId).right = placement;
      }
    });

    // Map user -> their own placement info
    childPlacements.forEach((placement) => {
      const userId = placement.userId.toString();
      if (!placementsMap.has(userId)) {
        placementsMap.set(userId, { left: null, right: null, placement: null });
      }
      placementsMap.get(userId).placement = placement;
    });

    return placementsMap;
  } catch (error) {
    console.error("Error batch loading placements:", error);
    return new Map();
  }
}

// Batch load referrer information
async function batchLoadReferrers(usersMap) {
  try {
    const referrerCodes = [];
    usersMap.forEach((user) => {
      if (user.refferBy) {
        referrerCodes.push(user.refferBy);
      }
    });

    if (referrerCodes.length === 0) {
      return new Map();
    }

    const referrers = await User.find({
      refferrCode: { $in: referrerCodes },
    })
      .select("username refferrCode")
      .lean();

    const referrersMap = new Map();
    referrers.forEach((referrer) => {
      referrersMap.set(referrer.refferrCode, referrer);
    });

    return referrersMap;
  } catch (error) {
    console.error("Error batch loading referrers:", error);
    return new Map();
  }
}

// Build tree structure from batched data (no more database calls)
async function buildTreeFromBatchedData(
  userId,
  usersMap,
  placementsMap,
  referrersMap,
  parentLeg = null
) {
  const user = usersMap.get(userId.toString());
  if (!user) return null;

  const userPlacements = placementsMap.get(userId.toString()) || {};
  const directReferrer = user.refferBy ? referrersMap.get(user.refferBy) : null;

  // Recursively build children
  const leftChild = userPlacements.left
    ? await buildTreeFromBatchedData(
        userPlacements.left.userId,
        usersMap,
        placementsMap,
        referrersMap,
        "L"
      )
    : null;

  const rightChild = userPlacements.right
    ? await buildTreeFromBatchedData(
        userPlacements.right.userId,
        usersMap,
        placementsMap,
        referrersMap,
        "R"
      )
    : null;

  const children = [];
  if (leftChild) children.push(leftChild);
  if (rightChild) children.push(rightChild);

  // ✅ Fetch left/right points from DB
  const pointsData = await leftOrRightPoints(user._id);

  // ✅ Fetch Green ID Status
  const greenIdStatus = await hasGreenID(user._id);

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    profileImage: user.profileImg,
    rank: user.rank?.rank || "No Rank",
    rankId: user.rank?._id || null,
    isKycVerified: user.isKycVerified,
    position: parentLeg,
    leg: parentLeg,
    directReferralName: directReferrer?.username || "No Direct Referrer",
    hasLeftChild: !!leftChild,
    hasRightChild: !!rightChild,
    childrenCount: children.length,
    children,
    placement: userPlacements.placement || null,
    totalLeftPoints: pointsData?.totalLeftPoints || 0,
    totalRightPoints: pointsData?.totalRightPoints || 0,
    greenIdStatus, // ✅ Include Green ID status here
  };
}

exports.getBinaryTreePaginated = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId, depth = 3 } = req.body; // Load only 3 levels by default

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }

    const tree = await buildBinaryTreeLimited(userId, depth);

    res.json({
      success: true,
      tree,
      loadedDepth: depth,
      message: `Loaded ${depth} levels of the binary tree`,
    });
  } catch (error) {
    console.error("Error building limited binary tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build binary tree",
      error: error.message,
    });
  }
};

// Build tree with limited depth (for very large trees)
async function buildBinaryTreeLimited(rootUserId, maxDepth = 3) {
  const userIds = [];
  const queue = [{ userId: rootUserId, depth: 0 }];

  // Collect all user IDs up to maxDepth
  while (queue.length > 0) {
    const { userId, depth } = queue.shift();
    userIds.push(userId);

    if (depth < maxDepth) {
      const placements = await BinaryPlacement.find({
        pid: userId,
        status: "active",
      })
        .select("userId leg")
        .lean();

      placements.forEach((placement) => {
        queue.push({ userId: placement.userId, depth: depth + 1 });
      });
    }
  }

  // Now use batch loading for collected IDs
  return await buildBinaryTreeOptimized(rootUserId, maxDepth);
}

// Enhanced findNextAvailablePosition with better performance
async function findNextAvailablePositionOptimized(
  rootUserId,
  preferredLeg = "L"
) {
  try {
    if (!mongoose.Types.ObjectId.isValid(rootUserId)) {
      throw new Error("Invalid root user ID format");
    }

    // Use aggregation pipeline for better performance
    const pipeline = [
      { $match: { pid: new mongoose.Types.ObjectId(rootUserId) } },
      {
        $group: {
          _id: "$pid",
          legs: { $push: "$leg" },
          placements: { $push: "$$ROOT" },
        },
      },
    ];

    const result = await BinaryPlacement.aggregate(pipeline);

    if (result.length === 0) {
      // No placements yet, return preferred leg
      return { pid: rootUserId, leg: preferredLeg, level: 1 };
    }

    const { legs } = result[0];

    // Check if preferred leg is available
    if (preferredLeg === "L" && !legs.includes("L")) {
      return { pid: rootUserId, leg: "L", level: 1 };
    }

    if (!legs.includes("R")) {
      return { pid: rootUserId, leg: "R", level: 1 };
    }

    // Both positions filled, recursively check children
    const childPlacements = await BinaryPlacement.find({
      pid: rootUserId,
      status: "active",
    })
      .select("userId")
      .lean();

    for (const placement of childPlacements) {
      const childPosition = await findNextAvailablePositionOptimized(
        placement.userId,
        preferredLeg
      );
      if (childPosition) {
        return { ...childPosition, level: (childPosition.level || 0) + 1 };
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding next available position:", error);
    return null;
  }
}
