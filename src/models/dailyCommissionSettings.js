// models/dailyCommissionSettings.js
import mongoose from "mongoose";

const DailyCommissionSettingsSchema = new mongoose.Schema(
  {
    keyname: {
      type: String,
      required: true,
      unique: true,
      default: "Daily Commission Settings",
    },
    value: {
      startingLevel: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
      },
      endingLevel: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("DailyCommissionSettings", DailyCommissionSettingsSchema);