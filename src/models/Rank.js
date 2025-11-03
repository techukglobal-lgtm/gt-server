const mongoose = require("mongoose");

const rankSchema = new mongoose.Schema(
  {
    rank: {
      type: String,
      required: true,
      unique: true,
      uppercase: true, 
    },
    criteria: {
      required: {
        type: mongoose.Schema.Types.Mixed, 
        required: true,
      },
      reward: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
      extra: {
        type: mongoose.Schema.Types.Mixed, 
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Rank || mongoose.model("Rank", rankSchema);