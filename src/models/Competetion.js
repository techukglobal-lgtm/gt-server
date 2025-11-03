// // models/Competition.js
// const mongoose = require("mongoose");

// const CompetitionSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       required: [true, "Title is required"],
//       trim: true,
//       maxlength: [100, "Title cannot be more than 100 characters"],
//     },
//     description: {
//       type: String,
//       required: [true, "Description is required"],
//       trim: true,
//     },
//     availableTickets: {
//       type: Number,
//     },
//     featuredImage: { type: String, required: true },
//     pictures: {
//       type: [String],
//       validate: {
//         validator: function (arr) {
//           return arr.length > 0;
//         },
//         message: "At least one picture URL is required",
//       },
//     },
//     numberOfTickets: {
//       type: Number,
//       required: [true, "Number of tickets is required"],
//       min: [1, "Number of tickets must be at least 1"],
//     },
//     instagramLiveDrawLink: { type: String },
//     scheduledTime: {
//       type: Date,
//     },
//     ticketValue: {
//       type: Number,
//       required: [true, "Ticket value is required"],
//       min: [0, "Ticket value cannot be negative"],
//     },
//     startDateTime: {
//       type: Date,
//       required: [true, "Start date and time is required"],
//     },
//     isFeatured: {
//       type: Boolean,
//     },
//     endDateTime: {
//       type: Date,
//       required: [true, "End date and time is required"],
//     },
//     isPublished: {
//       type: Boolean,
//       default: false,
//     },
//     scheduledPublish: {
//       type: Boolean,
//       default: false,
//     },
//     winnerPicture: { type: String },
//     winnerId: { type: String },
//   },
//   {
//     timestamps: true,
//   }
// );
// // Default availableTickets to numberOfTickets
// CompetitionSchema.pre("save", function (next) {
//   if (
//     this.isNew &&
//     (this.availableTickets === undefined || this.availableTickets === null)
//   ) {
//     this.availableTickets = this.numberOfTickets;
//   }
//   next();
// });

// module.exports = mongoose.model("Competition", CompetitionSchema);
