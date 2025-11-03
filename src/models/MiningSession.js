const mongoose = require("mongoose");

const miningSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // har user ka sirf aik active mining record hoga
    },
    lastMineTime: {
      type: Date,
      required: true,
    },
    nextMineTime: {
      type: Date,
      required: true,
    },
    profitAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MiningSession", miningSessionSchema);
