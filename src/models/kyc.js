// const mongoose = require("mongoose");

// const kycSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       unique: true,
//     },
//     docType: {
//       type: String,
//       enum: [
//         "NIC",
//         "DriverLicense",
//         "Passport",
//         "National ID Card",
//         "Driving License",
//       ],
//       required: true,
//     },
//     frontImageUrl: { type: String, required: true },
//     backImageUrl: { type: String }, // optional
//     submittedAt: { type: Date, default: Date.now },
//     verifiedAt: { type: Date },
//     status: {
//       type: String,
//       enum: ["Pending", "Approved", "Rejected"],
//       default: "Pending",
//     },
//     rejectionReason: { type: String }, // Only filled if status is Rejected
//   },
//   { timestamps: true }
// );

// const Kyc = mongoose.model("Kyc", kycSchema);
// module.exports = Kyc;
