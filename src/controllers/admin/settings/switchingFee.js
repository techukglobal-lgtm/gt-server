// controllers/settings/switchingfee.js
const checkAuthorization = require("../../../middlewares/authMiddleware");
const Settings = require("../../../models/settings"); 

exports.getSwitchingFee = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const { keyname = "Switching Fee" } = req.body;
   
    let setting = await Settings.findOne({ keyname });
   
    if (!setting) {
      setting = new Settings({
        keyname,
        value: 0 
      });
      await setting.save();
    }
    
    res.status(200).json({
      success: true,
      setting,
      message: "Switching Fee settings retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching Switching Fee settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching Switching Fee settings"
    });
  }
};

exports.updateSwitchingFee = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const { value } = req.body;
   
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
    
    let setting = await Settings.findOneAndUpdate(
      { keyname: "Switching Fee" },
      { $set: { value: parseFloat(value) } },
      { new: true, upsert: true } 
    );
    
    res.status(200).json({
      success: true,
      message: "Switching Fee updated successfully",
      setting,
    });
  } catch (err) {
    console.error("Error updating Switching Fee:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating Switching Fee"
    });
  }
};