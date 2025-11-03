// logger.js
const pino = require('pino');
const { multistream } = require('pino-multi-stream');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define a Mongoose schema for logs
const logSchema = new mongoose.Schema({
  level: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  userid: String,
  hostdetail: String,
  useragent: String,
});

const LogModel = mongoose.model('Log', logSchema);

// Custom stream to log to MongoDB
const customStream = {
  write: async (message) => {
    const logEntry = JSON.parse(message);
    const logDocument = new LogModel({
      level: logEntry.level,
      message: logEntry.msg,
      timestamp: new Date(),  // Or use your own timestamp logic
      userid: logEntry.userid,
      hostdetail: logEntry.hostname,
      useragent: logEntry.userAgent,
    });

    try {
      await logDocument.save();
    } catch (err) {
      console.error('Error saving log to MongoDB:', err);
    }
  },
};

// Setup Pino with multi-stream
const streams = [
  { stream: process.stdout },  // Console logging
  { stream: customStream },    // MongoDB logging
];

const logger = pino({ level: 'info', base: null }, multistream(streams));

module.exports = logger;