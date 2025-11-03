const {
  CleanHTMLData,
  CleanDBData,
} = require("../../config/database/sanetize");
const BinaryPlacement = require("../../models/BinarySchema");
const User = require("../../models/auth");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const checkAuthorization = require("../../middlewares/authMiddleware");
const userLink = "http://localhost:3000/";
const backoffice_link = "https://mobicrypto-backend.threearrowstech.com";
const { v4: uuidv4 } = require("uuid");
const { hasGreenID } = require("../../helpers/functions");
const { sendOTPEmail } = require("../../services/emailService");
const OTP = require("../../models/OTP");

function generateReferralCode(length = 8) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let referralCode = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    referralCode += characters[randomIndex];
  }
  return referralCode;
}
const generateUniqueReferralCode = async () => {
  let referralCode;
  let isUnique = false;

  while (!isUnique) {
    referralCode = generateReferralCode();
    const existingCode = await User.findOne({
      $or: [
        { referralCodeMaster: referralCode },
        { referralCodeAffiliate: referralCode },
        { referralCodeUser: referralCode },
      ],
    });

    if (!existingCode) {
      isUnique = true; // Code is unique
    }
  }

  return referralCode;
};

exports.updateWalletAddresses = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const { bepWalletAddress, trcWalletAddress, trdoWalletAddress } = req.body;

    if (!bepWalletAddress && !trcWalletAddress && !trdoWalletAddress) {
      return res.status(400).json({
        status: "error",
        message: "At least one wallet address is required",
      });
    }

    const updateFields = {};

    if (bepWalletAddress) {
      updateFields.bepWalletAddress = bepWalletAddress;
    }

    if (trcWalletAddress) {
      updateFields.trcWalletAddress = trcWalletAddress;
    }

    if (trdoWalletAddress) {
      updateFields.trdoWalletAddress = trdoWalletAddress;
    }

    const updatedUser = await User.findByIdAndUpdate(
      authUser,
      { $set: updateFields },
      { new: true }
    );

    return res.json({
      status: "success",
      message: "Wallet address updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating wallet address:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while updating wallet address",
    });
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Step 1: Register
exports.register = async (req, res) => {
  try {
    const postData = req.body;

    const username = CleanHTMLData(
      CleanDBData(postData.username)
    ).toLowerCase();
    const email = CleanHTMLData(CleanDBData(postData.email));
    const firstName = CleanHTMLData(CleanDBData(postData.firstName));
    const lastName = CleanHTMLData(CleanDBData(postData.lastName));
    const password = CleanHTMLData(CleanDBData(postData.password));
    const phone = CleanHTMLData(CleanDBData(postData.phone));
    const ref = postData.ref;

    // ✅ Check existing email
    if (await User.findOne({ email })) {
      return res.json({
        status: "error",
        message: "User already exists with this email",
      });
    }

    // ✅ Check existing username
    if (await User.findOne({ username })) {
      return res.json({
        status: "error",
        message: "User already exists with this username",
      });
    }

    // ✅ Referral code check ONLY IF provided
    let refferBy = null;
    if (ref && ref.trim() !== "") {
      const referrer = await User.findOne({ refferrCode: ref });
      if (!referrer) {
        return res.json({
          status: "error",
          message: "Invalid Referral Code",
        });
      }
      refferBy = referrer.refferrCode;
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // ✅ Create referral code for new user
    const refferrCode = uuidv4().split("-")[0];

    // ✅ Create and save user directly
    const user = new User({
      username,
      email,
      firstName,
      lastName,
      phone,
      password: hashedPassword,
      refferrCode,
      refferBy,
    });

    await user.save();

    return res.json({
      status: "success",
      message: "Registration successful! Wait for admin approval.",
      user: {
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("🚀 ~ Error in register function:", error);
    return res.json({
      status: "error",
      message: "User cannot be registered",
    });
  }
};

// Backend API - Add this to your controller file

exports.adminRegister = async (req, res) => {
  try {
    const postData = req.body;

    const username = CleanHTMLData(
      CleanDBData(postData.username)
    ).toLowerCase();
    const email = CleanHTMLData(CleanDBData(postData.email));
    const firstName = CleanHTMLData(CleanDBData(postData.firstName));
    const lastName = CleanHTMLData(CleanDBData(postData.lastName));
    const password = CleanHTMLData(CleanDBData(postData.password));
    const referredBy = CleanHTMLData(CleanDBData(postData.referredBy)); // referralCode of sponsor
    const leg = CleanHTMLData(CleanDBData(postData.leg)); // "left" or "right"

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    if (await User.findOne({ email })) {
      return res.json({
        status: "error",
        message: "User already exists with this email",
      });
    }

    if (await User.findOne({ username })) {
      return res.json({
        status: "error",
        message: "User already exists with this username",
      });
    }

    // Generate referral code for new user
    const refferrCode = uuidv4().split("-")[0];

    let refferBy = null;
    let placementParent = null;
    let position = null;

    // Find sponsor user by referral code
    const sponsorUser = await User.findOne({ refferrCode: referredBy });
    if (sponsorUser) {
      refferBy = sponsorUser.refferrCode;
    } else {
      // If sponsor not found, assign to admin
      const adminUser = await User.findOne({ "roles.0": "Admin" });
      refferBy = adminUser ? adminUser.refferrCode : null;
    }

    // Handle binary placement with specified leg preference
    if (refferBy) {
      const referrer = await User.findOne({ refferrCode: refferBy });
      if (referrer) {
        // Find placement position in binary tree with leg preference
        const placementResult = await findBinaryPlacement(
          referrer._id,
          leg // "left" or "right"
        );
        placementParent = placementResult.parentId;
        position = placementResult.position;
      }
    }

    // Create new user
    const user = new User({
      username,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      refferrCode,
      refferBy,
      leg: leg, // Store leg preference in user document
    });

    await user.save();

    // Create entry in BinaryPlacement collection
    if (placementParent && position) {
      const binaryPlacement = new BinaryPlacement({
        userId: user._id,
        sid: sponsorUser ? sponsorUser._id : null, // Sponsor ID
        pid: placementParent,
        leg: position === "left" ? "L" : "R",
        status: "active",
        investment: 0,
        leftPoints: 0,
        rightPoints: 0,
        totalLeftPoints: 0,
        totalRightPoints: 0,
        convertedPoints: 0,
      });

      await binaryPlacement.save();
    }

    // Add to sponsor's directs (for unilevel structure)
    if (sponsorUser) {
      await User.findByIdAndUpdate(sponsorUser._id, {
        $push: { directs: user._id },
      });
    }

    res.json({
      status: "success",
      message: "User registered successfully by admin!",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        refferrCode: user.refferrCode,
        refferBy: user.refferBy,
        leg: user.leg,
      },
    });
  } catch (error) {
    console.error("🚀 ~ Error in adminRegister function:", error);
    res.json({
      status: "error",
      message: "User cannot be registered by admin",
    });
  }
};

exports.createMiniAdmin = async (req, res) => {
  try {
    const { username, email, password, allowedRoutes } = req.body;

    if (!username || !email || !password || !allowedRoutes) {
      return res.status(400).json({
        status: "error",
        message: "Username, email, password, and allowedRoutes are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User with this username or email already exists",
      });
    }

    // Hash password (you should use bcrypt)
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new Mini Admin user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      roles: ["MiniAdmin"],
      allowedRoutes: Array.isArray(allowedRoutes)
        ? allowedRoutes
        : [allowedRoutes],
      status: "active",
    });

    await newUser.save();

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      status: "success",
      message: "Mini Admin created successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Error creating Mini Admin:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while creating Mini Admin",
    });
  }
};
// Get all Mini Admins
exports.getMiniAdmins = async (req, res) => {
  try {
    // Find all users with MiniAdmin role, excluding password field
    const miniAdmins = await User.find(
      { roles: { $in: ["MiniAdmin"] } },
      { password: 0 } // Exclude password from response
    ).sort({ createdAt: -1 }); // Sort by newest first

    return res.status(200).json({
      status: "success",
      message: "Mini Admins fetched successfully",
      data: miniAdmins,
    });
  } catch (error) {
    console.error("Error fetching Mini Admins:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching Mini Admins",
    });
  }
};

// Update Mini Admin
exports.updateMiniAdmin = async (req, res) => {
  try {
    const { id, username, email, allowedRoutes } = req.body;

    if (!id || !username || !email || !allowedRoutes) {
      return res.status(400).json({
        status: "error",
        message: "ID, username, email, and allowedRoutes are required",
      });
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "Mini Admin not found",
      });
    }

    // Check if username or email already exists (excluding current user)
    const duplicateUser = await User.findOne({
      _id: { $ne: id },
      $or: [{ username }, { email }],
    });

    if (duplicateUser) {
      return res.status(400).json({
        status: "error",
        message: "Username or email already exists",
      });
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        username,
        email,
        allowedRoutes: Array.isArray(allowedRoutes)
          ? allowedRoutes
          : [allowedRoutes],
        updatedAt: new Date(),
      },
      { new: true, select: "-password" } // Return updated document without password
    );

    return res.status(200).json({
      status: "success",
      message: "Mini Admin updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating Mini Admin:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while updating Mini Admin",
    });
  }
};

// Delete Mini Admin
exports.deleteMiniAdmin = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "ID is required",
      });
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "Mini Admin not found",
      });
    }

    // Check if user is actually a Mini Admin
    if (!existingUser.roles.includes("MiniAdmin")) {
      return res.status(400).json({
        status: "error",
        message: "User is not a Mini Admin",
      });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    return res.status(200).json({
      status: "success",
      message: "Mini Admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Mini Admin:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while deleting Mini Admin",
    });
  }
};

// Get Mini Admin by ID (optional - for detailed view)
exports.getMiniAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "ID is required",
      });
    }

    const miniAdmin = await User.findOne(
      { _id: id, roles: { $in: ["MiniAdmin"] } },
      { password: 0 } // Exclude password
    );

    if (!miniAdmin) {
      return res.status(404).json({
        status: "error",
        message: "Mini Admin not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Mini Admin fetched successfully",
      data: miniAdmin,
    });
  } catch (error) {
    console.error("Error fetching Mini Admin:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching Mini Admin",
    });
  }
};

// Toggle Mini Admin Status (activate/deactivate)
exports.toggleMiniAdminStatus = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "ID is required",
      });
    }

    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "Mini Admin not found",
      });
    }

    // Toggle status
    const newStatus = existingUser.status === "active" ? "inactive" : "active";

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { status: newStatus, updatedAt: new Date() },
      { new: true, select: "-password" }
    );

    return res.status(200).json({
      status: "success",
      message: `Mini Admin ${
        newStatus === "active" ? "activated" : "deactivated"
      } successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error toggling Mini Admin status:", error.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while updating status",
    });
  }
};
// Updated helper function to find the best placement in binary tree using BinaryPlacement collection
async function findBinaryPlacement(referrerId, preferred = null) {
  // Use depth-first search instead of breadth-first

  const findAvailableSpot = async (currentUserId, preferredSide) => {
    // Check existing placements under current user
    const leftChild = await BinaryPlacement.findOne({
      pid: currentUserId,
      leg: "L",
    });
    const rightChild = await BinaryPlacement.findOne({
      pid: currentUserId,
      leg: "R",
    });

    // If preferred side is available, use it
    if (preferredSide === "left" && !leftChild) {
      return { parentId: currentUserId, position: "left" };
    }

    if (preferredSide === "right" && !rightChild) {
      return { parentId: currentUserId, position: "right" };
    }

    // If preferred side is occupied, go deeper on that side (KEY CHANGE!)
    if (preferredSide === "left" && leftChild) {
      return await findAvailableSpot(leftChild.userId, "left");
    }

    if (preferredSide === "right" && rightChild) {
      return await findAvailableSpot(rightChild.userId, "right");
    }

    // No preference given - use standard binary tree filling (left first)
    if (!preferredSide) {
      if (!leftChild) {
        return { parentId: currentUserId, position: "left" };
      }
      if (!rightChild) {
        return { parentId: currentUserId, position: "right" };
      }

      // Both occupied, go to left child first (depth-first)
      return await findAvailableSpot(leftChild.userId);
    }
  };

  try {
    return await findAvailableSpot(referrerId, preferred);
  } catch (error) {
    console.error("Error in findBinaryPlacement:", error);
    // Fallback
    return { parentId: referrerId, position: "left" };
  }
}

exports.login = async (req, res) => {
  const postData = req.body;
  let emailOrUsername = CleanHTMLData(CleanDBData(postData.identifier));
  const password = CleanHTMLData(CleanDBData(postData.password));
  try {
    // Check if the identifier is an email
    const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
      emailOrUsername
    );

    // If it's a username (not email), convert it to lowercase
    if (!isEmail) {
      emailOrUsername = emailOrUsername.toLowerCase();
    }

    // Find the user by email or username
    let user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      return res.json({
        status: "error",
        message: "User not found",
      });
    }
    if (user.status !== "active") {
      return res.json({
        status: "error",
        message: "Your account is not active. Please wait for admin Approval.",
      });
    }
    // Verify the password
    const passwordMatched = await bcrypt.compare(password, user.password);
    // const passwordMatched = true;
    if (!passwordMatched) {
      return res.json({
        status: "error",
        message: "Password incorrect",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    // let referralLink = userLink + "auth/signup/" + user.referralCode;

    user = {
      ...user.toObject(), // Convert the mongoose object to a plain JavaScript object
      // referralLink,
    };

    // Log successful login

    res.json({
      status: "success",
      message: "Logged in successfully!",
      token,
      user,
    });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", message: "Internal Server Error" });
  }
};

exports.verifyToken = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    // console.log("🚀 ~ exports.verifyToken= ~ authUser:", typeof authUser, authUser)
    if (authUser) {
      let user = await User.findById(authUser);

      let sponsor = null;
      if (user.sponsorid !== "0") {
        sponsor = await User.findById(user.sponsorid).select("username");
      }

      // Add sponsorName to the user object
      user = {
        ...user.toObject(), // Convert the mongoose object to a plain JavaScript object
        sponsorName: sponsor?.username,
        profileimage: `${backoffice_link}/public/uploads/profile/${user.profileimage}`,
      };

      res.json({ status: "success", user });
    }
  } catch (error) {
    res.json({ status: "error", message: "Error fetching user profile" });
  }
};

exports.updatePassword = async (req, res) => {
  const authuser = await checkAuthorization(req, res); // Authorization check
  const postData = req.body;

  try {
    if (authuser) {
      // Clean and validate input
      const oldpassword = CleanHTMLData(CleanDBData(postData.currentPassword));
      const newpassword = CleanHTMLData(CleanDBData(postData.newPassword));

      // Fetch user data from 'usersdata' collection
      const user = await User.findOne({ _id: authuser });

      if (!user) {
        return res.json({ status: "error", message: "User not found" });
      }

      const passwordMatched = await bcrypt.compare(oldpassword, user.password);
      if (!passwordMatched) {
        return res.json({ status: "error", message: "Incorrect Old Password" });
      }

      const hashedPassword = await bcrypt.hash(newpassword, 12);

      // Update the password in the 'usersdata' collection
      await User.updateOne(
        { _id: authuser },
        { $set: { password: hashedPassword } }
      );

      return res.json({
        status: "success",
        message: "Password updated successfully",
      });
    }
  } catch (error) {
    // console.error("Error updating password:", error.message);
    res.json({ status: "error", message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  const postData = req.body;
  const username = CleanHTMLData(CleanDBData(postData.username));
  const cellNumber = CleanHTMLData(CleanDBData(postData.phone));
  const age = CleanHTMLData(CleanDBData(postData.age));
  const email = CleanHTMLData(CleanDBData(postData.email));
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));
  const country = CleanHTMLData(CleanDBData(postData.country));
  const zipCode = CleanHTMLData(CleanDBData(postData.zipCode));
  const city = CleanHTMLData(CleanDBData(postData.city));
  const shortAddress = CleanHTMLData(CleanDBData(postData.shortAddress));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const currentUser = await User.findById(authUser);

      if (username && username !== currentUser.username) {
        const existingUsername = await User.findOne({
          username,
          _id: { $ne: authUser },
        });
        if (existingUsername) {
          return res.json({
            status: "error",
            message: "Username already in use by another user",
          });
        }
      }

      // Email validation (Agar dusre user ke paas same email ho)
      if (email && email !== currentUser.email) {
        const existingEmail = await User.findOne({
          email,
          _id: { $ne: authUser },
        });
        if (existingEmail) {
          return res.json({
            status: "error",
            message: "Email already in use by another user",
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        authUser,
        {
          cellNumber,
          age,
          username,
          email,
          firstName,
          lastName,
          address: {
            country,
            zipCode,
            city,
            shortAddress,
          },
        },
        { new: true }
      );

      return res.json({
        status: "success",
        message: "Profile updated successfully",
        user,
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error.message);
    res.json({ status: "error", message: "Server error" });
  }
};

exports.dashboardData = async (req, res) => {
  const postData = req.body;

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const masterReferralCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "master",
      });
      const affiliateReferralCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "affiliate",
      });
      const subAffiliateReferralCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "sub-affiliate",
      });
      const userReferralCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "user",
      });

      return res.json({
        status: "success",
        data: [
          {
            masterReferralCount,
            affiliateReferralCount,
            subAffiliateReferralCount,
            userReferralCount,
          },
        ],
      });
    }
  } catch (error) {
    console.error(error.message);
    return res.json({
      status: "error",
      message: "An error occurred",
    });
  }
};

exports.changeforgotpassword = async (req, res) => {
  const postData = req.body;
  try {
    const email = CleanHTMLData(CleanDBData(postData.email));
    const hashedPassword = await bcrypt.hash(postData.password, 12);
    const Email = await User.findOne({ email: email });
    if (!Email) {
      return res.json({ status: "error", message: "Invalid email" });
    }
    await User.updateOne(
      { email: email },
      { $set: { password: hashedPassword } }
    );
    return res.json({
      status: "success",
      message: "Password has been changed successfully",
    });
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
};
exports.checkforgotPasswordotp = async (req, res) => {
  const postData = req.body;
  try {
    const otp = CleanHTMLData(
      CleanDBData(Object.values(postData).slice(0, -1).join(""))
    );
    const email = CleanHTMLData(CleanDBData(postData.email));
    const Otp = await User.findOne({ forgotpasswordotp: otp });
    const Email = await User.findOne({ email: email });
    if (!Otp) {
      return res.json({ status: "error", message: "Invalid otp" });
    }
    if (!Email) {
      return res.json({ status: "error", message: "Invalid email" });
    }
    return res.json({
      status: "success",
      message: "OTP matched successfully",
    });
  } catch (error) {
    console.error("Invalid OTP", error.message);
    res.json({ message: "Invalid OTP", error });
  }
};
exports.forgotPassword = async (req, res) => {
  const postData = req.body;
  try {
    const email = CleanHTMLData(CleanDBData(postData.email));
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.json({ status: "error", message: "User not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.forgotpasswordotp = otp;
    await sendOTPEmail(user.email, user.firstName, otp);
    await user.save();
    return res.json({
      status: "success",
      message:
        "An email has been sent to your registered email with the OTP. Please check your inbox.",
      otp,
    });
  } catch (error) {
    console.error("Error OTP generated", error.message);
    res.json({ message: "Error OTP generated", error });
  }
};

exports.treeView = async (req, res) => {
  const authUser = await checkAuthorization(req, res);

  try {
    if (authUser) {
      const rootUser = await User.findById(authUser).lean();

      if (!rootUser) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      const buildTree = async (userId, level = 1) => {
        // if (level > 3 || !userId) return []; // Return an empty array if level > 3 or invalid userId
        if (!userId) return []; // Return an empty array if level > 3 or invalid userId

        // Find all users sponsored by the current userId
        const children = await User.find({ sponsorid: userId }).lean();

        if (!children || children.length === 0) {
          return []; // No children exist, return an empty array
        }

        const childNodes = await Promise.all(
          children.map(async (child) => ({
            id: child._id,
            title: child.username,
            usertype: child.usertype,
            // img: `${backoffice_link}/public/uploads/profile` + child.profileimage,
            children: await buildTree(child._id, level + 1), // Recursive call
          }))
        );

        return childNodes; // Return the built child nodes
      };

      const hierarchyTree = {
        id: rootUser._id,
        title: rootUser.username,
        usertype: rootUser.usertype,
        // img: `${backoffice_link}/public/uploads/profile` + rootUser.profileimage,
        children: await buildTree(rootUser._id), // Start recursion
      };

      return res.json({
        status: "success",
        data: hierarchyTree,
      });
    }
  } catch (error) {
    console.error("treeView error:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred",
    });
  }
};

exports.ReferralCountSingle = async (req, res) => {
  const postData = req.body;
  const withdrawalCoin = CleanHTMLData(CleanDBData(postData.coin));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      // Fetch counts for each user type and status
      const masterPendingCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "master",
        status: "pending",
      });
      const masterApprovedCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "master",
        status: "approved",
      });

      const affiliatePendingCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "affiliate",
        status: "pending",
      });
      const affiliateApprovedCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "affiliate",
        status: "approved",
      });

      const subAffiliatePendingCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "sub-affiliate",
        status: "pending",
      });
      const subAffiliateApprovedCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "sub-affiliate",
        status: "approved",
      });

      const userPendingCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "user",
        status: "pending",
      });
      const userApprovedCount = await User.countDocuments({
        sponsorid: authUser,
        usertype: "user",
        status: "approved",
      });

      return res.json({
        status: "success",
        data: {
          master: {
            pending: masterPendingCount,
            approved: masterApprovedCount,
          },
          affiliate: {
            pending: affiliatePendingCount,
            approved: affiliateApprovedCount,
          },
          subAffiliate: {
            pending: subAffiliatePendingCount,
            approved: subAffiliateApprovedCount,
          },
          user: { pending: userPendingCount, approved: userApprovedCount },
        },
      });
    }
  } catch (error) {
    console.error(error.message);
    return res.json({
      status: "error",
      message: "An error occurred",
    });
  }
};

exports.ReferralCount = async (req, res) => {
  const postData = req.body;
  const userType = CleanHTMLData(CleanDBData(postData.userType));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      // Fetch current user information
      const ReferralCount = await User.find({
        sponsorid: authUser,
        usertype: userType,
      });

      return res.json({
        status: "success",
        data: ReferralCount,
      });
    }
  } catch (error) {
    console.error(error.message);
    return res.json({
      status: "error",
      message: "An error occurred",
    });
  }
};

exports.referralLink = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);

    // Fetch user details
    const user = await User.findById(authUser);

    // Generate referral links based on available codes
    const referralLinks = {};

    if (user?.referralCodeMaster) {
      referralLinks.master = `${API_BASE_URL_Frontend}auth/signup/m-${user.referralCodeMaster}`;
    }
    if (user?.referralCodeAffiliate) {
      referralLinks.affiliate = `${API_BASE_URL_Frontend}auth/signup/a-${user.referralCodeAffiliate}`;
    }
    if (user?.referralCodeSubAffiliate) {
      referralLinks.subAffiliate = `${API_BASE_URL_Frontend}auth/signup/s-${user.referralCodeSubAffiliate}`;
    }
    if (user?.referralCodeUser) {
      referralLinks.user = `${API_BASE_URL_Frontend}auth/signup/u-${user.referralCodeUser}`;
    }

    if (Object.keys(referralLinks).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No referral codes available",
      });
    }

    return res.json({
      status: "success",
      referralLinks,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred",
    });
  }
};

exports.getUserStatus = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);

    const GreenID = await hasGreenID(authUser);

    res.status(200).json({
      message: "User status found",
      GreenID,
    });
  } catch (error) {
    console.error("Error in getUserStatus:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
