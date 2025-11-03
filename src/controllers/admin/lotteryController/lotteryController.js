const checkAuthorization = require("../../../middlewares/authMiddleware");
const User = require("../../../models/auth");
const Competition = require("../../../models/Competetion");
const Order = require("../../../models/Order");
const nodemailer = require("nodemailer");

// Helper function to check and publish scheduled competitions
const checkAndPublishScheduledCompetitions = async () => {
  const now = new Date();
  const competitionsToPublish = await Competition.find({
    scheduledPublish: true,
    isPublished: false,
    startDateTime: { $lte: now },
  });

  if (competitionsToPublish.length > 0) {
    await Competition.updateMany(
      { _id: { $in: competitionsToPublish.map((comp) => comp._id) } },
      { isPublished: true }
    );
  }

  return competitionsToPublish.length;
};

// Validate competition data
const validateCompetitionData = (data) => {
  const {
    title,
    description,
    numberOfTickets,
    ticketValue,
    startDateTime,
    endDateTime,
    scheduledPublish,
    scheduledDateTime,
    pictures,
    featuredImage,
  } = data;

  if (
    !title ||
    !description ||
    !numberOfTickets ||
    !ticketValue ||
    !startDateTime ||
    !endDateTime
  ) {
    throw new Error(
      "Missing required fields: title, description, numberOfTickets, ticketValue, startDateTime, or endDateTime."
    );
  }
  if (isNaN(numberOfTickets) || numberOfTickets <= 0) {
    throw new Error("Number of tickets must be a positive integer.");
  }

  if (isNaN(ticketValue) || ticketValue < 0) {
    throw new Error("Ticket value must be a non-negative number.");
  }

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date format for startDateTime or endDateTime.");
  }

  if (endDate <= startDate) {
    throw new Error("End date must be after start date.");
  }

  if (scheduledPublish === "true") {
    const scheduledDate = new Date(scheduledDateTime);
    if (!scheduledDateTime || isNaN(scheduledDate.getTime())) {
      throw new Error("Invalid or missing scheduledDateTime.");
    }
    if (scheduledDate >= startDate) {
      throw new Error("Scheduled publish time must be before start time.");
    }
  }

  if (!Array.isArray(pictures) || pictures.length === 0) {
    throw new Error("At least one picture URL is required.");
  }

  for (const url of pictures) {
    if (typeof url !== "string") {
      throw new Error("Each picture must be a string.");
    }

    // Updated validation to accept both full URLs and relative paths
    if (url.startsWith("http")) {
      // If it's a full URL, validate as before
      if (!/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
        throw new Error("Each picture URL must be a valid image URL.");
      }
    } else {
      // For relative paths, just check if it has a valid image extension
      if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
        throw new Error("Each picture path must have a valid image extension.");
      }
    }
  }
};

// Create competition
exports.createCompetition = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const data = { ...req.body };

    // Process picture paths - remove /uploads prefix
    if (Array.isArray(data.pictures)) {
      data.pictures = data.pictures.map((picturePath) => {
        // Remove /uploads prefix if it exists
        return picturePath.replace(/^\/uploads\//, "");
      });
    }

    validateCompetitionData(data);

    const competition = await Competition.create({
      title: data.title,
      description: data.description,
      pictures: data.pictures,
      numberOfTickets: parseInt(data.numberOfTickets, 10),
      ticketValue: parseFloat(data.ticketValue),
      startDateTime: new Date(data.startDateTime),
      endDateTime: new Date(data.endDateTime),
      isPublished: data.publishNow === "true",
      featuredImage: data.featuredImage,
      scheduledPublish: data.scheduledPublish === "true",
      scheduledTime:
        data.scheduledPublish === "true"
          ? new Date(data.scheduledDateTime)
          : null,
      isFeatured: data.featured === "true",
    });

    res.status(201).json({
      success: true,
      data: competition,
      message: "Competition created successfully.",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all competitions
exports.getCompetitions = async (req, res) => {
  try {
    await checkAndPublishScheduledCompetitions();
    const competitions = await Competition.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: competitions.length,
      data: competitions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.addLiveDraw = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { competitionId, link } = req.body;
    if (!competitionId || !link) {
      return res.status(400).json({
        success: false,
        message: "Competition ID and link are required.",
      });
    }

    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found.",
      });
    }

    competition.instagramLiveDrawLink = link;
    await competition.save();

    return res.status(200).json({
      success: true,
      message: "Live draw link added successfully.",
      data: competition,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get competition by ID
exports.getCompetitionById = async (req, res) => {
  try {
    const { id } = req.body; // Destructure id from req.body
    await checkAndPublishScheduledCompetitions();

    // Find competition by ID
    const competition = await Competition.findById(id);

    // Check if competition exists
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
      });
    }

    res.status(200).json({
      success: true,
      data: [competition], // Wrapping in array to match frontend expectation
      message: "Competition found",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update competition
exports.updateCompetition = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const competition = await Competition.findById(req.params.id);
    if (!competition) {
      return res
        .status(404)
        .json({ success: false, message: "Competition not found" });
    }

    const data = req.body;

    // Validate start and end dates
    if (data.startDateTime || data.endDateTime) {
      const startDate = data.startDateTime
        ? new Date(data.startDateTime)
        : new Date(competition.startDateTime);
      const endDate = data.endDateTime
        ? new Date(data.endDateTime)
        : new Date(competition.endDateTime);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid date format" });
      }

      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    if (data.pictures) {
      if (!Array.isArray(data.pictures) || data.pictures.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one picture URL is required",
        });
      }

      for (const url of data.pictures) {
        if (
          typeof url !== "string" ||
          !/^((https?:\/\/.+)|([^\/]+))\.(jpg|jpeg|png|webp|gif)$/i.test(url)
        ) {
          return res.status(400).json({
            success: false,
            message: "Each picture must be a valid image URL or filename",
          });
        }
      }
    }

    // Validate scheduled publish time if applicable
    if (data.scheduledPublish === "true" || data.scheduledTime) {
      const startDate = new Date(
        data.startDateTime || competition.startDateTime
      );
      const scheduledDate = new Date(
        data.scheduledTime || competition.scheduledTime
      );

      if (isNaN(scheduledDate.getTime()) || scheduledDate >= startDate) {
        return res.status(400).json({
          success: false,
          message: "Scheduled publish time must be before start time",
        });
      }
    }

    const updatedCompetition = await Competition.findByIdAndUpdate(
      req.params.id,
      data,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({ success: true, data: updatedCompetition });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete competition
exports.deleteCompetition = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const id = req.body.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Competition ID is required",
      });
    }

    // Optional: Validate ObjectId format if using MongoDB
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid competition ID format",
      });
    }

    const competition = await Competition.findByIdAndDelete(id);

    if (!competition) {
      return res
        .status(404)
        .json({ success: false, message: "Competition not found-" });
    }

    res.status(200).json({
      success: true,
      message: `Competition with id ${id} has been deleted`,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getParticipants = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { competitionId } = req.body;

    // Find the competition to check for winnerId
    const competition = await Competition.findById(competitionId);
    const winnerId = competition?.winnerId || null;

    // Find all orders for this competition
    const orders = await Order.find({
      competitionId: competitionId,
    });

    // Group orders by email to get unique participants and sum their ticket quantities
    const participantMap = new Map();
    orders.forEach((order) => {
      const email = order.email;
      if (participantMap.has(email)) {
        const existing = participantMap.get(email);
        existing.totalTickets += order.ticketQuantity;
        existing.orders.push({
          orderId: order._id,
          ticketQuantity: order.ticketQuantity,
          purchaseDate: order.createdAt,
          totalCost: order.totalCost,
          isVipPack: order.isVipPack,
        });
      } else {
        participantMap.set(email, {
          firstName: order.firstName,
          lastName: order.lastName,
          email: order.email,
          phone: order.phone,
          country: order.country,
          city: order.city,
          buyerId: order.buyerId,
          totalTickets: order.ticketQuantity,
          orders: [
            {
              orderId: order._id,
              ticketQuantity: order.ticketQuantity,
              purchaseDate: order.createdAt,
              totalCost: order.totalCost,
              isVipPack: order.isVipPack,
            },
          ],
        });
      }
    });

    // Convert map to array
    const participants = Array.from(participantMap.values());

    // Try to match with registered user data if available
    for (const participant of participants) {
      const user = await User.findOne({ email: participant.email }).select(
        "username profileImg kycStatus isKycVerified"
      );
      if (user) {
        participant.username = user.username;
        participant.profileImg = user.profileImg;
        participant.kycStatus = user.kycStatus;
        participant.isKycVerified = user.isKycVerified;
      }
    }

    // Get summary data
    const totalParticipants = participants.length;
    const totalTicketsSold = participants.reduce(
      (sum, p) => sum + p.totalTickets,
      0
    );
    const totalVipPacks = orders.filter((o) => o.isVipPack).length;

    // Prepare response object
    const responseData = {
      success: true,
      data: {
        summary: {
          totalParticipants,
          totalTicketsSold,
          totalVipPacks,
        },
        participants,
      },
    };

    // Add winnerId to response if it exists
    if (winnerId) {
      responseData.data.winnerId = winnerId;
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.announceWinner = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const user = await User.findById(authUser);
  try {
    const { competitionId, winnerId } = req.body;

    if (!competitionId || !winnerId) {
      return res.status(400).json({
        success: false,
        message: "Both competitionId and winnerId are required.",
      });
    }
    const USER = await User.findById(winnerId);

    if (!USER) {
      return res.status(404).json({
        success: false,
        message: "USER not found.",
      });
    }
    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found.",
      });
    }

    competition.winnerId = winnerId;
    await competition.save();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"WIN4LUX Support" <${process.env.EMAIL_USER}>`,
      to: USER.email,
      subject: "Congratulations! You Won the Competition 🎉",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Congratulations, You're a Winner!</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f4;
      color: #333;
      margin: 0;
      padding: 20px;
    }
    .container {
      background-color: #fff;
      max-width: 600px;
      margin: 0 auto;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header {
      background-color: #ac9b6d;
      color: #fff;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
    }
    .content {
      padding: 30px 20px;
    }
    .content h2 {
      color: #ac9b6d;
      font-size: 22px;
    }
    .details {
      margin-top: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
    }
    .details p {
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      padding: 15px;
      font-size: 13px;
      color: #777;
      background-color: #f0f0f0;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background-color: #ac9b6d;
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations, ${USER.firstName || "Winner"}!</h1>
    </div>
    <div class="content">
      <h2>You are the lucky winner of our competition!</h2>
      <p>We are thrilled to announce that you have won the <strong>"${
        competition.title
      }"</strong> competition hosted by WIN4LUX.</p>

      <div class="details">
        <p><strong>Competition Title:</strong> ${competition.title}</p>
        <p><strong>Ticket Price:</strong> $${competition.ticketValue}</p>
        <p><strong>Draw Date:</strong> ${new Date(
          competition.endDateTime
        ).toLocaleDateString()}</p>
        <p><strong>Winner:</strong> ${USER.firstName} ${USER.lastName || ""}</p>
        <p><strong>Email:</strong> ${USER.email}</p>
        ${
          competition.instagramLiveDrawLink
            ? `<p><strong>Live Draw:</strong> <a href="${competition.instagramLiveDrawLink}">${competition.instagramLiveDrawLink}</a></p>`
            : ""
        }
      </div>

      <p>If you have any questions, feel free to reply to this email. We’re here to help!</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} WIN4LUX. All Rights Reserved.
    </div>
  </div>
</body>
</html>
`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Winner announced successfully.",
      data: competition,
    });
  } catch (err) {
    console.error("Error in announceWinner:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while announcing winner.",
    });
  }
};

exports.getCompetitionsOfUser = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    // Find all orders for the user
    const orders = await Order.find({ buyerId: userId });

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No competitions found for this user.",
      });
    }

    // Extract unique competition IDs from orders
    const competitionIds = [
      ...new Set(orders.map((order) => order.competitionId)),
    ];

    // Fetch latest competition data from Competition collection
    const competitions = await Competition.find({
      _id: { $in: competitionIds },
    }).sort({ updatedAt: -1 }); // Sort by latest updated

    // Optional: Combine order data with competition data
    const competitionsWithOrderDetails = competitions.map((competition) => {
      const userOrders = orders.filter(
        (order) => order.competitionId.toString() === competition._id.toString()
      );

      return {
        ...competition.toObject(),
        userOrders: userOrders, // Include user's orders for this competition
        totalTicketsPurchased: userOrders.reduce(
          (sum, order) => sum + order.ticketQuantity,
          0
        ),
      };
    });

    return res.status(200).json({
      success: true,
      data: competitionsWithOrderDetails,
    });
  } catch (err) {
    console.error("Error in getCompetitionsOfUser:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching competitions.",
    });
  }
};

exports.addWinnerPicture = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { competitionId, winnerPicture } = req.body;

    if (!competitionId || !winnerPicture) {
      return res.status(400).json({
        success: false,
        message: "Competition ID and winner picture are required.",
      });
    }

    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found.",
      });
    }

    competition.winnerPicture = winnerPicture;
    await competition.save();

    return res.status(200).json({
      success: true,
      message: "Winner picture added successfully.",
      data: competition,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
