// models/settings.js
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    keyname: {
      type: String,
      required: false,
      trim: true,
    },
    value: {
      type: Number,
      required: false,
    },
    fixedFee: {
      type: Number,
      required: false,
    },
    percentageFee: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
