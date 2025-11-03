const cron = require("node-cron");
const Transaction = require("../../../models/Transaction");
const User = require("../../../models/auth");
// const Settings = require("../../../models/Setting");
const Order = require("../../../models/Order");
const moment = require("moment");

/**
 * Process pending referral transactions and distribute to user wallets
 * - Finds all pending referral transactions
 * - Gets commission settings
 * - For each transaction, distributes commission between locked and withdrawable balances
 * - Updates user wallet balances and marks transactions as approved
 */

const MIN_TICKETS_REQUIRED = 1;

// COMMENTED OUT - Eligibility window check disabled
/*
async function isWithinEligibilityWindow(user) {
  if (!user) {
    console.log("Cannot check eligibility window: User object is null");
    return false;
  }

  // Find the first ticket purchased by this user
  const firstTicket = await Order.findOne({
    buyerId: user._id,
    paymentStatus: "completed",
  }).sort({ createdAt: 1 });

  // Determine the start date for the eligibility window
  let startDate;
  if (firstTicket) {
    startDate = moment(firstTicket.createdAt);
  } else {
    startDate = moment(user.createdAt);
  }

  // Calculate the end of the eligibility window (30 days from start)
  const endDate = startDate.clone().add(30, "days");

  // Check if current date is within the eligibility window
  const isEligible = moment().isBefore(endDate);

  console.log(`Eligibility window check for ${user.username}:`);
  console.log(
    `- Registration date: ${moment(user.createdAt).format("YYYY-MM-DD")}`
  );
  console.log(
    `- First ticket date: ${
      firstTicket ? moment(firstTicket.createdAt).format("YYYY-MM-DD") : "None"
    }`
  );
  console.log(`- Window start date: ${startDate.format("YYYY-MM-DD")}`);
  console.log(`- Window end date: ${endDate.format("YYYY-MM-DD")}`);
  console.log(`- Current date: ${moment().format("YYYY-MM-DD")}`);
  console.log(`- Is within window: ${isEligible}`);

  return isEligible;
}
*/

// COMMENTED OUT - Commission qualification check disabled
/*
async function isQualifiedForCommission(userId) {
  if (!userId) {
    console.log("Cannot check qualification: User ID is null");
    return false;
  }

  const user = await User.findById(userId);

  if (!user) {
    console.log("User not found");
    return false;
  }

  // Find the first ticket purchase
  const firstTicket = await Order.findOne({
    buyerId: userId,
    paymentStatus: "completed",
  }).sort({ createdAt: 1 });

  // If no ticket purchased yet, user is not yet qualified
  if (!firstTicket) {
    console.log(`User ${user.username} hasn't purchased any tickets yet`);
    return false;
  }

  // If user is within their initial eligibility window, they automatically qualify
  const isWithinWindow = await isWithinEligibilityWindow(user);
  if (isWithinWindow) {
    console.log(
      `User ${user.username} is within initial eligibility window - automatically qualified`
    );
    return true;
  }

  // If outside initial window, check qualification criteria from previous month
  console.log(
    `User ${user.username} is outside initial window - checking monthly qualification`
  );
  return await isQualifiedLastMonth(userId);
}
*/

// COMMENTED OUT - Last month qualification check disabled
/*
async function isQualifiedLastMonth(userId) {
  if (!userId) {
    console.log("Cannot check qualification: User ID is null");
    return false;
  }

  const now = moment();
  const startOfLastMonth = now.clone().subtract(1, "month").startOf("month");
  const endOfLastMonth = now.clone().subtract(1, "month").endOf("month");

  console.log(`Qualification check for user ${userId}:`);
  console.log(
    `- Last month period: ${startOfLastMonth.format(
      "YYYY-MM-DD"
    )} to ${endOfLastMonth.format("YYYY-MM-DD")}`
  );

  // Check ticket purchase
  const ticketCount = await Order.countDocuments({
    buyerId: userId,
    paymentStatus: "completed",
    createdAt: {
      $gte: startOfLastMonth.toDate(),
      $lte: endOfLastMonth.toDate(),
    },
  });

  console.log(
    `- Tickets purchased last month: ${ticketCount} (minimum required: ${MIN_TICKETS_REQUIRED})`
  );

  if (ticketCount >= MIN_TICKETS_REQUIRED) {
    console.log("- Qualified: Has sufficient ticket purchases");
    return true;
  }

  // Check if sponsored any active user
  const user = await User.findById(userId);
  if (!user || !user.refferrCode) {
    console.log("- User not found or has no referral code");
    return false;
  }

  const sponsoredUsers = await User.find({ refferBy: user.refferrCode });
  console.log(`- Number of sponsored users: ${sponsoredUsers.length}`);

  let activeReferralFound = false;
  for (const sponsored of sponsoredUsers) {
    console.log(
      `-- Checking sponsored user: ${sponsored.username || sponsored._id}`
    );
    const boughtTicket = await Order.exists({
      buyerId: sponsored._id,
      paymentStatus: "completed",
      createdAt: {
        $gte: startOfLastMonth.toDate(),
        $lte: endOfLastMonth.toDate(),
      },
    });

    if (boughtTicket) {
      console.log(
        `- Qualified: Sponsored user ${
          sponsored.username || sponsored._id
        } purchased tickets last month`
      );
      activeReferralFound = true;
      break;
    } else {
      console.log(
        `-- No ticket purchases found for ${
          sponsored.username || sponsored._id
        }`
      );
    }
  }

  return activeReferralFound;
}
*/

async function processReferralCommissions() {
  try {
    console.log("Starting to process pending referral commissions...");

    // Get commission settings
    const settings = await Settings.findOne({});
    if (!settings) {
      console.error("Commission settings not found");
      return;
    }

    // Get locked commission percentage (convert from percentage to decimal)
    const lockedPercentage = settings.commissionInLocked / 100;

    // Find all pending referral transactions
    const pendingTransactions = await Transaction.find({
      status: "pending",
      transactionType: { $in: ["referral_bonus", "direct_referral_bonus"] },
    });

    console.log(
      `Found ${pendingTransactions.length} pending referral transactions to process`
    );

    for (const transaction of pendingTransactions) {
      // Skip transactions where receiverId is 0 (admin)
      const user = await User.findById(transaction.receiverId);
      if (transaction.receiverId === 0) {
        console.log(
          `Skipping transaction ${transaction._id} as receiver is admin`
        );
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: "approved",
        });
        continue;
      }

      // COMMENTED OUT - Eligibility check disabled for now
      /*
      // 🔐 Check user eligibility before processing commission
      const isQualified = await isQualifiedForCommission(
        transaction.receiverId
      );
      if (!isQualified) {
        console.log(
          `User ${user.username} is not qualified for commission. Skipping transaction ${transaction._id}`
        );
        continue;
      }
      */

      // Calculate locked and withdrawable amounts
      const totalAmount = transaction.amount;
      const lockedAmount = totalAmount * lockedPercentage;
      const withdrawableAmount = totalAmount - lockedAmount;

      console.log(
        `Processing transaction ${transaction._id} for user ${transaction.receiverId}`
      );
      console.log(
        `Total: ${totalAmount}, Locked: ${lockedAmount}, Withdrawable: ${withdrawableAmount}`
      );

      // Update user wallet balances

      if (!user) {
        console.error(`User not found for transaction ${transaction._id}`);
        continue;
      }

      // Update user balances
      await User.findByIdAndUpdate(transaction.receiverId, {
        $inc: {
          walletBalance: totalAmount,
          commissionEarned: totalAmount,
          commissionLocked: lockedAmount,
          commissionWithdrawable: withdrawableAmount,
          pendingCommissions: -totalAmount, // Decrease pending commissions
        },
      });

      // Mark transaction as approved
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: "approved",
      });

      console.log(`Successfully processed transaction ${transaction._id}`);
    }

    console.log("Finished processing referral commissions");
  } catch (error) {
    console.error("Error processing referral commissions:", error);
  }
}

// Schedule the cron job to run daily at midnight
function startCronJob() {
  // Run every day at 3:05 PM
  cron.schedule("53 15 * * *", async () => {
    console.log("Running referral commission distribution cron job...");
    await processReferralCommissions();
  });

  // Optional: Run immediately on startup for testing
  // processReferralCommissions();

  // console.log("Referral commission cron job scheduled");
}

// Export for testing or manual execution
module.exports = {
  startCronJob,
};
