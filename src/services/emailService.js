const nodemailer = require("nodemailer");

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // ✅ Prevent TLS block
  },
});

// OTP Email Template
const getOTPEmailTemplate = (firstName, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: linear-gradient(135deg, #f9f6f0 0%, #f0ebe0 100%);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #AC9B6D 0%, #6A5637 100%);
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 50px 40px;
          text-align: center;
        }
        .greeting {
          font-size: 22px;
          color: #6A5637;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .message {
          font-size: 16px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 35px;
        }
        .otp-container {
          background: white;
          border: 3px dashed #AC9B6D;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          box-shadow: 0 4px 15px rgba(172, 155, 109, 0.2);
        }
        .otp-label {
          font-size: 14px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 10px;
        }
        .otp-code {
          font-size: 42px;
          font-weight: bold;
          color: #6A5637;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
          margin: 10px 0;
        }
        .validity {
          font-size: 14px;
          color: #AC9B6D;
          margin-top: 15px;
          font-weight: 500;
        }
        .footer {
          background: #f5f0e8;
          padding: 30px;
          text-align: center;
          border-top: 2px solid #e8dcc8;
        }
        .footer-text {
          font-size: 13px;
          color: #999;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✨ Verify Your Email</h1>
        </div>
        <div class="content">
          <div class="greeting">Hello ${firstName}! 👋</div>
          <p class="message">
            Thank you for registering with us. To complete your process, 
            please verify your email address using the OTP code below.
          </p>
          <div class="otp-container">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
          </div>
        </div>
        <div class="footer">
          <p class="footer-text">© 2025 Global Tech. All rights reserved.</p>
          <p class="footer-text">This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ✅ NEW: Registration Approved Email Template
const getApprovedRegistrationTemplate = (firstName) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background: linear-gradient(135deg, #f9f6f0 0%, #f0ebe0 100%);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      }
      .header {
        background: linear-gradient(135deg, #6A5637 0%, #AC9B6D 100%);
        padding: 40px 30px;
        text-align: center;
      }
      .header h1 {
        color: white;
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .content {
        padding: 50px 40px;
        text-align: center;
      }
      .greeting {
        font-size: 22px;
        color: #6A5637;
        margin-bottom: 20px;
        font-weight: 500;
      }
      .message {
        font-size: 16px;
        color: #444;
        line-height: 1.7;
        margin-bottom: 35px;
      }
      .success-box {
        background: #fff;
        border-left: 6px solid #AC9B6D;
        border-radius: 8px;
        padding: 25px 20px;
        box-shadow: 0 5px 20px rgba(108, 88, 54, 0.1);
      }
      .footer {
        background: #f5f0e8;
        padding: 30px;
        text-align: center;
        border-top: 2px solid #e8dcc8;
      }
      .footer-text {
        font-size: 13px;
        color: #999;
        margin: 5px 0;
      }
      .login-btn {
        display: inline-block;
        background: #6A5637;
        color: white !important;
        text-decoration: none;
        padding: 12px 30px;
        border-radius: 30px;
        margin-top: 20px;
        font-weight: 600;
        transition: 0.3s;
      }
      .login-btn:hover {
        background: #AC9B6D;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 Registration Approved!</h1>
      </div>
      <div class="content">
        <div class="greeting">Dear ${firstName},</div>
        <div class="success-box">
          <p class="message">
            Great news! Your registration has been <strong>approved</strong> successfully.  
            You can now log in to your account and start exploring all the available features.
          </p>
          <a href="https://yourdomain.com/login" class="login-btn">Login Now</a>
        </div>
      </div>
      <div class="footer">
        <p class="footer-text">© 2025 Your Company Name. All rights reserved.</p>
        <p class="footer-text">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

// Send OTP Email
const sendOTPEmail = async (email, firstName, otp) => {
  try {
    const mailOptions = {
      from: `"Global Tech" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Verify Your Email - OTP Code",
      html: getOTPEmailTemplate(firstName, otp),
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, error: error.message };
  }
};

// ✅ Send Registration Approved Email
const sendApprovedRegistrationEmail = async (email, firstName) => {
  try {
    const mailOptions = {
      from: `"Global Tech" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "✅ Registration Approved - You Can Now Login!",
      html: getApprovedRegistrationTemplate(firstName),
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTPEmail, sendApprovedRegistrationEmail };
