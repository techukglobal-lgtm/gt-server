const mongoose = require("mongoose");

const binaryPlacementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    sid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leg: {
      type: String,
      enum: ["L", "R"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
    investment: {
      type: Number,
      default: 0,
      min: 0,
    },
    leftPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    rightPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalLeftPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRightPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    convertedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BinaryPlacement", binaryPlacementSchema);
