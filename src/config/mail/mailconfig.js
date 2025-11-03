const nodemailer = require('nodemailer');
// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: 'algox.capital',
    port: 465,
    secure: true,
    auth: {
      user: 'mails@algox.capital',
      pass: 'Mails@123!@#',
    },
  });

  module.exports = transporter