// controllers/dailyCommissionSettingsController.js
const checkAuthorization = require("../../middlewares/authMiddleware");
const { default: dailyCommissionSettings } = require("../../models/dailyCommissionSettings");

exports.getDailyCommissionSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find single document
    let setting = await dailyCommissionSettings.find({ 
      keyname: "Daily Commission Settings" 
    });

    // If not found, create default
    if (!setting || setting.length === 0) {
      setting = await dailyCommissionSettings.create({
        keyname: "Daily Commission Settings",
        value: {
          startingLevel: 0,
          endingLevel: 0,
        },
      });
      setting = [setting]; // Wrap in array to match find() format
    }

    res.status(200).json({
      success: true,
      setting,
      message: "Daily Commission Settings fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching Daily Commission Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching Daily Commission Settings",
    });
  }
};

exports.updateDailyCommissionSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { startingLevel, endingLevel } = req.body.value;

    // Validation for startingLevel
    if (isNaN(startingLevel) || startingLevel < 0 || startingLevel > 100) {
      return res.status(400).json({
        success: false,
        message: "Starting Level must be between 0 and 100",
      });
    }

    // Validation for endingLevel
    if (isNaN(endingLevel) || endingLevel < 0 || endingLevel > 100) {
      return res.status(400).json({
        success: false,
        message: "Ending Level must be between 0 and 100",
      });
    }

    // Optional: Check if ending level is greater than or equal to starting level
    if (parseFloat(endingLevel) < parseFloat(startingLevel)) {
      return res.status(400).json({
        success: false,
        message: "Ending Level must be greater than or equal to Starting Level",
      });
    }

    const updated = await dailyCommissionSettings.findOneAndUpdate(
      { keyname: "Daily Commission Settings" },
      {
        $set: {
          value: {
            startingLevel: parseFloat(startingLevel),
            endingLevel: parseFloat(endingLevel),
          },
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Daily Commission Settings updated successfully",
      setting: updated,
    });
  } catch (err) {
    console.error("Error updating Daily Commission Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating Daily Commission Settings",
    });
  }
};