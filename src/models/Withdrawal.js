const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true }, // entered amount
    amount2: { type: Number, required: true }, // net after fee
    paymentMethod: { type: String, default: "BEP20" },
    payoutAddress: { type: String, required: true },
    deductedFrom: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    feeInfo: {
      percentageFee: Number,
      totalFees: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
