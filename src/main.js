const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const cron = require("node-cron");
const authRoutes = require("./routes/user/auth");
const testRoute = require("./routes/user/testingRoute");
const companyRoutes = require("./routes/user/companies");
const depositRoutes = require("./routes/user/deposit");
const path = require("path");
// const {
//   startCronJob,
// } = require("./controllers/admin/Scheduled/CommissionDistributor");
// const {
//   autoPurchaseCron,
// } = require("./controllers/admin/Scheduled/AutoPurchase");

const backoffice_link = "https://mobicrypto-backend.threearrowstech.com";
// const backoffice_link = "https://mobicrypto-backend.threearrowstech.com";

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3005",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://globaltech-1.web.app",
    "https://globaltech1.com/",
    "http://appbittrend.m5networkhub.com",
    "https://adminbittrend.m5networkhub.com",
    "http://adminbittrend.m5networkhub.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  credentials: true, // Allow cookies from this origin
};

const app = express();
// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors(corsOptions));
app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/user/api", authRoutes);
app.use("/test/api", testRoute);
app.use("/user/api", companyRoutes);
app.use("/user/api", depositRoutes);
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Server is healthy",
  });
});

// // Start the minting commission cron job when server starts
// startMintingCronJob();

// // Optional: Add a route for manual trigger (for testing)
// app.post('/api/admin/trigger-minting-cron', async (req, res) => {
//   try {
//     await manualTriggerMintingCron();
//     res.json({ success: true, message: 'Minting commission cron job triggered manually' });
//   } catch (error) {
//     res.status(500).json({ success: false, message: 'Error triggering cron job', error: error.message });
//   }
// });

mongoose.connect(process.env.CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.once("open", () => {
  app.listen(process.env.PORT, () => {});
  console.log(
    "Connected to MongoDB and server is running on port",
    process.env.PORT
  );
});

module.exports = { backoffice_link };
