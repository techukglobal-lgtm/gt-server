// Updated Transaction Model with Withdrawal Transaction Types
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transactionSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.Mixed, // Can be a number (0 for admin) or ObjectId string
      required: true,
      // 0 means admin is sender
    },
    receiverId: {
      type: Schema.Types.Mixed, // Can be a number (0 for admin) or ObjectId string
      required: true,
      // 0 means admin is receiver
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      // SYSTEM for internal transactions like commissions
    },
    transactionType: {
      type: String,
      required: true,
      enum: [
        "deposit",
        "deposit_by_admin",
        "level_commission_1",
        "level_commission_2",
        "level_commission_3",
        "level_commission_4",
        "mining_earning",
        "withdrawal",
        "withdrawal_request", // NEW: jab user withdrawal request karta hai
        "withdrawal_approved", // NEW: jab admin withdrawal approve karta hai
        "withdrawal_rejected", // NEW: jab admin withdrawal reject karta hai
        "withdrawal_refund", // NEW: jab rejected withdrawal ka amount wapis kiya jata hai
      ],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "flushed", "completed"], // Added "completed"
      default: "pending",
    },
    commissionDetails: {
      level: {
        type: Schema.Types.Mixed,
        default: null,
      },
      percentage: {
        type: Number,
        default: null,
      },
      totalReceivedMintingPercentage: {
        type: Schema.Types.Mixed,
        default: null,
      },
      buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      mintingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Minting",
        default: null,
      },
      buyerUsername: {
        type: Schema.Types.Mixed,
        ref: "User",
        default: null,
      },
      leg: {
        type: String,
        default: null,
      },
      convertedPoints: {
        type: Schema.Types.Mixed,
        default: null,
      },
      note: {
        type: String,
        default: null,
      },
    },

    // NEW: Withdrawal specific details
    withdrawalDetails: {
      withdrawalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Withdrawal",
        default: null,
      },
      payoutAddress: {
        type: String,
        default: null,
      },
      feeInfo: {
        fixedFee: { type: Number, default: null },
        percentageFee: { type: Number, default: null },
        totalFees: { type: Number, default: null },
        feeRate: { type: Number, default: null },
      },
      netAmount: {
        type: Number,
        default: null, // amount after fee deduction
      },
      grossAmount: {
        type: Number,
        default: null, // original amount before fee
      },
    },

    rejectionReason: {
      type: String,
      default: null, // when withdrawal rejected
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    // NEW: Deposit specific details
    depositDetails: {
      depositId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Deposit",
        default: null,
      },
      platformWallet: {
        type: String,
        default: null,
      },
      userWalletAddress: {
        type: String,
        default: null,
      },
      paymentScreenshot: {
        type: String,
        default: null,
      },
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
