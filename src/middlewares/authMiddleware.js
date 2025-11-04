const jwt = require("jsonwebtoken");
const User = require("../models/auth");
const jwtSecretKey = process.env.SECRET_KEY;

async function checkAuthorization(req) {
  if (!req.headers.authorization) {
    return { success: false, message: "Authorization header is missing." };
  }

  const token = req.headers.authorization.split(" ")[1];

  try {
    const decoded = jwt.verify(token, jwtSecretKey);
    const userData = await User.findById(decoded.id);

    if (!userData) {
      return { success: false, message: "Invalid User." };
    }

    return userData.id;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { success: false, message: "Token expired." };
    }
    return { success: false, message: "Invalid token." };
  }
}

module.exports = checkAuthorization;
