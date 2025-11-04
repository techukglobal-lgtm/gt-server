const express = require("express");
const router = express.Router();
const authController = require("../../controllers/user/authController");
const checkAuthorization = require("../../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../../models/auth");
const {
  updateUserProfile,
  updatePassword,
  forgotPasswordSendEmail,
  verifyOtpAndGenerateMagicLink,
  resetPasswordWithLinkToken,
  updateProfilePic,
  getRefferalHistory,
  generateLinkTokenForUser,
} = require("../../controllers/user/profileController");
const {
  updateStatus,
  updateLevel,
  getAllAccountsOfUser,
  updateSponsor,
  updateEmail,
  updateWallet,
  updateWithdrawalStatus,
  acceptRegistration,
} = require("../../controllers/admin/user/userController");
const {
  getRejectedKycApplications,
} = require("../../controllers/user/kycController");
const {
  createWithdrawal,
  getUserWithdrawals,
} = require("../../controllers/user/withdrawController");
const {
  getTransactionReports,
  getUserTransactionSummary,
} = require("../../controllers/user/reportsController");
const {
  getReferralTree,
} = require("../../controllers/admin/mlmController/mlmController");
const {
  toggleAutoPurchase,
  toggleMixPurchase,
} = require("../../controllers/user/lotteryController");
const { updateUserRank } = require("../../controllers/user/rankController");
const {
  getRegistraions,
} = require("../../controllers/user/dashboardController");
const {
  addWalletBalance,
} = require("../../controllers/admin/walletController");
const uploadDir = path.join(__dirname, "../../public/uploads/profile");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use absolute path
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const uploadResume = multer({ storage: storage });
// router.post(
//   "/updateProfileImage",
//   uploadResume.single("image"),
//   async (req, res) => {
//     const file = req.file;
//     try {
//       const authUser = await checkAuthorization(req, res);
//       if (authUser) {
//         if (file) {
//           const user = await User.findByIdAndUpdate(authUser, {
//             profileimage: file.filename,
//           });
//           res.json({
//             status: "success",
//             message: "Profile picture updated successfully",
//           });
//         }
//       }
//     } catch (error) {
//       console.error("Error updating password:", error.message);
//       res.json({ status: "error", message: "Server error" });
//     }
//   }
// );

router.post("/register", authController.register);
router.post("/adminRegister", authController.adminRegister);
router.post("/login", authController.login);
router.post("/verifyToken", authController.verifyToken);
router.post("/updatePassword", authController.updatePassword);
router.post("/forgotpassword", authController.forgotPassword);
router.post("/checkforgotpasswordotp", authController.checkforgotPasswordotp);
router.post("/changeforgotpassword", authController.changeforgotpassword);
router.post("/updateProfile", authController.updateProfile);
router.post("/treeviewdata", getReferralTree);
router.post("/referralCountSingle", authController.ReferralCountSingle);
router.post("/referralCount", authController.ReferralCount);
router.post("/dashboardData", authController.dashboardData);
router.post("/update-profile", updateUserProfile);
router.post("/update-password", updatePassword);
router.post("/forgot-password-email", forgotPasswordSendEmail);
router.post("/verify-forgot-otp", verifyOtpAndGenerateMagicLink);
router.post("/reset-password-linktoken", resetPasswordWithLinkToken);
router.post("/generateLinkTokenForUser", generateLinkTokenForUser);
router.post("/updateProfileImage", updateProfilePic);
router.post("/updateStatus", updateStatus);
router.post("/updateSponsor", updateSponsor);
router.post("/updateWithdrawalStatus", updateWithdrawalStatus);
router.post("/updateEmail", updateEmail);
router.post("/updateWallet", updateWallet);
router.post("/updateLevel", updateLevel);
router.post("/getRejectedKyc", getRejectedKycApplications);
router.post("/withdraw", createWithdrawal);
router.post("/getwithdrwahistory", getUserWithdrawals);
// router.post("/updatewithdrawstatus", updateWithdrawalStatus);
router.post("/getuserwithdrawhistory", getRefferalHistory);
router.post("/getUserReports", getTransactionReports);
router.post("/getUserTransactionSummary", getUserTransactionSummary);
router.post("/toggleAutoPurchase", toggleAutoPurchase);
router.post("/toggleMixPurchase", toggleMixPurchase);
// router.post("/updateRank", updateUserRank);

// ======================   MOBICRYPTO ROUTES  ==============================
router.post("/createMiniAdmin", authController.createMiniAdmin);
router.post("/getMiniAdmins", authController.getMiniAdmins);
router.post("/updateMiniAdmin", authController.updateMiniAdmin);
router.post("/deleteMiniAdmin", authController.deleteMiniAdmin);
router.post("/getMiniAdmin/:id", authController.getMiniAdminById);
router.post("/toggleMiniAdminStatus", authController.toggleMiniAdminStatus);
router.post("/updateWalletAddress", authController.updateWalletAddresses);
router.post("/getAllAccountsOfUser", getAllAccountsOfUser);
// router.post("/getGreenIdUser", authController.getUserStatus);
router.post("/getNewRegistrations", getRegistraions);
router.post("/acceptRegistration", acceptRegistration);
router.post("/addWalletBalance", addWalletBalance);
module.exports = router;
