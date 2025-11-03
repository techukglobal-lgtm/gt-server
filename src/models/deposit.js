const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platformWallet: {
      type: String,
      required: true,
      enum: [
        "0xbA08B229CF374dCa649eA6944214Db220d254e11",
        "0x7a4C2F99dBC284d68e6e605fe886d63CEB231F19",
        "0x0460CBa6973f1D0D022F376A0f37945c83BBFfBd",
      ],
    },
    userWalletAddress: {
      type: String,
      required: true,
      minlength: 9,
    },
    amount: {
      type: Number,
      required: true,
      min: 25,
      max: 1000000,
    },
    paymentScreenshot: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Link to the transaction record
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Deposit", depositSchema);
