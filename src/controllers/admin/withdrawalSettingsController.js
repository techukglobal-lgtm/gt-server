// controllers/withdrawalSettingsController.js
const checkAuthorization = require("../../middlewares/authMiddleware");
const { default: withdrawalSettings } = require("../../models/withdrawalSettings");

exports.getWithdrawalSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find single document
    let setting = await withdrawalSettings.find({ keyname: "Withdrawal Settings" });

    // If not found, create default
    if (!setting || setting.length === 0) {
      setting = await withdrawalSettings.create({
        keyname: "Withdrawal Settings",
        value: {
          minWithdrawalAmount: 0,
          withdrawalFee: 0,
        },
      });
      setting = [setting]; // Wrap in array to match find() format
    }

    res.status(200).json({
      success: true,
      setting,
      message: "Withdrawal Settings fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching Withdrawal Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching Withdrawal Settings",
    });
  }
};

exports.updateWithdrawalSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { minWithdrawalAmount, withdrawalFee } = req.body.value;

    if (isNaN(minWithdrawalAmount) || minWithdrawalAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum Withdrawal Amount must be a non-negative number",
      });
    }

    if (isNaN(withdrawalFee) || withdrawalFee < 0) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal Fee must be a non-negative number",
      });
    }

    const updated = await withdrawalSettings.findOneAndUpdate(
      { keyname: "Withdrawal Settings" },
      {
        $set: {
          value: {
            minWithdrawalAmount: parseFloat(minWithdrawalAmount),
            withdrawalFee: parseFloat(withdrawalFee),
          },
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Withdrawal Settings updated successfully",
      setting: updated,
    });
  } catch (err) {
    console.error("Error updating Withdrawal Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating Withdrawal Settings",
    });
  }
};