const checkAuthorization = require("../../../middlewares/authMiddleware");
const Settings = require("../../../models/settings");

// Get Withdrawal Fees
exports.getWithdrawalFees = async (req, res) => {
  try {
    const settingsData = await Settings.find({
      keyname: { $in: ["Withdrawal Fee BEP20", "Withdrawal Fee TRC20"] },
    });
    
    const response = {
      bep20: {
        fixedFee: 1,
        percentFee: 3,
      },
      trc20: {
        fixedFee: 5,
        percentFee: 3,
      },
    };

    settingsData.forEach((setting) => {
      if (setting.keyname === "Withdrawal Fee BEP20") {
        response.bep20 = {
          fixedFee: setting.fixedFee || 1,
          percentFee: setting.percentageFee || 3,
          updatedAt: setting.updatedAt,
        };
      } else if (setting.keyname === "Withdrawal Fee TRC20") {
        response.trc20 = {
          fixedFee: setting.fixedFee || 5,
          percentFee: setting.percentageFee || 3,
          updatedAt: setting.updatedAt,
        };
      }
    });
    
    res.json({ success: true, fees: response });
  } catch (error) {
    console.error("Error fetching withdrawal fees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal fees",
    });
  }
};

// Update Withdrawal Fees
exports.updateWithdrawalFees = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bep20, trc20 } = req.body;

    // Update BEP20 fees
    if (bep20) {
      await Settings.findOneAndUpdate(
        { keyname: "Withdrawal Fee BEP20" },
        { 
          fixedFee: bep20.fixedFee, 
          percentageFee: bep20.percentFee, 
          updatedAt: new Date() 
        },
        { upsert: true, new: true }
      );
    }

    // Update TRC20 fees
    if (trc20) {
      await Settings.findOneAndUpdate(
        { keyname: "Withdrawal Fee TRC20" },
        { 
          fixedFee: trc20.fixedFee, 
          percentageFee: trc20.percentFee, 
          updatedAt: new Date() 
        },
        { upsert: true, new: true }
      );
    }

    res.json({ 
      success: true, 
      message: "Withdrawal fees updated successfully" 
    });
  } catch (error) {
    console.error("Error updating withdrawal fees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update withdrawal fees",
    });
  }
};