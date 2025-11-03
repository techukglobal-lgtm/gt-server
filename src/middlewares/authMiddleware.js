const jwt = require('jsonwebtoken');
const User = require('../models/auth');

const jwtSecretKey = process.env.SECRET_KEY

async function checkAuthorization(req, res) {
  // Check if the authorization header is present
  if (!req.headers.authorization) {
    res.json({ status: 'error', message: 'Authorization header is missing.' });
    return false;
  } else {
    const token = req.headers.authorization.split(' ')[1];
    return new Promise((resolve) => {
      jwt.verify(token, jwtSecretKey, async (err, user) => {
        if (err) {
          res.json({ status: 'error', message: 'token_expired' });
          resolve(false); // Use resolve instead of reject
        } else {
          try {
            // const userData = await User.findOne({ username: user.username });
            const userData = await User.findById(user.id)

            if (userData && userData._id == user.id) {
              resolve(userData.id);
            } else {
              res.json({ status: 'error', message: 'Invalid User.' });
              resolve(false); // Use resolve instead of reject
            }
          } catch (error) {
            console.error('Error fetching user:', error);
            res.json({ status: 'error', message: 'Server error occurred' });
            resolve(false); // Use resolve instead of reject
          }
        }
      });
    });
  }
}

module.exports = checkAuthorization;

