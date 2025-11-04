const checkAuthorization = require("../../middlewares/authMiddleware");
const User = require("../../models/auth");
const Transaction = require("../../models/Transaction");

exports.addWalletBalance = async (req, res) => {
  const { userId, amount } = req.body;
  const authuser = await checkAuthorization(req, res);

  if (!authuser) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
    });
  }

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid userId and amount are required.",
    });
  }

  try {
    const adminUser = await User.findById(authuser);
    if (!adminUser || !adminUser.roles.includes("Admin")) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const numericAmount = parseFloat(amount);

    // Update user wallet balance
    targetUser.walletBalance = (targetUser.walletBalance || 0) + numericAmount;
    await targetUser.save();

    // Create transaction record
    const transaction = new Transaction({
      senderId: 0, // Admin
      receiverId: userId,
      amount: numericAmount,
      paymentMethod: "ADMIN_DEPOSIT",
      transactionType: "deposit_by_admin",
      status: "approved",
      commissionDetails: {
        note: `Wallet balance added by admin: ${adminUser.username}`,
      },
    });

    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Wallet balance added successfully",
      data: {
        user: targetUser.username,
        amountAdded: numericAmount,
        newBalance: targetUser.walletBalance,
      },
    });
  } catch (error) {
    console.error("Error adding wallet balance:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to add wallet balance.",
    });
  }
};