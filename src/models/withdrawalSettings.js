// models/withdrawalSettings.js
import mongoose from "mongoose";

const WithdrawalSettingsSchema = new mongoose.Schema(
  {
    keyname: {
      type: String,
      required: true,
      unique: true,
      default: "Withdrawal Settings",
    },
    value: {
      minWithdrawalAmount: {
        type: Number,
        required: true,
        default: 0,
      },
      withdrawalFee: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("WithdrawalSettings", WithdrawalSettingsSchema);