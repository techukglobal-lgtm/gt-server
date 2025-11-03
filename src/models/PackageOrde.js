const mongoose = require("mongoose");

const packageOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packages",
      required: true,
    },

    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },

    packageDetails: {
      amount: { type: Number, required: true },
      hubPrice: { type: Number, required: true },
      hubCapacity: { type: Number, required: true },
      minimumMinting: { type: Number, required: true },
    },

    paymentDetails: {
      paymentMethod: {
        type: String,
        enum: ["wallet", "crypto", "bank", "card"],
        required: true,
      },

      transactionId: { type: String },
      paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },

      paymentDate: { type: Date },
      walletUsed: {
        bep20: { type: Number, default: 0 },
        trc20: { type: Number, default: 0 },
        walletBalance: { type: Number, default: 0 },
      },
    },

    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "active", "expired", "cancelled"],
      default: "pending",
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    
    activationDate: { type: Date },
    expiryDate: { type: Date }, // if packages have expiry

    // Commission related (if applicable)
    commissionGenerated: {
      directCommission: { type: Number, default: 0 },
      levelCommission: { type: Number, default: 0 },
      totalCommission: { type: Number, default: 0 },
    },

    // MLM related
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    notes: {
      type: String,
    },

    // Admin fields
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Generate unique order number before saving
packageOrderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("PackageOrder").countDocuments();
    this.orderNumber = `PKG${Date.now()}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

const PackageOrder = mongoose.model("PackageOrder", packageOrderSchema);
module.exports = PackageOrder;
