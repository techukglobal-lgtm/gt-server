// models/depositSettings.js
import mongoose from "mongoose";

const DepositSettingsSchema = new mongoose.Schema(
  {
    keyname: {
      type: String,
      required: true,
      unique: true,
      default: "Deposit Settings",
    },
    value: {
      walletAddress: {
        type: String,
        required: true,
      },
      minDepositAmount: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("DepositSettings", DepositSettingsSchema);
