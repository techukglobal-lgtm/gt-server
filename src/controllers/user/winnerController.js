const Competition = require("../../models/Competetion");
const User = require("../../models/auth");

// Function to get all competitions with winners and their details
async function getCompetitionsWithWinners() {
  try {
    // Aggregate pipeline to get competitions with winner details
    const competitionsWithWinners = await Competition.aggregate([
      {
        // Match competitions that have winnerId
        $match: {
          winnerId: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        // Convert winnerId string to ObjectId for lookup
        $addFields: {
          winnerObjectId: { $toObjectId: "$winnerId" },
        },
      },
      {
        // Lookup user data from User collection
        $lookup: {
          from: "userdata", // collection name in MongoDB
          localField: "winnerObjectId",
          foreignField: "_id",
          as: "winnerData",
        },
      },
      {
        // Unwind the winnerData array (since lookup returns array)
        $unwind: {
          path: "$winnerData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        // Project only required fields
        $project: {
          competitionName: "$title",
          winnerName: {
            $concat: [
              { $ifNull: ["$winnerData.firstName", ""] },
              " ",
              { $ifNull: ["$winnerData.lastName", ""] },
            ],
          },
          ticketValue: "$ticketValue",
          winnerPicture: "$winnerPicture",
          winnerId: "$winnerId",
          // Optional: include these if needed
          startDateTime: "$startDateTime",
          endDateTime: "$endDateTime",
          createdAt: "$createdAt",
        },
      },
      {
        // Sort by creation date (newest first)
        $sort: { createdAt: -1 },
      },
    ]);

    return competitionsWithWinners;
  } catch (error) {
    console.error("Error fetching competitions with winners:", error);
    throw error;
  }
}

// Alternative method using populate (if you prefer this approach)
async function getCompetitionsWithWinnersPopulate() {
  try {
    // Find competitions with winnerId
    const competitions = await Competition.find({
      winnerId: { $exists: true, $ne: null, $ne: "" },
    });

    // Manually populate winner data
    const competitionsWithWinners = await Promise.all(
      competitions.map(async (competition) => {
        try {
          const winner = await User.findById(competition.winnerId).select(
            "firstName lastName profileImg"
          );

          return {
            competitionName: competition.title,
            winnerName: winner
              ? `${winner.firstName || ""} ${winner.lastName || ""}`.trim()
              : "Winner not found",
            ticketValue: competition.ticketValue,
            winnerPicture: competition.winnerPicture,
            winnerId: competition.winnerId,
            winnerProfileImg: winner?.profileImg || null,
          };
        } catch (err) {
          console.error(
            `Error finding winner for competition ${competition._id}:`,
            err
          );
          return {
            competitionName: competition.title,
            winnerName: "Winner not found",
            ticketValue: competition.ticketValue,
            winnerPicture: competition.winnerPicture,
            winnerId: competition.winnerId,
          };
        }
      })
    );

    return competitionsWithWinners;
  } catch (error) {
    console.error("Error fetching competitions with winners:", error);
    throw error;
  }
}

// Usage example
async function main() {
  try {
    // Method 1: Using aggregation (recommended)
    const winners1 = await getCompetitionsWithWinners();
    console.log("Competitions with Winners (Aggregation):", winners1);

    // Method 2: Using populate approach
    const winners2 = await getCompetitionsWithWinnersPopulate();
    console.log("Competitions with Winners (Populate):", winners2);
  } catch (error) {
    console.error("Error:", error);
  }
}

// API Controller function
const getWinners = async (req, res) => {
  try {
    // Get competitions with winners using aggregation
    const competitionsWithWinners = await Competition.aggregate([
      {
        // Match competitions that have winnerId
        $match: {
          winnerId: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        // Convert winnerId string to ObjectId for lookup
        $addFields: {
          winnerObjectId: { $toObjectId: "$winnerId" },
        },
      },
      {
        // Lookup user data from User collection
        $lookup: {
          from: "userdata", // collection name in MongoDB
          localField: "winnerObjectId",
          foreignField: "_id",
          as: "winnerData",
        },
      },
      {
        // Unwind the winnerData array
        $unwind: {
          path: "$winnerData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        // Project only required fields
        $project: {
          competitionName: "$title",
          winnerName: {
            $concat: [
              { $ifNull: ["$winnerData.firstName", ""] },
              " ",
              { $ifNull: ["$winnerData.lastName", ""] },
            ],
          },
          ticketValue: "$ticketValue",
          winnerPicture: "$winnerPicture",
          winnerId: "$winnerId",
          startDateTime: "$startDateTime",
          endDateTime: "$endDateTime",
          createdAt: "$createdAt",
        },
      },
      {
        // Sort by creation date (newest first)
        $sort: { createdAt: -1 },
      },
    ]);

    // Send success response
    res.status(200).json({
      success: true,
      message: "Winners fetched successfully",
      data: competitionsWithWinners,
      count: competitionsWithWinners.length,
    });
  } catch (error) {
    console.error("Error fetching competition winners:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch winners",
      error: error.message,
    });
  }
};

// Export the API function
module.exports = { getWinners };
