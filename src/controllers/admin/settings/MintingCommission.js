const checkAuthorization = require("../../../middlewares/authMiddleware");
const MintingCommission = require("../../../models/MintingCommission");

exports.getAllMintingCommissions = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  
  try {
    const commissions = await MintingCommission.find();
    res.status(200).json({ success: true, commissions });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateMintingCommission = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  
  try {
    const { commissionType, rates } = req.body;

    if (!commissionType || !rates) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }

    const updatedCommission = await MintingCommission.findOneAndUpdate(
      { commissionType: commissionType },
      { $set: { rates: rates } },
      { new: true }
    );

    if (!updatedCommission) {
      return res
        .status(404)
        .json({ success: false, message: "Commission type not found" });
    }

    res.status(200).json({ success: true, commission: updatedCommission });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
