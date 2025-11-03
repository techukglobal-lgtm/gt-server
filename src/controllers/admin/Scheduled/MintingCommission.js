const cron = require("node-cron");
const mongoose = require("mongoose");
const User = require("../../../models/auth");
const MintingActivity = require("../../../models/MintingActivity");
const BinaryPlacement = require("../../../models/BinarySchema");
const MintingCommission = require("../../../models/MintingCommission");
const Transaction = require("../../../models/Transaction");

class MintingCommissionCronJob {
  constructor() {
    this.isRunning = false;
  }

  // Get user's direct children in binary tree based on PID
  async getDirectChildren(userId, session) {
    try {
      const directChildren = await BinaryPlacement.find({
        pid: userId,
        status: "active",
      })
        .populate("userId", "username email cryptoWallet")
        .session(session);

      return directChildren;
    } catch (error) {
      console.error("Error getting direct children:", error);
      return [];
    }
  }

  // Calculate total investment of direct children
  async calculateDirectChildrenInvestment(userId, session) {
    try {
      const directChildren = await this.getDirectChildren(userId, session);
      let totalInvestment = 0;

      for (const child of directChildren) {
        // Get all minting activities for this child
        const activities = await MintingActivity.find({
          userId: child.userId._id,
          isActive: true,
        }).session(session);

        // Sum up invested amounts
        const childInvestment = activities.reduce(
          (sum, activity) => sum + activity.investedAmount,
          0
        );
        totalInvestment += childInvestment;
      }

      return { totalInvestment, childrenCount: directChildren.length };
    } catch (error) {
      console.error("Error calculating direct children investment:", error);
      return { totalInvestment: 0, childrenCount: 0 };
    }
  }

  // Calculate investment multiplier based on total investment
  calculateInvestmentMultiplier(totalInvestment) {
    if (totalInvestment >= 100000) return "100x";
    if (totalInvestment >= 50000) return "50x";
    if (totalInvestment >= 45000) return "45x";
    if (totalInvestment >= 40000) return "40x";
    if (totalInvestment >= 35000) return "35x";
    if (totalInvestment >= 30000) return "30x";
    if (totalInvestment >= 25000) return "25x";
    if (totalInvestment >= 20000) return "20x";
    if (totalInvestment >= 15000) return "15x";
    if (totalInvestment >= 10000) return "10x";
    if (totalInvestment >= 5000) return "5x";
    return "noInvestment";
  }

  // Get commission rates from database
  async getCommissionRates(commissionType, session) {
    try {
      const commissionDoc = await MintingCommission.findOne({
        commissionType: commissionType,
      }).session(session);

      return commissionDoc ? commissionDoc.rates : null;
    } catch (error) {
      console.error("Error getting commission rates:", error);
      return null;
    }
  }

  // Create transaction record
  async createTransaction(
    senderId,
    receiverId,
    amount,
    commissionType,
    buyerId,
    level,
    percentage,
    session
  ) {
    try {
      const transaction = new Transaction({
        senderId: senderId || 0, // 0 for admin/system
        receiverId: receiverId,
        amount: amount,
        paymentMethod: "SYSTEM",
        transactionType: commissionType,
        status: "approved",
        commissionDetails: {
          level: level,
          percentage: percentage,
          buyerId: buyerId,
        },
        transactionDate: new Date(),
      });

      await transaction.save({ session });
      return transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  // Process unprocessed clicks and distribute profits
  async processUnprocessedClicks() {
    if (this.isRunning) {
      console.log("Cron job already running, skipping...");
      return;
    }

    this.isRunning = true;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("Starting minting commission processing...");

      // Find all minting activities with unprocessed clicks
      const mintingActivities = await MintingActivity.find({
        isActive: true,
        "clickHistory.processed": false,
      })
        .populate("userId", "username email cryptoWallet")
        .session(session);

      console.log(
        `Found ${mintingActivities.length} activities with unprocessed clicks`
      );

      // Get commission rates for both types
      const selfMintingRates = await this.getCommissionRates(
        "selfMinting",
        session
      );
      const autoMintingRates = await this.getCommissionRates(
        "autoMinting",
        session
      );

      if (!selfMintingRates || !autoMintingRates) {
        throw new Error("Commission rates not found in database");
      }

      let totalProcessed = 0;
      let totalCommissionDistributed = 0;

      for (const activity of mintingActivities) {
        const unprocessedClicks = activity.clickHistory.filter(
          (click) => !click.processed
        );

        if (unprocessedClicks.length === 0) continue;

        console.log(
          `Processing ${unprocessedClicks.length} clicks for user ${activity.userId.username}`
        );

        // Get the appropriate commission rates based on minting type
        const commissionRates =
          activity.mintingType === "MANUAL"
            ? selfMintingRates
            : autoMintingRates;
        const commissionType =
          activity.mintingType === "MANUAL" ? "selfMinting" : "autoMinting";

        for (const click of unprocessedClicks) {
          // First, add the profit to user's wallet
          const user = await User.findById(activity.userId._id).session(
            session
          );
          if (user) {
            user.cryptoWallet += click.profitEarned;
            await user.save({ session });

            // Create transaction for user's direct profit
            await this.createTransaction(
              0, // System as sender
              activity.userId._id,
              click.profitEarned,
              "direct_commission",
              activity.userId._id,
              "direct",
              100,
              session
            );
          }

          // Now process binary tree commissions
          await this.processBinaryTreeCommissions(
            activity.userId._id,
            click.profitEarned,
            commissionRates,
            commissionType,
            session
          );

          // Mark click as processed
          click.processed = true;
          totalProcessed++;
        }

        // Save the updated activity
        await activity.save({ session });
      }

      await session.commitTransaction();
      console.log(
        `Successfully processed ${totalProcessed} clicks. Total commission distributed: ${totalCommissionDistributed}`
      );
    } catch (error) {
      await session.abortTransaction();
      console.error("Error processing minting commissions:", error);
    } finally {
      session.endSession();
      this.isRunning = false;
    }
  }

  // Process binary tree commissions
  async processBinaryTreeCommissions(
    userId,
    baseAmount,
    commissionRates,
    commissionType,
    session
  ) {
    try {
      // Get user's placement info to find parent
      const userPlacement = await BinaryPlacement.findOne({
        userId: userId,
      }).session(session);

      if (!userPlacement || !userPlacement.pid) {
        return; // No parent to give commission to
      }

      const parentId = userPlacement.pid;

      // Calculate parent's direct children investment
      const { totalInvestment, childrenCount } =
        await this.calculateDirectChildrenInvestment(parentId, session);

      // Must have at least 2 direct children to earn commission
      if (childrenCount < 2) {
        console.log(
          `Parent ${parentId} has less than 2 direct children, no commission`
        );
        return;
      }

      // Calculate investment multiplier
      const multiplier = this.calculateInvestmentMultiplier(totalInvestment);
      console.log(
        `Parent investment multiplier: ${multiplier}, Total investment: ${totalInvestment}`
      );

      // Get commission percentage
      const commissionPercentage = parseFloat(
        commissionRates[multiplier] || commissionRates.noInvestment || "0"
      );

      if (commissionPercentage <= 0) {
        console.log("No commission percentage found");
        return;
      }

      // Calculate commission amount
      const commissionAmount = (baseAmount * commissionPercentage) / 100;

      if (commissionAmount <= 0) {
        return;
      }

      // Find parent user and add commission
      const parentUser = await User.findById(parentId).session(session);
      if (parentUser) {
        parentUser.cryptoWallet += commissionAmount;
        await parentUser.save({ session });

        // Create transaction record
        await this.createTransaction(
          userId, // Child as sender
          parentId, // Parent as receiver
          commissionAmount,
          "binary_commission",
          userId, // Buyer is the child who made the click
          "binary",
          commissionPercentage,
          session
        );

        console.log(
          `Distributed ${commissionAmount} commission to parent ${parentUser.username} (${commissionPercentage}%)`
        );
      }
    } catch (error) {
      console.error("Error processing binary tree commissions:", error);
    }
  }

  // Start the cron job
  startCronJob() {
    // Run every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      console.log("Running minting commission cron job...");
      await this.processUnprocessedClicks();
    });

    // Also run once on startup
    setTimeout(() => {
      this.processUnprocessedClicks();
    }, 5000);

    console.log("Minting commission cron job started - runs every 5 minutes");
  }

  // Manual trigger for testing
  async manualTrigger() {
    console.log("Manual trigger for minting commission processing...");
    await this.processUnprocessedClicks();
  }
}

// Export singleton instance
const mintingCronJob = new MintingCommissionCronJob();

module.exports = {
  mintingCronJob,
  startMintingCronJob: () => mintingCronJob.startCronJob(),
  manualTriggerMintingCron: () => mintingCronJob.manualTrigger(),
};
