// controllers/orderController.js
const Competition = require("../../../models/Competetion");
const mongoose = require("mongoose");
const checkAuthorization = require("../../../middlewares/authMiddleware");
const Order = require("../../../models/Order");
const {
  CleanHTMLData,
  CleanDBData,
} = require("../../../config/database/sanetize");
const User = require("../../../models/auth");

exports.createOrder = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const buyerId = CleanHTMLData(CleanDBData(req.body.buyerId));
    const firstName = CleanHTMLData(CleanDBData(req.body.firstName));
    const lastName = CleanHTMLData(CleanDBData(req.body.lastName));
    const country = CleanHTMLData(CleanDBData(req.body.country));
    const zipCode = CleanHTMLData(CleanDBData(req.body.zipCode));
    const address = CleanHTMLData(CleanDBData(req.body.address));
    const city = CleanHTMLData(CleanDBData(req.body.city));
    const phone = CleanHTMLData(CleanDBData(req.body.phone));
    const email = CleanHTMLData(CleanDBData(req.body.email));
    const competitionId = CleanHTMLData(CleanDBData(req.body.competitionId));
    const competitionTitle = CleanHTMLData(
      CleanDBData(req.body.competitionTitle)
    );
    paymentMethod = CleanHTMLData(CleanDBData(req.body.paymentMethod));
    const selectedImage = CleanHTMLData(CleanDBData(req.body.selectedImage));
    const isVipPack = req.body.isVipPack;
    const ticketQuantity = parseInt(req.body.ticketQuantity, 10);
    const vipPackDetails = req.body.vipPackDetails;
    const ticketPrice = parseFloat(req.body.ticketPrice);
    const totalCost = parseFloat(req.body.totalCost);

    // Validate competition exists
    const competition = await Competition.findById(competitionId).session(
      session
    );

    if (!competition) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Competition not found",
      });
    }

    // Check if enough tickets are available
    if (competition.availableTickets < ticketQuantity) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Only ${competition.availableTickets} tickets available`,
      });
    }

    // Create order
    const order = new Order({
      buyerId,
      firstName,
      lastName,
      country,
      zipCode,
      address,
      city,
      phone,
      email,
      competitionId,
      competitionTitle,
      selectedImage,
      isVipPack,
      ticketQuantity,
      vipPackDetails,
      ticketPrice,
      totalCost,
      paymentMethod,
      //   paymentId,
      paymentStatus: "pending",
    });

    await order.save({ session });

    // Update competition available tickets
    competition.availableTickets -= ticketQuantity;
    await competition.save({ session });

    // Update user eligibility to sponsor
    await User.findByIdAndUpdate(
      buyerId,
      {
        $set: {
          eligibeToSponsor: true,
        },
      },
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully",
    });
  } catch (error) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    session.endSession();

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    console.error("Error creating order:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getOrders = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// exports.getOrderById = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: order,
//     });
//   } catch (error) {
//     console.error("Error getting order:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

// exports.updateOrderPayment = async (req, res) => {
//   try {
//     const { paymentStatus, paymentId, paymentMethod } = req.body;

//     const order = await Order.findByIdAndUpdate(
//       req.params.id,
//       { paymentStatus, paymentId, paymentMethod, updatedAt: Date.now() },
//       { new: true, runValidators: true }
//     );

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: order,
//       message: "Payment status updated successfully",
//     });
//   } catch (error) {
//     console.error("Error updating payment:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };
