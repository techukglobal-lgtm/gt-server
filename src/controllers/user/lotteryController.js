const Competition = require("../../models/Competetion");
const checkAuthorization = require("../../middlewares/authMiddleware");
const User = require("../../models/auth");
exports.getAllCompetitions = async (req, res) => {
  // const authuser = await checkAuthorization(req, res);
  // if (!authuser) {
  //   return res.status(401).json({
  //     success: false,
  //     message: "Unauthorized access",
  //   });
  // }
  try {
  } catch (error) {
    console.error("Error fetching competitions:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to fetch competitions.",
    });
  }
};

exports.toggleAutoPurchase = async (req, res) => {
  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const user = await User.findById(authuser);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Toggle autoPurchaseEnabled
    user.autoPurchaseEnabled = !user.autoPurchaseEnabled;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Auto purchase has been ${
        user.autoPurchaseEnabled ? "enabled" : "disabled"
      }.`,
      autoPurchaseEnabled: user.autoPurchaseEnabled,
    });
  } catch (error) {
    console.error("Error toggling auto purchase:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.toggleMixPurchase = async (req, res) => {
  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const user = await User.findById(authuser);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Toggle mix purchase
    user.mixPurchase = !user.mixPurchase;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Mix purchase has been ${
        user.mixPurchase ? "enabled" : "disabled"
      }.`,
      mixPurchase: user.mixPurchase,
    });
  } catch (error) {
    console.error("Error toggling auto purchase:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getWinnedCompetitions = async (req, res) => {
  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const wonCompetitions = await Competition.find({ winnerId: authuser });

    return res.status(200).json({
      success: true,
      data: wonCompetitions,
    });
  } catch (error) {
    console.error("Error fetching user's won competitions:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching competitions",
    });
  }
};
