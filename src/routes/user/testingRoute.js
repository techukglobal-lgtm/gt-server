const express = require("express");
const User = require("../../models/auth");
const router = express.Router();
const csv = require("csv-parser");
const path = require("path");
const mongoose = require("mongoose");
const fs = require("fs");

// Helper to generate random referral codes
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10);
}

router.post("/create_mock_users", async (req, res) => {
  try {
    const totalUsers = 20;
    const mockUsers = [];

    // Step 1: Create first user (root user)
    const firstUser = new User({
      username: `mockuser1`,
      email: `mockuser1@example.com`,
      password: "hashedpassword123",
      firstName: "Mock1",
      lastName: "User1",
      refferrCode: generateReferralCode(),
      refferBy: "4fd12a4c",
      status: "approved",
      walletBalance: Math.floor(Math.random() * 1000),
    });

    const savedFirstUser = await firstUser.save();
    mockUsers.push(savedFirstUser);

    // Step 2: Create remaining users with random refferBy from already created ones
    for (let i = 2; i <= totalUsers; i++) {
      // Pick a random parent from existing users
      const randomParent =
        mockUsers[Math.floor(Math.random() * mockUsers.length)];

      const newUser = new User({
        username: `mockuser${i}`,
        email: `mockuser${i}@example.com`,
        password: "hashedpassword123",
        firstName: `Mock${i}`,
        lastName: `User${i}`,
        refferrCode: generateReferralCode(),
        refferBy: randomParent.refferrCode, // random parent user
        status: "approved",
        walletBalance: Math.floor(Math.random() * 1000),
      });

      const savedUser = await newUser.save();
      mockUsers.push(savedUser);
    }

    res.status(201).json({
      success: true,
      message: `${totalUsers} mock users created successfully with random tree structure!`,
      users: mockUsers,
    });
  } catch (error) {
    console.error("Error creating mock users:", error);
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

module.exports = router;
