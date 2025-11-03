const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  otp: {
    type: String,
    required: true,
  },
  userData: {
    username: String,
    firstName: String,
    lastName: String,
    password: String,
    refferrCode: String,
    phone: String,
    refferBy: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Auto delete after 10 minutes
  },
});

module.exports = mongoose.model("OTP", otpSchema);
