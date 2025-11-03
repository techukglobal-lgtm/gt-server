const User = require("../../../models/auth");
const checkAuthorization = require("../../../middlewares/authMiddleware");
const jwt = require("jsonwebtoken");
const {
  sendApprovedRegistrationEmail,
} = require("../../../services/emailService");

// // Fetch all users except Admins
// exports.getUsers = async (req, res) => {
//   try {
//     // Authorization check
//     const authUser = await checkAuthorization(req, res);
//     if (!authUser) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }

//     // Fetch users excluding Admins
//     const users = await User.find({ roles: { $ne: "Admin" } }); // Exclude sensitive fields like password
//     res.status(200).json({
//       success: true,
//       data: users,
//       message: "Users fetched successfully.",
//     });
//   } catch (error) {
//     console.error("Error fetching users:", error);
//     res.status(500).json({ success: false, message: "Server error while fetching users." });
//   }
// };
exports.getUsers = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const users = await User.find({ roles: { $ne: "Admin" } });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin login as a user
exports.loginAsUser = async (req, res) => {
  try {
    // Authorization check
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required.",
      });
    }

    const { userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Find the target user
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    user = {
      ...user.toObject(), // Convert the mongoose object to a plain JavaScript object
    };

    res.status(200).json({
      success: true,
      message: "Logged in as user successfully.",
      token,
      user,
    });
  } catch (error) {
    console.error("Error in admin login as user:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin impersonation.",
    });
  }
};

exports.updateStatus = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { userId, status } = req.body;

  if (!userId || !status) {
    return res.status(400).json({
      success: false,
      message: "User ID and status are required",
    });
  }

  User.findByIdAndUpdate(userId, { status }, { new: true })
    .then((updatedUser) => {
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      res.json({
        success: true,
        message: "User status updated successfully",
        user: updatedUser,
      });
    })
    .catch((error) => {
      console.error("Error updating user status:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating user status",
      });
    });
};

exports.updateSponsor = async (req, res) => {
  try {
    const { userId, sponsorId, referralCode } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const updateData = {
      refferBy: referralCode || "",
      updatedAt: new Date(),
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`Sponsor updated for user ${userId}:`, {
      newSponsorId: sponsorId,
      newReferralCode: referralCode,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Sponsor updated successfully",
      data: {
        userId: updatedUser._id,
        username: updatedUser.username,
        refferBy: updatedUser.refferBy,
      },
    });
  } catch (error) {
    console.error("Error updating sponsor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sponsor",
      error: error.message,
    });
  }
};

exports.updateLevel = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { userId, levelsOpen } = req.body;

  if (!userId || !levelsOpen) {
    return res.status(400).json({
      success: false,
      message: "User ID and levelsOpen are required",
    });
  }

  User.findByIdAndUpdate(userId, { levelsOpen }, { new: true })
    .then((updatedUser) => {
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      res.json({
        success: true,
        message: "User status updated successfully",
        user: updatedUser,
      });
    })
    .catch((error) => {
      console.error("Error updating user status:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating user status",
      });
    });
};

exports.updateWallet = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || isNaN(parseFloat(amount))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request data" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { cryptoWallet: parseFloat(amount), updatedAt: new Date() },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Log the wallet update
    console.log(`Wallet updated for user ${userId}:`, {
      newAmount: amount,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Wallet updated successfully",
      data: {
        userId: updatedUser._id,
        username: updatedUser.username,
        cryptoWallet: updatedUser.cryptoWallet,
      },
    });
  } catch (error) {
    console.error("Error updating wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update wallet",
      error: error.message,
    });
  }
};

exports.updateEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: "Email already in use by another account",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`Email updated for user ${userId}:`, {
      oldEmail: updatedUser.email,
      newEmail: email,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Email updated successfully",
      data: {
        userId: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
      },
    });
  } catch (error) {
    console.error("Error updating email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update email",
      error: error.message,
    });
  }
};

exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { userId, withdrawalEnabled } = req.body;

    if (
      typeof userId === "undefined" ||
      typeof withdrawalEnabled !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        withdrawalEnabled,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`Withdrawal status updated for user ${userId}:`, {
      newStatus: withdrawalEnabled,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal status updated successfully",
      data: {
        userId: updatedUser._id,
        username: updatedUser.username,
        withdrawalEnabled: updatedUser.withdrawalEnabled,
      },
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update withdrawal status",
      error: error.message,
    });
  }
};

exports.acceptRegistration = async (req, res) => {
  const { userId, registerUnderSponsor } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields.",
    });
  }

  try {
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `User is not pending. Current status: ${user.status}.`,
      });
    }

    // --- ✅ Default update data ---
    let updateQuery = { status: "active" };

    // --- ✅ Agar admin chahe sponsor ko rakhna (TRUE) ---
    if (registerUnderSponsor === true) {
      console.log(
        `✅ User ${userId} activated with sponsor: ${
          user.refferBy || "No Sponsor"
        }`
      );
      // kuch change nahi karna, jo refferBy hai usko rehne do
    }
    // --- ✅ Agar admin chahe sponsor hata diya jaye (FALSE) ---
    else {
      updateQuery.refferBy = null;
      console.log(`ℹ️ Sponsor removed for user ${userId} during activation.`);
    }

    // --- ✅ Update in DB ---
    const updatedUser = await User.findByIdAndUpdate(userId, updateQuery, {
      new: true,
      runValidators: true,
    });

    // await sendApprovedRegistrationEmail(user.email, user.firstName);

    return res.status(200).json({
      success: true,
      message: "User registration accepted successfully.",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        refferBy: updatedUser.refferBy,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error("Error accepting registration:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
      error: error.message,
    });
  }
};

exports.getAllAccountsOfUser = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Load the logged‑in user's record
    const user = await User.findById(authUser);

    // Find all accounts sharing that user's email
    const userAccounts = await User.find({ email: user.email });

    res.json(userAccounts);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};
