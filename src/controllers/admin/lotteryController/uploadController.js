const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const checkAuthorization = require("../../../middlewares/authMiddleware");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Cloudinary folder name
    allowed_formats: ["png", "jpg", "jpeg", "mp4"], // Allowed formats
    resource_type: "auto", // Automatically detect image or video
    public_id: (req, file) => {
      // Generate unique filename
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = file.originalname.split(".")[0];
      return `${dateStr}-${fileName}`;
    },
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "video/mp4"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only PNG, JPEG, and MP4 video files are allowed."));
    }
    cb(null, true);
  },
});

// Controller function for media upload
exports.uploadMedia = async (req, res) => {
  try {
    // Authorization check
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Check if a file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No media file uploaded.",
      });
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "video/mp4"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only PNG, JPEG, and MP4 files are allowed.",
      });
    }

    // Determine media type
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    // Return the media information with Cloudinary URL
    res.status(200).json({
      success: true,
      data: {
        mediaType,
        mediaUrl: req.file.path, // Cloudinary URL (instead of local path)
        originalName: req.file.originalname,
      },
      message: "Media uploaded successfully.",
    });
  } catch (error) {
    console.error("Error uploading media:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Unable to upload media.",
    });
  }
};

module.exports = {
  upload,
  uploadMedia: exports.uploadMedia,
};