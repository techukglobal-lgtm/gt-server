// controllers/rankQualificationController.js
const checkAuthorization = require("../../middlewares/authMiddleware");
const User = require("../../models/auth");
const Rank = require("../../models/Rank");
const Order = require("../../models/Order");
const mongoose = require("mongoose");
const Investment = require("../../models/Investment");


const isUserActive = async (userId) => {
  try {
    const user = await User.findById(userId);
    const isActive = user?.eligibeToSponsor == true;
    // console.log(`[isUserActive] User ${userId} eligible:`, isActive);
    return isActive;
  } catch (error) {
    console.error(`[isUserActive] Error for ${userId}:`, error);
    return false;
  }
};

const getDownlineCounts = async (userId, maxDepth = 5) => {
  try {
    const result = {
      totalDownline: 0,
      activeMembers: 0,
      byRank: {
        Bronze: 0,
        Silver: 0,
        Gold: 0,
        Titanium: 0,
        Platinum: 0,
        Diamond: 0,
      },
      byLeg: {},
      legPercentages: {},
    };

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      console.error("[getDownlineCounts] User not found");
      return result;
    }

    const referralCode = currentUser.refferrCode; // 👈 Assuming this field exists
    // console.log(
    //   `[getDownlineCounts] Using referral code ${referralCode} for user ${userId}`
    // );

    // Get all users directly sponsored by this user (first level)
    const firstLevel = await User.find({ refferBy: referralCode });
    // console.log(
    //   `[getDownlineCounts] First-level users for ${referralCode}:`,
    //   firstLevel.map((u) => u._id.toString())
    // );

    for (const frontline of firstLevel) {
      const legId = frontline._id.toString();

      result.byLeg[legId] = {
        activeMembers: 0,
        byRank: {
          Bronze: 0,
          Silver: 0,
          Gold: 0,
          Titanium: 0,
          Platinum: 0,
          Diamond: 0,
        },
      };

      const queue = [{ user: frontline, level: 1 }];
      while (queue.length > 0) {
        const { user, level } = queue.shift();
        if (level > maxDepth) continue;

        const active = await isUserActive(user._id);
        if (active) {
          result.activeMembers++;
          result.byLeg[legId].activeMembers++;

          if (user.rank) {
            result.byRank[user.rank]++;
            result.byLeg[legId].byRank[user.rank]++;
          }
        }

        if (level < maxDepth) {
          const children = await User.find({ refferBy: user.referralCode });
          queue.push(
            ...children.map((child) => ({ user: child, level: level + 1 }))
          );
        }
      }
    }

    result.totalDownline = result.activeMembers;
    if (result.totalDownline > 0) {
      for (const legId in result.byLeg) {
        result.legPercentages[legId] =
          (result.byLeg[legId].activeMembers / result.totalDownline) * 100;
      }
    }

    return result;
  } catch (error) {
    console.error("Error getting downline counts:", error);
    return null;
  }
};

const calculateQualificationRank = (isActive, downlineCounts) => {
  if (!isActive) {
    // console.log(`[calculateQualificationRank] User inactive, rank = null`);
    return null;
  }

  let rank = "Blue";
  const hasValidLegDistribution = () => {
    for (const legId in downlineCounts.legPercentages) {
      if (downlineCounts.legPercentages[legId] > 40) {
        // console.log(
        //   `[RankCheck] Leg ${legId} exceeds 40% (${downlineCounts.legPercentages[
        //     legId
        //   ].toFixed(2)}%)`
        // );
        return false;
      }
    }
    return true;
  };

  if (!hasValidLegDistribution()) return rank;

  if (downlineCounts.activeMembers >= 5) {
    rank = "Bronze";
  } else return rank;

  if (downlineCounts.byRank.Bronze >= 5) {
    rank = "Silver";
  } else return rank;

  if (downlineCounts.byRank.Silver >= 5) {
    rank = "Gold";
  } else return rank;

  if (downlineCounts.byRank.Gold >= 5) {
    rank = "Titanium";
  } else return rank;

  if (downlineCounts.byRank.Titanium >= 5) {
    rank = "Platinum";
  } else return rank;

  if (downlineCounts.byRank.Platinum >= 5) {
    rank = "Diamond";
  }

  // console.log(`[calculateQualificationRank] Final calculated rank: ${rank}`);
  return rank;
};

exports.updateUserRank = async (req, res) => {
  try {
    const authuser = await checkAuthorization(req, res);
    if (!authuser) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    const user = await User.findById(authuser);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // console.log(`[updateUserRank] Starting for user ${authuser}`);

    const isActive = await isUserActive(authuser);
    if (!isActive) {
      user.rank = null;
      await user.save();
      // console.log(`[updateUserRank] User inactive, rank set to null`);
      return res.json({ success: true, user });
    }

    let rank = "Blue";

    const downlineData = await getDownlineCounts(authuser, 5);
    if (downlineData) {
      rank = calculateQualificationRank(isActive, downlineData);
    }

    user.rank = rank;
    await user.save();

    // console.log(
    //   `[updateUserRank] Updated rank for user ${authuser} to ${rank}`
    // );

    res.json({ success: true, user });
  } catch (error) {
    console.error(`[updateUserRank] Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// exports.updateAllRanks = async () => {
//   try {
//     const users = await User.find({});
//     let updated = 0;
//     let errors = 0;

//     for (const user of users) {
//       const result = await exports.updateUserRank(user._id);
//       if (result.success) {
//         updated++;
//       } else {
//         errors++;
//       }
//     }

//     return {
//       success: true,
//       totalProcessed: users.length,
//       updated,
//       errors,
//     };
//   } catch (error) {
//     console.error("Error updating all ranks:", error);
//     return { success: false, error: error.message };
//   }
// };

// /**
//  * Triggers rank calculation when a new order is placed
//  * Updates the buyer and their upline's ranks
//  * @param {String} buyerId - The ID of the user who placed the order
//  * @returns {Promise<Object>} - Success status
//  */
// exports.processRankAfterPurchase = async (buyerId) => {
//   try {
//     // First update the buyer's rank
//     await exports.updateUserRank(buyerId);

//     // Then update their sponsor's rank and upline
//     let currentId = buyerId;
//     const processedIds = new Set(); // Prevent infinite loops in case of circular references

//     // Process up to 7 levels up (enough to influence Diamond qualification)
//     for (let i = 0; i < 7; i++) {
//       const user = await User.findById(currentId);
//       if (!user || !user.refferBy || processedIds.has(user.refferBy)) {
//         break;
//       }

//       // Mark as processed
//       processedIds.add(user.refferBy);

//       // Update the sponsor's rank
//       await exports.updateUserRank(user.refferBy);

//       // Move up to the next level
//       currentId = user.refferBy;
//     }

//     return { success: true };
//   } catch (error) {
//     console.error("Error processing ranks after purchase:", error);
//     return { success: false, error: error.message };
//   }
// };

// /**
//  * API endpoint to manually trigger rank updates
//  */
// exports.triggerRankUpdate = async (req, res) => {
//   try {
//     let result;

//     // If userId is provided, update just that user
//     if (req.params.userId) {
//       result = await exports.updateUserRank(req.params.userId);
//     } else {
//       // Otherwise update all users
//       result = await exports.updateAllRanks();
//     }

//     return res.status(200).json(result);
//   } catch (error) {
//     console.error("Error in rank update API:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

/**
 * Schedule periodic rank updates (e.g., run this on a cron job)
 */
// exports.scheduleRankUpdates = () => {
//   console.log("Scheduling rank updates...");
//   // This function would be called by your scheduler/cron setup
//   // For example with node-cron:
//   // cron.schedule('0 0 * * *', async () => {
//   //   console.log('Running scheduled rank update');
//   //   await exports.updateAllRanks();
//   // });
// };

// Function to be called when order status changes to completed
// exports.handleOrderCompleted = async (orderId) => {
//   try {
//     const order = await Order.findById(orderId);
//     if (order && order.paymentStatus === "completed") {
//       await exports.processRankAfterPurchase(order.buyerId);
//     }
//     return { success: true };
//   } catch (error) {
//     console.error("Error handling order completion:", error);
//     return { success: false, error: error.message };
//   }
// };



exports.userRank = async () => {
  try {
    const user = await User.findOne({ username: "usman" });
    const userArray = user ? [user] : [];

    console.log(userArray); // Always an array

    for (const user of userArray) {
      const refferrCode = user.refferrCode;

      // Find referred users
      const referredUsers = await User.find({ refferBy: refferrCode });
      const referredUserIds = referredUsers.map(u => u._id);

      // Aggregate investments by referrals
      const referralInvestments = await Investment.aggregate([
        {
          $match: {
            userId: { $in: referredUserIds }
          }
        },
        {
          $group: {
            _id: "$userId",
            totalInvested: { $sum: "$hubPackage.amount" }
          }
        }
      ]);

      const totalBusiness = referralInvestments.reduce((acc, cur) => acc + cur.totalInvested, 0);
      const maxInvest = referralInvestments.reduce((max, cur) => Math.max(max, cur.totalInvested), 0);

      console.log(totalBusiness)
      console.log(maxInvest)

    }

  } catch (error) {
    console.error("Rank assignment error:", error);
    return [];
  }
};

module.exports = exports;
