const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  hubPackage: {
    amount: Number,
    hubPrice: Number,
    hubCapacity: Number,
    minimumMinting: Number,
    packageId: String,
  },
  amount: { type: Number, required: true },
  cryptoUsed: { type: String, enum: ["USDT", "TRDO"], required: true },
  txHash: { type: String },
  isMintingActive: { type: Boolean, default: false },
  mintingType: { type: String, enum: ["auto", "manual"], required: true },
  purchaseDate: { type: Date, default: Date.now },
  startDate: { type: Date },
  endDate: { type: Date },
});

module.exports = mongoose.model("Investment", investmentSchema);
