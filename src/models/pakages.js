const mongoose = require("mongoose");

const packagesSchema = new mongoose.Schema({
  fee: {
    type: String,
  },
  amount: {
    type: String,
  },
  hubPrice: {
    type: String,
  },
  hubCapacity: {
    type: String,
  },
  minimumMinting: {
    type: String,
  },
  minimumMintingRequired: {
    type: Boolean,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const packages = mongoose.model("packages", packagesSchema);

module.exports = packages;
