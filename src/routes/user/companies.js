const {
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitionById,
  getParticipants,
  announceWinner,
  getCompetitionsOfUser,
  addLiveDraw,
  addWinnerPicture,
} = require("../../controllers/admin/lotteryController/lotteryController");
const {
  createBlog,
  getallBlogs,
  deleteBlog,
  updateBlog,
} = require("../../controllers/admin/lotteryController/blogController");
const {
  updateCommissionSettings,
  getCommissionSettings,
} = require("../../controllers/admin/lotteryController/commissionController");
const router = require("express").Router();

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  uploadMedia,
  upload,
} = require("../../controllers/admin/lotteryController/uploadController");
const {
  getUsers,
  loginAsUser,
} = require("../../controllers/admin/user/userController");
const {
  applyKyc,
  approveKyc,
  rejectKyc,
  getAllKycApplications,
} = require("../../controllers/user/kycController");
const {
  getAllCompetitions,
  getWinnedCompetitions,
} = require("../../controllers/user/lotteryController");
const {
  updateProfilePic,
} = require("../../controllers/user/profileController");
const {
  createOrder,
  getOrders,
} = require("../../controllers/admin/orders/orderController");
const {
  createPendingTransaction,
  updateTransactionStatus,
  getAllTransactions,
} = require("../../controllers/admin/TransactionControlller.js/TransactionController");
const {
  CompleteOrder,
  getTransactions,
  getUnilevelTree,
  getBinaryTree,
  getBinaryTreePaginated,
  getAllDepositTransactions,
  updateDepositStatus,
  getAllDepositByAdminTransactions,
} = require("../../controllers/admin/mlmController/mlmController");
const {
  getAdminDashboardData,
  getAllWalletsData,
} = require("../../controllers/admin/dashboard/dashboardController");
const {
  addFaq,
  getAllFaqs,
  deleteFaq,
  updateFaq,
} = require("../../controllers/admin/faq/faqController");
const verifyRecaptcha = require("../../middlewares/reCaptchaMiddleware");
const { getWinners } = require("../../controllers/user/winnerController");
const checkAuthorization = require("../../middlewares/authMiddleware");
const { deposit } = require("../../controllers/user/depositController");
const {
  purchasePackage,
} = require("../../controllers/user/PurchaseController");
const { getUserPackages } = require("../../controllers/user/packageController");
const {
  startMinting,
  getMintingActivity,
  recordSelfClick,
  recordClick,
  toggleMintingType,
} = require("../../controllers/user/mintingController");
const {
  addPackage,
  getAllPackages,
  updatePackage,
} = require("../../controllers/admin/settings/PackagesController");
const {
  getAllMintingCommissions,
  updateMintingCommission,
} = require("../../controllers/admin/settings/MintingCommission");
const {
  getAllLevelBonuses,
  updateLevelBonus,
} = require("../../controllers/admin/settings/levelBonus");
const {
  getAllSettings,
  updateDirectBonus,
} = require("../../controllers/admin/settings/directbonus");
const {
  createWithdrawRequest,
  getAllWithdrawals,
  getUserWithdrawals,
  updateWithdrawalStatus,
  deleteWithdrawal,
} = require("../../controllers/user/withdraw");
const {
  getBuildingBonus,
  updateBuildingBonus,
} = require("../../controllers/admin/settings/buldingBonus");
const {
  getWithdrawalFees,
  updateWithdrawalFees,
} = require("../../controllers/admin/settings/withdrawlFee");
const {
  getAllRanks,
  getRankById,
  updateRank,
} = require("../../controllers/admin/settings/rank");
const {
  AdminDashboardDataNew,
} = require("../../controllers/admin/dashboardData/dashboardData");

const { userRank } = require("../../controllers/user/rankController");

const {
  rankQualification,
} = require("../../controllers/user/rankQualification");
const {
  getDashboardAnalytics,
} = require("../../controllers/user/dashboardController");
const {
  getSwitchingFee,
  updateSwitchingFee,
} = require("../../controllers/admin/settings/switchingFee");
const {
  getTransactionsByType,
} = require("../../controllers/admin/adminReports/adminReports");
const {
  getMintingCap,
  updateMintingCap,
} = require("../../controllers/admin/settings/Mintingcap");
const {
  getAllRankHistory,
  getCurrentUserRankHistory,
} = require("../../controllers/admin/settings/RankHistory");
const {
  claimDailyProfit,
  getMiningStatus,
  getProfitHistory,
} = require("../../controllers/user/EarnControllerj");
const { getDepositSettings, updateDepositSettings } = require("../../controllers/admin/depositSettingsController");
const { getWithdrawalSettings, updateWithdrawalSettings } = require("../../controllers/admin/withdrawalSettingsController");
const { getReferralCommissionSettings, updateReferralCommissionSettings } = require("../../controllers/admin/referralCommissionSettingsController");
const { getDailyCommissionSettings, updateDailyCommissionSettings } = require("../../controllers/admin/dailyCommissionSettingsController");

router.post("/upload", upload.single("media"), uploadMedia);

router.post("/competitions", createCompetition);
router.post("/updateCommissionSettings", updateCommissionSettings);
router.post("/getCompetitionById", getCompetitionById);
router.post("/getCommissionSettings", getCommissionSettings);
router.post("/getAllUsers", getUsers);
router.post("/loginAsUser", loginAsUser);
router.post("/applyKyc", applyKyc);
router.post("/approveKyc", approveKyc);
router.post("/rejectKyc", rejectKyc);
router.post("/getPendingKyc", getAllKycApplications);
router.post("/getCompetitions", getAllCompetitions);
router.post("/updateCompetition/:id", updateCompetition);
router.post("/getWinnedCompetition", getWinnedCompetitions);
router.post("/addLiveDrawLink", addLiveDraw);
router.post("/deleteCompetition", deleteCompetition);
router.post("/createblog", createBlog);
router.post("/getallBlogs", getallBlogs);
router.post("/deleteblog", deleteBlog);
router.post("/updateblog", updateBlog);
router.post("/updateProfileImage", updateProfilePic);
router.post("/createOrder", verifyRecaptcha, createOrder);
router.post("/completeOrder", CompleteOrder);
router.post("/getParticipants", getParticipants);
router.post("/getOrders", getOrders);
router.post("/announceWinner", announceWinner);
router.post("/getCompetitionsOfUser", getCompetitionsOfUser);
router.post("/addWinnerPicture", addWinnerPicture);
router.post("/getWinners", getWinners);
router.post("/getAdminDashboardData", getAdminDashboardData);
// TRANSACTION ROUTES
router.post("/addTransaction", createPendingTransaction);
router.post("/updateTransactionStatus", updateTransactionStatus);
router.post("/getTransactions", getTransactions);
router.post("/updateDepositStatus", updateDepositStatus);
router.post("/getAllDepositByAdminTransactions", getAllDepositByAdminTransactions);
router.post("/getAllDepositTransactions", getAllDepositTransactions);
router.post("/addfaqs", addFaq);
router.post("/getWalletInsights", getAllWalletsData);
router.post("/getfaqs", getAllFaqs);
router.post("/deletefaqs", deleteFaq);
router.post("/updatefaq", updateFaq);

// ======================   MOBICRYPTO ROUTES  ==============================

// router.post("/deposit", deposit);
// router.post("/addpackage", addPackage);
// router.post("/getpackages", getAllPackages);
// router.post("/updatepackage", updatePackage);
// router.post("/createPackageOrder", purchasePackage);
// router.post("/getPackagesOfUser", getUserPackages);
// router.post("/startMinting", startMinting);
// router.post("/getMintingActivities", getMintingActivity);
// router.post("/recordClick", recordClick);
// router.post("/getAllMintingCommission", getAllMintingCommissions);
// router.post("/updateMintingCommission", updateMintingCommission);
// router.post("/getAllLevelBonuses", getAllLevelBonuses);
// router.post("/updateLevelBonus", updateLevelBonus);
// router.post("/getPackagesOfUser", getUserPackages);
// router.post("/getAllMintingCommission", getAllMintingCommissions);
// router.post("/updateMintingCommission", updateMintingCommission);
router.post("/getUnilevelTree", getUnilevelTree);
// router.post("/getsetting", getAllSettings);
// router.post("/updatedirectbonus", updateDirectBonus);
// router.post("/getbuildingbonus", getBuildingBonus);
// router.post("/updatebuildingbonus", updateBuildingBonus);
router.post("/createWithdrawRequest", createWithdrawRequest);
router.post("/getWithdrawRequests", getAllWithdrawals);
router.post("/getcurrentuserPandingwithdrawals", getUserWithdrawals);
router.post("/updateWithdrawStatus", updateWithdrawalStatus);
// router.post("/deleteWithdraw", deleteWithdrawal);
// router.post("/getwithdrawlFees", getWithdrawalFees);
// router.post("/updateWithdrawlFees", updateWithdrawalFees);
// router.post("/getranks", getAllRanks);
// router.post("/getrankbyid", getRankById);
// router.post("/updaterank", updateRank);
// router.post("/adminDashboardDataNew", AdminDashboardDataNew);
// router.post("/getbinaryTree", getBinaryTreePaginated);
// router.post("/rankQualification", rankQualification);
// router.post("/getDashboardAnalytics", getDashboardAnalytics);
// router.post("/getSwitchingFee", getSwitchingFee);
// router.post("/updateSwitchingFee", updateSwitchingFee);
// router.post("/toggleMintingType", toggleMintingType);
router.post("/getTransactionsByType", getTransactionsByType);
// router.post("/getMintingCap", getMintingCap);
// router.post("/updateMintingCap", updateMintingCap);
// router.post("/getAdminRankHistory", getAllRankHistory);
// router.post("/getCurrentUserRankHistory", getCurrentUserRankHistory);
router.post("/claimEarning", claimDailyProfit);
router.post("/miningStatus", getMiningStatus);
router.post("/getProfitHistory", getProfitHistory);

router.post("/getdepositsettings", getDepositSettings);
router.post("/updatedepositsettings", updateDepositSettings);
router.post("/getwithdrawalsettings", getWithdrawalSettings);
router.post("/updatewithdrawalsettings", updateWithdrawalSettings);
router.post("/getreferralcommissionsettings", getReferralCommissionSettings);
router.post("/updatereferralcommissionsettings", updateReferralCommissionSettings);
router.post("/getdailycommissionsettings", getDailyCommissionSettings);
router.post("/updatedailycommissionsettings", updateDailyCommissionSettings);

module.exports = router;
