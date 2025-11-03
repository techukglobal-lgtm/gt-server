// // models/Order.js
// const mongoose = require("mongoose");

// const OrderSchema = new mongoose.Schema({
//   // Customer Information
//   firstName: {
//     type: String,
//     required: [true, "First name is required"],
//   },
//   buyerId: { type: String, required: true },
//   lastName: {
//     type: String,
//     required: [true, "Last name is required"],
//   },
//   country: {
//     type: String,
//     required: [true, "Country is required"],
//   },
//   zipCode: {
//     type: String,
//     required: [true, "Zip/Postal code is required"],
//   },
//   address: {
//     type: String,
//     required: [true, "Address is required"],
//   },
//   city: {
//     type: String,
//     required: [true, "Town/City is required"],
//   },
//   phone: {
//     type: String,
//     required: [true, "Phone number is required"],
//   },
//   email: {
//     type: String,
//     required: [true, "Email is required"],
//     match: [
//       /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
//       "Please provide a valid email",
//     ],
//   },

//   // Order Details
//   competitionId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Competition",
//     required: [true, "Competition ID is required"],
//   },
//   competitionTitle: {
//     type: String,
//     required: [true, "Competition title is required"],
//   },
//   selectedImage: {
//     type: String,
//     required: false,
//   },

//   // Ticket Details
//   isVipPack: {
//     type: Boolean,
//     default: false,
//   },
//   ticketQuantity: {
//     type: Number,
//     required: [true, "Ticket quantity is required"],
//     min: [1, "Minimum ticket quantity is 1"],
//   },
//   vipPackDetails: {
//     tickets: Number,
//     discount: Number,
//     chance: String,
//   },

//   // Financial Details
//   ticketPrice: {
//     type: Number,
//     required: [true, "Ticket price is required"],
//   },
//   totalCost: {
//     type: Number,
//     required: [true, "Total cost is required"],
//   },
//   isAutoPurchase: {
//     type: Boolean,
//     default: false,
//   },

//   // Payment Information
//   paymentStatus: {
//     type: String,
//     enum: ["pending", "completed", "failed", "refunded"],
//     default: "pending",
//   },
//   paymentMethod: {
//     type: String,
//     required: false,
//   },
//   paymentId: {
//     type: String,
//     required: false,
//   },

//   // Timestamps
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// // Pre-save hook to update the updatedAt field
// OrderSchema.pre("save", function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

// module.exports = mongoose.model("Order", OrderSchema);
