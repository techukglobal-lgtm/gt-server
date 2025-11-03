const Kyc = require("../../models/kyc");
const User = require("../../models/auth");
const checkAuthorization = require("../../middlewares/authMiddleware");
// Apply for KYC
exports.applyKyc = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { userId, docType, frontImageUrl, backImageUrl } = req.body;

    const existing = await Kyc.findOne({ user: userId });

    // If KYC exists and status is not Rejected, block re-application
    if (existing && existing.status !== "Rejected") {
      return res.status(400).json({ message: "KYC already submitted" });
    }

    // If it's rejected, overwrite the existing application
    const newKycData = {
      user: userId,
      docType,
      frontImageUrl,
      backImageUrl,
      status: "Pending", // reset status
      rejectionReason: undefined, // clear previous reason
    };

    if (existing) {
      // Overwrite old rejected KYC
      await Kyc.findByIdAndUpdate(existing._id, newKycData, { new: true });
    } else {
      const newKyc = new Kyc(newKycData);
      await newKyc.save();
    }

    // Update user's kycStatus
    await User.findByIdAndUpdate(userId, {
      kycStatus: "pending",
      isKycVerified: false,
    });

    res.status(200).json({ message: "KYC submitted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to submit KYC", error: err.message });
  }
};

// Approve KYC
exports.approveKyc = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { userId } = req.body;

    const kyc = await Kyc.findOne({ user: userId });
    if (!kyc) {
      return res.status(404).json({ message: "KYC not found" });
    }

    // Update KYC status
    kyc.status = "Approved";
    kyc.verifiedAt = new Date();
    await kyc.save();

    // Delete all other rejected KYCs of this user (except this approved one)
    await Kyc.deleteMany({
      user: userId,
      status: "Rejected",
      _id: { $ne: kyc._id },
    });

    // Update user: isKycVerified + kycDoc
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isKycVerified: true,
        kycDoc: {
          docType: kyc.docType,
          frontImageUrl: kyc.frontImageUrl,
          backImageUrl: kyc.backImageUrl || "",
          submittedAt: kyc.submittedAt,
          verifiedAt: kyc.verifiedAt,
        },
      },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "KYC approved and user updated successfully", user });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to approve KYC", error: err.message });
  }
};

// Reject KYC
exports.rejectKyc = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId, reason } = req.body;

    const kyc = await Kyc.findOne({ user: userId });
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = "Rejected";
    kyc.rejectionReason = reason;
    await kyc.save();

    await User.findByIdAndUpdate(userId, { kycStatus: "noverified" });

    res.status(200).json({ message: "KYC rejected", reason });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to reject KYC", error: err.message });
  }
};

exports.getAllKycApplications = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const filter = {};
    if (req.body.status) {
      filter.status = req.body.status; // e.g., "Pending", "Approved", "Rejected"
    }

    const applications = await Kyc.find(filter)
      .populate("user", "username email") // adjust fields as needed
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (err) {
    console.error("Error fetching KYC applications:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC applications",
    });
  }
};

exports.getRejectedKycApplications = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    // Get the user ID from the request body
    const { userId } = req.body;

    // Validate if userId exists
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find all rejected KYC applications for the specified user
    const rejectedApplications = await Kyc.find({
      user: userId,
      status: "Rejected",
    })
      .populate("user", "username email") // adjust fields as needed
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: rejectedApplications,
    });
  } catch (err) {
    console.error("Error fetching rejected KYC applications:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rejected KYC applications",
    });
  }
};
