const mongoose = require("mongoose");

const mintingCommissionSchema = new mongoose.Schema(
  {
    commissionType: {
      type: String,
      enum: ["selfMinting", "autoMinting"],
      required: true,
    },
    rates: {
      noInvestment: { type: String },
      "5x": { type: String },
      "10x": { type: String },
      "15x": { type: String },
      "20x": { type: String },
      "25x": { type: String },
      "30x": { type: String },
      "35x": { type: String },
      "40x": { type: String },
      "45x": { type: String },
      "50x": { type: String },
      "100x": { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MintingCommission", mintingCommissionSchema);
