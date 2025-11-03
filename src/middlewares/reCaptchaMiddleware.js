// Add this to your backend API (Node.js/Express example)
const axios = require("axios");

// reCAPTCHA verification middleware
const verifyRecaptcha = async (req, res, next) => {
  try {
    const { recaptchaToken } = req.body;

    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA token is required",
      });
    }

    // Verify with Google
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;

    const response = await axios.post(verificationUrl, null, {
      params: {
        secret: secretKey,
        response: recaptchaToken,
        remoteip: req.ip, // Optional: include user's IP
      },
    });

    const { success, score, action } = response.data;

    if (!success) {
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA verification failed",
      });
    }

    // For reCAPTCHA v3, you can check the score (0.0 to 1.0)
    // Lower scores are more likely to be bots
    if (score && score < 0.5) {
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA score too low",
      });
    }

    // Verification successful, proceed to next middleware
    next();
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return res.status(500).json({
      success: false,
      message: "reCAPTCHA verification error",
    });
  }
};
module.exports = verifyRecaptcha;
