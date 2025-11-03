const User = require("../../models/auth");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const checkAuthorization = require("../../middlewares/authMiddleware");
const nodemailer = require("nodemailer");

exports.updateProfilePic = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId, filePath } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profileImg: filePath },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile image updated successfully",
      user,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error uploading image", error: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId, updateData } = req.body;

    if (!userId || !updateData) {
      return res
        .status(400)
        .json({ message: "User ID and update data are required." });
    }

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const allowedFields = ["username", "firstname", "lastname", "email"];
    let updatedFields = {};

    Object.keys(updateData).forEach((field) => {
      if (allowedFields.includes(field)) {
        updatedFields[field] = updateData[field];
      }
    });

    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).json({ message: "No valid fields to update." });
    }

    await User.findByIdAndUpdate(userId, updatedFields, { new: true });

    res.status(200).json({
      message: "User profile updated successfully",
      user: updatedFields,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({
        message: "User ID, old password, and new password are required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect." });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.forgotPasswordSendEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User with this email does not exist.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    user.forgototp = otp;
    await user.save();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Global Tech Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for Password Reset",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 0;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              margin: 20px auto;
              border: 1px solid #e4e4e4;
            }
            .header {
              background-color: #4285F4;
              color: white;
              padding: 15px;
              text-align: center;
            }
            .content {
              padding: 20px;
            }
            h1 {
              background-color: #f5f5f5;
              border-radius: 6px;
              padding: 15px;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              color: #4285F4;
              margin: 20px 0;
              border: 1px dashed #ccc;
            }
            h2 {
              color: #333;
              margin-top: 0;
            }
            p {
              margin-bottom: 15px;
            }
            .footer {
              background-color: #f5f5f5;
              padding: 10px;
              text-align: center;
              font-size: 12px;
              color: #777;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color: white; margin: 0;">Account Password Reset</h2>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName || ""},</h2>
              <p>Your OTP for password reset is:</p>
              <h1>${otp}</h1>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Global Tech. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: "OTP sent to your email.", email });
  } catch (error) {
    console.error("Error in forgot password:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

exports.verifyOtpAndGenerateMagicLink = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res
        .status(400)
        .json({ message: "Email and OTP code are required." });
    }

    // Find all users with matching email and OTP
    const users = await User.find({ email });
    if (!users || users.length === 0) {
      return res.status(400).json({ message: "Invalid OTP or email." });
    }

    // Return user accounts for selection
    const userAccounts = users.map((user) => ({
      id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImg: user.profileImg,
    }));

    return res.status(200).json({
      message: "OTP Verified successfully.",
      accounts: userAccounts,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({
      message: "Internal server error. Please try again later.",
      error: error.message,
    });
  }
};
exports.generateLinkTokenForUser = async (req, res) => {
  try {
    const { userId, email, otpCode } = req.body;

    if (!userId || !email || !otpCode) {
      return res
        .status(400)
        .json({ message: "User ID, email and OTP code are required." });
    }

    const user = await User.findOne({ _id: userId, email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid user selection or expired OTP." });
    }

    const randomString = crypto
      .randomBytes(16)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 24);
    const linkToken = `${userId}-${randomString}`.substring(0, 24);

    user.linkToken = linkToken;
    await user.save();

    return res.status(200).json({
      message: "Account selected successfully.",
      linkToken,
    });
  } catch (error) {
    console.error("Error generating link token:", error);
    return res.status(500).json({
      message: "Internal server error. Please try again later.",
      error: error.message,
    });
  }
};

exports.resetPasswordWithLinkToken = async (req, res) => {
  try {
    const { linkToken, newPassword } = req.body;

    if (!linkToken || !newPassword) {
      return res
        .status(400)
        .json({ message: "Link token and new password are required." });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long." });
    }

    const user = await User.findOne({ linkToken });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired link token." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.linkToken = undefined;
    user.forgototp = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
      error: error.message,
    });
  }
};

exports.getRefferalHistory = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId } = req.body; // Get user ID from request body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required in request body",
      });
    }

    // Get referrer user and their referral code
    const referrer = await User.findById(userId);
    if (!referrer || !referrer.refferrCode) {
      return res.status(404).json({
        success: false,
        message: "Referrer user or referral code not found",
      });
    }

    const referralCode = referrer.refferrCode;

    // Find all users referred by this user via referral code
    const referredUsers = await User.find({ refferBy: referralCode });

    const totalReferrals = referredUsers.length;

    // Prepare monthly data (Jan to Dec)
    const monthlyData = [
      { month: "Jan", users: 0 },
      { month: "Feb", users: 0 },
      { month: "Mar", users: 0 },
      { month: "Apr", users: 0 },
      { month: "May", users: 0 },
      { month: "Jun", users: 0 },
      { month: "Jul", users: 0 },
      { month: "Aug", users: 0 },
      { month: "Sep", users: 0 },
      { month: "Oct", users: 0 },
      { month: "Nov", users: 0 },
      { month: "Dec", users: 0 },
    ];

    // Count referrals by month using createdAt
    referredUsers.forEach((user) => {
      if (user.createdAt) {
        const monthIndex = user.createdAt.getMonth(); // 0 = Jan
        monthlyData[monthIndex].users += 1;
      }
    });

    // Return data
    return res.status(200).json({
      success: true,
      data: {
        totalReferrals,
        referralHistory: monthlyData,
      },
    });
  } catch (error) {
    console.error("Error fetching referral history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral history",
      error: error.message,
    });
  }
};
