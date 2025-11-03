const checkAuthorization = require("../../../middlewares/authMiddleware");
const LevelBonus = require("../../../models/levelBonus");

exports.getAllLevelBonuses = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find the single level bonus document
    let bonusDocument = await LevelBonus.findOne();
    
    // If no document exists, create one with default values
    if (!bonusDocument) {
      const defaultLevelBonuses = [];
      for (let i = 1; i <= 10; i++) {
        defaultLevelBonuses.push({
          level: i,
          percentage: 0
        });
      }
      
      bonusDocument = new LevelBonus({
        checkRank: false,
        levelBonuses: defaultLevelBonuses
      });
      
      await bonusDocument.save();
    }

    res.json({ 
      success: true, 
      bonuses: bonusDocument
    });
  } catch (err) {
    console.error("Error fetching level bonuses:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLevelBonus = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { levelBonuses, checkRank } = req.body;

    // Validation
    if (!Array.isArray(levelBonuses) || levelBonuses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "levelBonuses array is required and cannot be empty",
      });
    }

    if (typeof checkRank !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "checkRank must be a boolean value",
      });
    }

    // Validate each level bonus
    for (const bonus of levelBonuses) {
      if (!bonus.level || typeof bonus.level !== "number") {
        return res.status(400).json({
          success: false,
          message: "Each level bonus must have a valid level number",
        });
      }
      
      if (typeof bonus.percentage !== "number" || bonus.percentage < 0 || bonus.percentage > 100) {
        return res.status(400).json({
          success: false,
          message: "Each percentage must be a number between 0 and 100",
        });
      }
    }

    // Check if document exists
    let bonusDocument = await LevelBonus.findOne();
    
    if (bonusDocument) {
      // Update existing document
      bonusDocument.checkRank = checkRank;
      bonusDocument.levelBonuses = levelBonuses;
      await bonusDocument.save();
    } else {
      // Create new document
      bonusDocument = new LevelBonus({
        checkRank: checkRank,
        levelBonuses: levelBonuses
      });
      await bonusDocument.save();
    }

    res.json({
      success: true,
      message: "Level bonuses updated successfully",
      bonuses: bonusDocument,
    });
  } catch (err) {
    console.error("Error updating level bonuses:", err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${errors.join(', ')}`,
      });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate level found in level bonuses",
      });
    }
    
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};