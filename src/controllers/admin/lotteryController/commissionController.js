const checkAuthorization = require("../../../middlewares/authMiddleware");
// const CommissionSettings = require("../../../models/Setting");

// Update commission settings
exports.updateCommissionSettings = async (req, res) => {
  try {
    // Check authorization
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      levels,
      withdrawalFee,
      isWithdrawalEnabled,
      levelBonus,
      commissionInLocked,
      managementFee,
    } = req.body;

    // Validate input
    if (levels && !Array.isArray(levels)) {
      return res
        .status(400)
        .json({ success: false, message: "Levels must be an array." });
    }

    if (levels) {
      for (const level of levels) {
        if (
          typeof level.level !== "number" ||
          typeof level.commissionPercentage !== "number"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each level must have a numeric 'level' and 'commissionPercentage'.",
          });
        }
      }
    }

    if (withdrawalFee !== undefined && typeof withdrawalFee !== "number") {
      return res
        .status(400)
        .json({ success: false, message: "Withdrawal fee must be a number." });
    }

    if (
      isWithdrawalEnabled !== undefined &&
      typeof isWithdrawalEnabled !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isWithdrawalEnabled must be a boolean.",
      });
    }

    // Fetch existing settings or create new
    let settings = await CommissionSettings.findOne();
    if (!settings) {
      settings = new CommissionSettings({});
    }

    // Update settings
    if (levels) settings.levels = levels;
    if (commissionInLocked) settings.commissionInLocked = commissionInLocked;
    if (levelBonus) settings.levelBonus = levelBonus;
    if (withdrawalFee !== undefined) settings.withdrawalFee = withdrawalFee;
    if (isWithdrawalEnabled !== undefined)
      settings.isWithdrawalEnabled = isWithdrawalEnabled;
    settings.managementFee = managementFee;

    await settings.save();

    res.status(200).json({
      success: true,
      message: "Commission settings updated successfully.",
      settings,
    });
  } catch (err) {
    console.error("Error updating commission settings:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get commission settings
exports.getCommissionSettings = async (req, res) => {
  try {
    // Fetch existing settings
    let settings = await CommissionSettings.findOne();

    // If no settings exist, create default settings
    if (!settings) {
      settings = new CommissionSettings({
        withdrawalFee: 0,
        isWithdrawalEnabled: true,
        levels: Array.from({ length: 10 }, (_, i) => ({
          level: i + 1,
          commissionPercentage: 0,
        })),
      });
      await settings.save();
    }

    res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error("Error fetching commission settings:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
