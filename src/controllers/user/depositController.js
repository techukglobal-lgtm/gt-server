const User = require("../../models/auth");
const checkAuthorization = require("../../middlewares/authMiddleware");
const Deposit = require("../../models/deposit");
const Transaction = require("../../models/Transaction");

exports.deposit = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { platformWallet, userWalletAddress, amount } = req.body;
    const paymentScreenshot = req.file;

    // Basic validation
    if (
      !platformWallet ||
      !userWalletAddress ||
      !amount ||
      !paymentScreenshot
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required including payment screenshot",
      });
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 25) {
      return res.status(400).json({
        success: false,
        message: "Minimum deposit amount is $25",
      });
    }

    if (depositAmount > 1000000) {
      return res.status(400).json({
        success: false,
        message: "Maximum deposit amount is $1,000,000",
      });
    }

    const newDeposit = await Deposit.create({
      userId: authUser,
      platformWallet,
      userWalletAddress,
      amount: depositAmount,
      paymentScreenshot: paymentScreenshot.path, // Cloudinary URL (instead of filename)
      status: "pending",
    });

    // Create transaction record for tracking
    await Transaction.create({
      senderId: 0, // Admin is sender
      receiverId: authUser,
      amount: depositAmount,
      paymentMethod: platformWallet,
      transactionType: "deposit",
      status: "pending",
      transactionDate: new Date(),
      depositDetails: {
        depositId: newDeposit._id,
      },
    });

    res.status(200).json({
      success: true,
      message:
        "Deposit request submitted successfully! Awaiting admin confirmation.",
      data: {
        depositId: newDeposit._id,
        amount: depositAmount,
        status: "pending",
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
