const mongoose = require("mongoose");

const userAuthSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    forgototp: { type: String },
    linkToken: { type: String },
    profileImg: { type: String },
    firstName: { type: String },
    phone: { type: String },
    dob: { type: Date },
    lastName: { type: String },
    // Address
    address: {
      country: { type: String },
      zipCode: { type: String },
      city: { type: String },
      shortAddress: { type: String },
    },
    withdrawalEnabled: {
      type: Boolean,
      default: false,
    },
    // Wallet & Commission
    walletBalance: { type: Number, default: 0 },
    cryptoWallet: { type: Number, default: 0 },

    cellNumber: { type: String },
    age: { type: String },

    //MLM related

    refferrCode: { type: String },
    refferBy: { type: String },

    status: { type: String, default: "pending" },
    roles: {
      type: [String],
      enum: ["Admin", "User"],
      default: ["User"],
    },
  },
  { collection: "userdata", versionKey: false, timestamps: true }
);

const User = mongoose.model("User", userAuthSchema);

module.exports = User;
