// controllers/settings/directbonus.js
const checkAuthorization = require("../../../middlewares/authMiddleware");
const Settings = require("../../../models/settings"); // Use capital S to match your model export

exports.getAllSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // You can accept keyname from request body or default to "Direct Bonus"
    const { keyname = "Direct Bonus" } = req.body;
    
    let setting = await Settings.findOne({ keyname });
    
    // If setting doesn't exist, create it with default value
    if (!setting) {
      setting = new Settings({
        keyname,
        value: 10 // default value
      });
      await setting.save();
    }

    res.status(200).json({
      success: true,
      setting,
      message: "Settings retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while fetching settings" 
    });
  }
};

exports.updateDirectBonus = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { value } = req.body;
    
    // Validate input
    if (typeof value === "undefined" || value === null) {
      return res.status(400).json({ 
        success: false, 
        message: "Value is required" 
      });
    }

    if (isNaN(value) || value < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Value must be a non-negative number" 
      });
    }

    // Try to update existing setting, if not found create new one
    let setting = await Settings.findOneAndUpdate(
      { keyname: "Direct Bonus" },
      { $set: { value: parseFloat(value) } },
      { new: true, upsert: true } // upsert creates if doesn't exist
    );

    res.status(200).json({
      success: true,
      message: "Direct Bonus updated successfully",
      setting,
    });
  } catch (err) {
    console.error("Error updating Direct Bonus:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while updating Direct Bonus" 
    });
  }
};