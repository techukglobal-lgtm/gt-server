// models/referralCommissionSettings.js
import mongoose from "mongoose";

const ReferralCommissionSettingsSchema = new mongoose.Schema(
  {
    keyname: {
      type: String,
      required: true,
      unique: true,
      default: "Referral Commission Settings",
    },
    value: {
      level1: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
      },
      level2: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
      },
      level3: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
      },
      level4: {
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

export default mongoose.model("ReferralCommissionSettings", ReferralCommissionSettingsSchema);