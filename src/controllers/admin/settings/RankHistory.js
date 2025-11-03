const checkAuthorization = require("../../../middlewares/authMiddleware");
const RankHistory = require("../../../models/RankHistory");

exports.getAllRankHistory = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const rankHistories = await RankHistory.find()
      .populate("userId", "username email")
      .populate("oldRankId", "rank")
      .populate("newRankId", "rank")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: rankHistories,
      message: "Rank history retrieved successfully",
    });
  } catch (err) {
    console.error("Error fetching rank history:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching rank history",
    });
  }
};

exports.getCurrentUserRankHistory = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userRankHistories = await RankHistory.find({ userId: authUser })
      .populate("userId", "username email")
      .populate("oldRankId", "rank")
      .populate("newRankId", "rank")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: userRankHistories,
      message: "Current user's rank history retrieved successfully",
    });
  } catch (err) {
    console.error("Error fetching current user's rank history:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching current user's rank history",
    });
  }
};