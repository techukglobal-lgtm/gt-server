// controllers/settings/buildingbonus.js
const checkAuthorization = require("../../../middlewares/authMiddleware");
const settings = require("../../../models/settings");

exports.getBuildingBonus = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get both Level1 and Remaining Level Building Bonus settings
    let level1Setting = await settings.findOne({ keyname: "Level1 Building Bonus" });
    let remainingLevelSetting = await settings.findOne({ keyname: "Remaining Level Building Bonus" });
   
    // If Level1 setting doesn't exist, create it with default value
    if (!level1Setting) {
      level1Setting = new settings({
        keyname: "Level1 Building Bonus",
        value: 5
      });
      await level1Setting.save();
    }

    // If Remaining Level setting doesn't exist, create it with default value
    if (!remainingLevelSetting) {
      remainingLevelSetting = new settings({
        keyname: "Remaining Level Building Bonus",
        value: 2
      });
      await remainingLevelSetting.save();
    }

    // Return combined data in the format frontend expects
    const combinedValue = {
      level1Bonus: parseFloat(level1Setting.value) || 5,
      remainingLevelBonus: parseFloat(remainingLevelSetting.value) || 2
    };

    res.status(200).json({
      success: true,
      setting: {
        keyname: "Building Bonus",
        value: combinedValue
      },
      message: "Building Bonus settings retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching Building Bonus settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching Building Bonus settings"
    });
  }
};

exports.updateBuildingBonus = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { level1Bonus, remainingLevelBonus } = req.body;
   
    // Validate input
    if (typeof level1Bonus === "undefined" || level1Bonus === null) {
      return res.status(400).json({
        success: false,
        message: "Level 1 Bonus is required"
      });
    }

    if (typeof remainingLevelBonus === "undefined" || remainingLevelBonus === null) {
      return res.status(400).json({
        success: false,
        message: "Remaining Level Bonus is required"
      });
    }

    if (isNaN(level1Bonus) || level1Bonus < 0) {
      return res.status(400).json({
        success: false,
        message: "Level 1 Bonus must be a non-negative number"
      });
    }

    if (isNaN(remainingLevelBonus) || remainingLevelBonus < 0) {
      return res.status(400).json({
        success: false,
        message: "Remaining Level Bonus must be a non-negative number"
      });
    }

    // Update Level1 Building Bonus
    await settings.findOneAndUpdate(
      { keyname: "Level1 Building Bonus" },
      { $set: { value: parseFloat(level1Bonus) } },
      { new: true, upsert: true }
    );

    // Update Remaining Level Building Bonus
    await settings.findOneAndUpdate(
      { keyname: "Remaining Level Building Bonus" },
      { $set: { value: parseFloat(remainingLevelBonus) } },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Building Bonus updated successfully",
      setting: {
        keyname: "Building Bonus",
        value: {
          level1Bonus: parseFloat(level1Bonus),
          remainingLevelBonus: parseFloat(remainingLevelBonus)
        }
      }
    });
  } catch (err) {
    console.error("Error updating Building Bonus:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating Building Bonus"
    });
  }
};