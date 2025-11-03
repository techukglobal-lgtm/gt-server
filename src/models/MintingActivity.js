const mongoose = require("mongoose");

const mintingActivitySchema = new mongoose.Schema({
  investmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Investment",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  mintingType: {
    type: String,
    enum: ["AUTO", "MANUAL"],
    required: true,
  },
  investedAmount: {
    type: Number,
    required: true,
  },
  clicksDone: {
    type: Number,
    default: 0,
  },
  // Store each click with its timestamp and profit earned
  clickHistory: [
    {
      clickTime: {
        type: Date,
        default: Date.now,
      },
      profitEarned: {
        type: Number,
      },
      clickNumber: {
        type: Number,
      },
      processed: {
        type: Boolean,
        default: false, // Track if this click has been processed by cron job
      },
    },
  ],
  totalProfitEarned: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for better performance
mintingActivitySchema.index({ userId: 1, isActive: 1 });
mintingActivitySchema.index({ "clickHistory.processed": 1 });

module.exports = mongoose.model("MintingActivity", mintingActivitySchema);
