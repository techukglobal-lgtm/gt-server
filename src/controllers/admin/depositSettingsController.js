const checkAuthorization = require("../../middlewares/authMiddleware");
const { default: depositSettings } = require("../../models/depositSettings");

exports.getDepositSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find single document
    let setting = await depositSettings.find({ keyname: "Deposit Settings" });

    // If not found, create default
    if (!setting) {
      setting = await depositSettings.create({
        keyname: "Deposit Settings",
        value: {
          walletAddress: "",
          minDepositAmount: 0,
        },
      });
    }

    res.status(200).json({
      success: true,
      setting,
      message: "Deposit Settings fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching Deposit Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching Deposit Settings",
    });
  }
};

exports.updateDepositSettings = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { walletAddress, minDepositAmount } = req.body.value;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet Address is required",
      });
    }

    if (isNaN(minDepositAmount) || minDepositAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum Deposit Amount must be a non-negative number",
      });
    }

    const updated = await depositSettings.findOneAndUpdate(
      { keyname: "Deposit Settings" },
      {
        $set: {
          value: {
            walletAddress,
            minDepositAmount: parseFloat(minDepositAmount),
          },
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Deposit Settings updated successfully",
      setting: updated,
    });
  } catch (err) {
    console.error("Error updating Deposit Settings:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating Deposit Settings",
    });
  }
};
