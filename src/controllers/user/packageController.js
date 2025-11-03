const Investment = require("../../models/Investment");
const checkAuthorization = require("../../middlewares/authMiddleware");
const mongoose = require("mongoose");
const MintingActivity = require("../../models/MintingActivity");

exports.getUserPackages = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const userObjectId = new mongoose.Types.ObjectId(authUser);

    // Get user investments with populated user data and minting activities
    const investments = await Investment.find({ userId: userObjectId })
      .populate("userId", "name email")
      .lean(); // Use lean() for better performance

    // Get all minting activities for these investments
    const investmentIds = investments.map((inv) => inv._id);
    const mintingActivities = await MintingActivity.find({
      investmentId: { $in: investmentIds },
    }).lean();

    // Get package details for each investment
    const packagesCollection = await mongoose.connection.db.collection(
      "packages"
    );
    const allPackages = await packagesCollection.find({}).toArray();

    // Combine data
    const packagesWithDetails = investments.map((investment) => {
      // Find minting activities for this investment
      const relatedMintingActivities = mintingActivities.filter(
        (activity) =>
          activity.investmentId.toString() === investment._id.toString()
      );

      // Find the original package details if needed
      // You might need to match based on some criteria from your hubPackage
      const packageDetails = allPackages.find((pkg) => {
        // Assuming you match by amount or some other criteria
        return pkg.amount === investment.hubPackage?.amount?.toString();
      });

      return {
        ...investment,
        mintingActivities: relatedMintingActivities,
        packageDetails: packageDetails || null,
        // Add computed fields
        hasActiveMinting: relatedMintingActivities.some(
          (activity) => activity.isActive
        ),
        totalInvested: relatedMintingActivities.reduce(
          (sum, activity) => sum + (activity.investedAmount || 0),
          0
        ),
        remainingAmount:
          investment.amount -
          relatedMintingActivities.reduce(
            (sum, activity) => sum + (activity.investedAmount || 0),
            0
          ),
      };
    });

    return res.status(200).json({
      success: true,
      message: "User packages fetched successfully.",
      data: packagesWithDetails,
    });
  } catch (err) {
    console.error("Error fetching user packages:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
