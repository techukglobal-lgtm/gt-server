const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const rankHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        oldRankId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rank",
            required: true,
        },
        newRankId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rank",
            required: true,
        },
        reward: {
            type: Number,
            required: true,
        },
        extra: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "flushed"],
            default: "approved",
        },
        rankDetails: {
            note: {
                type: String,
                default: null,
            },
        },
        date: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true, // optional: adds createdAt and updatedAt fields
    }
);

module.exports = mongoose.model("RankHistory", rankHistorySchema);
