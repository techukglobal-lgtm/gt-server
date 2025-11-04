// controllers/referralCommissionSettingsController.js
const checkAuthorization = require("../../middlewares/authMiddleware");
const { default: referralCommissionSettings } = require("../../models/referralCommissionSettings");

exports.getReferralCommissionSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find single document
    let setting = await referralCommissionSettings.find({ 
      keyname: "Referral Commission Settings" 
    });

    // If not found, create default
    if (!setting || setting.length === 0) {
      setting = await referralCommissionSettings.create({
        keyname: "Referral Commission Settings",
        value: {
          level1: 0,
          level2: 0,
          level3: 0,
          level4: 0,
        },
      });
      setting = [setting]; // Wrap in array to match find() format
    }

    res.status(200).json({
      success: true,
      setting,
      message: "Referral Commission Settings fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching Referral Commission Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching Referral Commission Settings",
    });
  }
};

exports.updateReferralCommissionSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { level1, level2, level3, level4 } = req.body.value;

    // Validation for level1
    if (isNaN(level1) || level1 < 0 || level1 > 100) {
      return res.status(400).json({
        success: false,
        message: "Level 1 commission must be between 0 and 100",
      });
    }

    // Validation for level2
    if (isNaN(level2) || level2 < 0 || level2 > 100) {
      return res.status(400).json({
        success: false,
        message: "Level 2 commission must be between 0 and 100",
      });
    }

    // Validation for level3
    if (isNaN(level3) || level3 < 0 || level3 > 100) {
      return res.status(400).json({
        success: false,
        message: "Level 3 commission must be between 0 and 100",
      });
    }

    // Validation for level4
    if (isNaN(level4) || level4 < 0 || level4 > 100) {
      return res.status(400).json({
        success: false,
        message: "Level 4 commission must be between 0 and 100",
      });
    }

    const updated = await referralCommissionSettings.findOneAndUpdate(
      { keyname: "Referral Commission Settings" },
      {
        $set: {
          value: {
            level1: parseFloat(level1),
            level2: parseFloat(level2),
            level3: parseFloat(level3),
            level4: parseFloat(level4),
          },
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Referral Commission Settings updated successfully",
      setting: updated,
    });
  } catch (err) {
    console.error("Error updating Referral Commission Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating Referral Commission Settings",
    });
  }
};