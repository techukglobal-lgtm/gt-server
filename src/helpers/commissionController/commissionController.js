const mongoose = require("mongoose");
const User = require("../../models/auth");
const Transaction = require("../../models/Transaction");
const {
  default: referralCommissionSettings,
} = require("../../models/referralCommissionSettings");

const LEVEL_PERCENTAGES = {
  1: 12,
  2: 3,
  3: 2,
  4: 1,
};

/**
 * Distribute MLM commissions up to 4 levels.
 * @param {String} userId - The user who triggered the commission (buyer/downline)
 * @param {Number} amount - The total amount to calculate commission from
 */

// async function distributeMLMCommissions(userId, amount) {
//   try {
//     // Fetch base user
//     let currentUser = await User.findById(userId);
//     if (!currentUser) throw new Error("User not found");

//     let currentLevel = 1;
//     let uplineId = currentUser.refferBy;

//     // Track uplines up to 4 levels
//     while (uplineId && currentLevel <= 4) {
//       const uplineUser = await User.findOne({ refferrCode: uplineId });
//       if (!uplineUser) break;

//       const percentage = LEVEL_PERCENTAGES[currentLevel];
//       const commissionAmount = (amount * percentage) / 100;

//       // ✅ Condition: Only give direct (level 1) commission if upline has referred at least 2 people
//       if (currentLevel === 1) {
//         const referredCount = await User.countDocuments({
//           refferBy: uplineUser.refferrCode,
//         });

//         if (referredCount < 2) {
//           console.log(
//             `⚠️ ${uplineUser.username} did not meet the referral condition (has ${referredCount} referrals). Direct commission skipped.`
//           );
//           // Move up one level without giving commission
//           uplineId = uplineUser.refferBy;
//           currentUser = uplineUser;
//           currentLevel++;
//           continue;
//         }
//       }

//       // Update upline wallet balance
//       uplineUser.walletBalance =
//         (uplineUser.walletBalance || 0) + commissionAmount;
//       await uplineUser.save();

//       // Create transaction document
//       const transaction = new Transaction({
//         senderId: 0, // Admin as sender
//         receiverId: uplineUser._id,
//         amount: commissionAmount,
//         paymentMethod: "SYSTEM",
//         transactionType: `level_commission_${currentLevel}`,
//         status: "completed",
//         commissionDetails: {
//           level: currentLevel,
//           percentage: percentage,
//           buyerId: currentUser._id,
//           buyerUsername: currentUser.username,
//           note: `Level ${currentLevel} commission (${percentage}%) from ${currentUser.username}`,
//         },
//       });

//       await transaction.save();

//       // Move up one level
//       uplineId = uplineUser.refferBy;
//       currentUser = uplineUser;
//       currentLevel++;
//     }

//     console.log("✅ MLM Commission distributed successfully.");
//     return { success: true, message: "Commissions distributed successfully." };
//   } catch (error) {
//     console.error("❌ Error distributing MLM commissions:", error);
//     return { success: false, message: error.message };
//   }
// }

// module.exports = distributeMLMCommissions;

async function distributeMLMCommissions(userId, amount) {
  try {
    // Fetch base user
    let currentUser = await User.findById(userId);
    if (!currentUser) throw new Error("User not found");

    // ✅ Fetch commission settings dynamically from DB
    const settingsDoc = await referralCommissionSettings.findOne({
      keyname: "Referral Commission Settings",
    });

    // If no settings found, throw error
    if (!settingsDoc) {
      throw new Error("Referral commission settings not found in database");
    }

    const LEVEL_PERCENTAGES = {
      1: settingsDoc.value.level1,
      2: settingsDoc.value.level2,
      3: settingsDoc.value.level3,
      4: settingsDoc.value.level4,
    };

    let currentLevel = 1;
    let uplineId = currentUser.refferBy;

    // Track uplines up to 4 levels
    while (uplineId && currentLevel <= 4) {
      const uplineUser = await User.findOne({ refferrCode: uplineId });
      if (!uplineUser) break;

      const percentage = LEVEL_PERCENTAGES[currentLevel] || 0;
      const commissionAmount = (amount * percentage) / 100;

      // ✅ Condition: Only give direct (level 1) commission if upline has referred at least 2 people
      if (currentLevel === 1) {
        const referredCount = await User.countDocuments({
          refferBy: uplineUser.refferrCode,
        });

        if (referredCount < 2) {
          console.log(
            `⚠️ ${uplineUser.username} did not meet the referral condition (has ${referredCount} referrals). Direct commission skipped.`
          );
          uplineId = uplineUser.refferBy;
          currentUser = uplineUser;
          currentLevel++;
          continue;
        }
      }

      // Update upline wallet balance
      uplineUser.walletBalance =
        (uplineUser.walletBalance || 0) + commissionAmount;
      await uplineUser.save();

      // Create transaction record
      const transaction = new Transaction({
        senderId: 0, // Admin/system sender
        receiverId: uplineUser._id,
        amount: commissionAmount,
        paymentMethod: "SYSTEM",
        transactionType: `level_commission_${currentLevel}`,
        status: "completed",
        commissionDetails: {
          level: currentLevel,
          percentage: percentage,
          buyerId: currentUser._id,
          buyerUsername: currentUser.username,
          note: `Level ${currentLevel} commission (${percentage}%) from ${currentUser.username}`,
        },
      });

      await transaction.save();

      // Move to next level
      uplineId = uplineUser.refferBy;
      currentUser = uplineUser;
      currentLevel++;
    }

    console.log("✅ MLM Commission distributed successfully.");
    return { success: true, message: "Commissions distributed successfully." };
  } catch (error) {
    console.error("❌ Error distributing MLM commissions:", error);
    return { success: false, message: error.message };
  }
}

module.exports = distributeMLMCommissions;
