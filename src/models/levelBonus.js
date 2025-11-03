// Model: levelBonus.js
const mongoose = require("mongoose");

const levelBonusSchema = new mongoose.Schema({
  checkRank: {
    type: Boolean,
    required: true,
    default: false,
  },
  levelBonuses: [
    {
      level: {
        type: Number,
        required: true,
        unique: true,
      },
      percentage: {
        type: Number,
        required: true,
      },
    }
  ],
}, { timestamps: true });

// Ensure only one document exists
levelBonusSchema.index({}, { unique: true });

module.exports = mongoose.models.LevelBonus || mongoose.model("LevelBonus", levelBonusSchema);