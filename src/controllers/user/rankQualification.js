const User = require("../../models/auth");
const Rank = require("../../models/Rank");
const RankHistory = require("../../models/RankHistory");
const Investment = require("../../models/Investment");
const mongoose = require("mongoose");
const { hasGreenID } = require('../../helpers/functions');

exports.rankQualification = async () => {
    try {
        const user = await User.findOne({ username: "usman" });
        const totalRanks = await Rank.countDocuments();
        const ranks = await Rank.find().limit(totalRanks - 1); // exclude last if needed
        const userArray = user ? [user] : [];

        for (const user of userArray) {
            const refferrCode = user.refferrCode;
            const currentRankId = user.rank;

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
            let maxInvest = referralInvestments.reduce((max, cur) => Math.max(max, cur.totalInvested), 0);

            let eligibleRank = null;

            for (const rank of ranks) {
                const requiredBusiness = parseFloat(rank.criteria.required);
                const effectiveMaxInvest = Math.min(maxInvest, requiredBusiness / 2);

                if (effectiveMaxInvest >= requiredBusiness / 2 && totalBusiness >= requiredBusiness) {
                    eligibleRank = rank;
                }
            }

            if (eligibleRank && !eligibleRank._id.equals(currentRankId)) {
                const currentIndex = ranks.findIndex(r => r._id.equals(currentRankId));
                const newIndex = ranks.findIndex(r => r._id.equals(eligibleRank._id));

                let totalReward = 0;

                // Credit all intermediate rank rewards
                for (let i = currentIndex + 1; i <= newIndex; i++) {
                    const reward = parseFloat(ranks[i].criteria.reward || 0);
                    totalReward += reward;

                    console.log(`User ${user.username} earned reward ${reward} for rank ${ranks[i].rank}`);
                }

                let greenID = await hasGreenID(user._id);

                // Store old rank
                const oldRankId = currentRankId;
                const newRankId = eligibleRank._id;
                const oldRank = await Rank.findById(currentRankId);

                if (greenID === true) {

                    // Update user balance and rank
                    user.currentBalance = (user.currentBalance || 0) + totalReward;
                    user.rank = newRankId;
                    await user.save();

                    // ✅ Save rank history
                    await RankHistory.create({
                        userId: user._id,
                        oldRankId,
                        newRankId,
                        reward: totalReward,
                        status: "approved",
                        rankDetails: {
                            note: `${user.username} has got rank reward of $${totalReward}, old rank is ${oldRank.rank} and new rank is ${eligibleRank.rank}`
                        },
                        date: new Date(),
                    });

                    console.log(`Rank history saved for ${user.username}`);

                }
                else {
                    // ✅ Save rank history
                    await RankHistory.create({
                        userId: user._id,
                        oldRankId,
                        newRankId,
                        reward: totalReward,
                        status: "flushed",
                        rankDetails: {
                            note: `${user.username} is eligibl for rank reward of $${totalReward} but did not get bcz has not green id, old rank is ${oldRank.rank} and new rank is ${eligibleRank.rank}`
                        },
                        date: new Date(),
                    });

                    console.log(`Rank history saved for ${user.username}`);

                }

                console.log(`User ${user.username} promoted to ${eligibleRank.rank} and rewarded total: ${totalReward}`);
            } else {
                console.log(`User ${user.username} retains current rank`);
            }
        }

        return "ok";
    } catch (error) {
        console.error("Rank assignment error:", error);
        return [];
    }
};

module.exports = exports;
