// controllers/settings/rank.js
const checkAuthorization = require("../../../middlewares/authMiddleware");
const Rank = require("../../../models/Rank"); // Assuming your Rank model is in models folder

exports.getAllRanks = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const rankOrder = [
      "BEGINNER", "STAR", "IRON", "BRONZE", "COPPER", 
      "SILVER", "GOLD", "PLATINUM", "TITANIUM", "DIAMOND", 
      "SOLITAIRE", "IMMORTAL", "EMPEROR"
    ];

    const allRanks = await Rank.find({});
    
    const ranks = allRanks.sort((a, b) => {
      const indexA = rankOrder.indexOf(a.rank);
      const indexB = rankOrder.indexOf(b.rank);
      return indexA - indexB;
    });

    res.status(200).json({
      success: true,
      ranks,
      message: "Ranks retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching ranks:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while fetching ranks" 
    });
  }
};

exports.getRankById = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { rankId } = req.body;
    
    if (!rankId) {
      return res.status(400).json({ 
        success: false, 
        message: "Rank ID is required" 
      });
    }

    const rank = await Rank.findById(rankId);
    
    if (!rank) {
      return res.status(404).json({ 
        success: false, 
        message: "Rank not found" 
      });
    }

    res.status(200).json({
      success: true,
      rank,
      message: "Rank retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching rank:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while fetching rank" 
    });
  }
};

exports.updateRank = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { rankId, required, reward, extra } = req.body;
    
    // Validate input
    if (!rankId) {
      return res.status(400).json({ 
        success: false, 
        message: "Rank ID is required" 
      });
    }

    if (typeof required === "undefined" || required === null) {
      return res.status(400).json({ 
        success: false, 
        message: "Required value is required" 
      });
    }

    if (typeof reward === "undefined" || reward === null) {
      return res.status(400).json({ 
        success: false, 
        message: "Reward value is required" 
      });
    }

    if (isNaN(required) || required < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Required value must be a non-negative number" 
      });
    }

    if (isNaN(reward) || reward < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Reward value must be a non-negative number" 
      });
    }

    const existingRank = await Rank.findById(rankId);
    if (!existingRank) {
      return res.status(404).json({ 
        success: false, 
        message: "Rank not found" 
      });
    }

    const updatedRank = await Rank.findByIdAndUpdate(
      rankId,
      { 
        $set: { 
          "criteria.required": required.toString(),
          "criteria.reward": reward.toString(),
          "criteria.extra": extra !== undefined && extra !== null ? extra.toString() : "null"
        } 
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Rank updated successfully",
      rank: updatedRank,
    });
  } catch (err) {
    console.error("Error updating rank:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while updating rank" 
    });
  }
};
