const path = require("path");
const checkAuthorization = require("../../../middlewares/authMiddleware");
const Blog = require("../../../models/Blog");

exports.createBlog = async (req, res) => {
  // const authUser = await checkAuthorization(req, res);
  // if (!authUser) {
  //   return res.status(401).json({ success: false, message: "Unauthorized" });
  // }

  try {
    const { title, description, mediaType, mediaUrl } = req.body;

    // Create blog post
    const blog = await Blog.create({
      title,
      description,
      media: {
        type: mediaType,
        url: mediaUrl,
      },
      // author: authUser._id,
      createdAt: new Date(),
    });

    await blog.save();

    res.status(201).json({
      success: true,
      data: blog,
      message: "Blog post created successfully",
    });
  } catch (error) {
    console.error("Error creating blog post:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.getallBlogs = async (req, res) => {
  // const authuser = await checkAuthorization(req, res);
  // if (!authuser) {
  //   return res.status(401).json({
  //     success: false,
  //     message: "Unauthorized access",
  //   });
  // }
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    const modifiedBlogs = blogs.map((blog) => {
      if (blog.media && blog.media.url) {
        blog.media.url = `${process.env.BACKEND_URL}${blog.media.url}`;
      }
      return blog;
    });

    res.status(200).json({
      success: true,
      data: modifiedBlogs,
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to fetch blogs.",
    });
  }
};

exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const deletedBlog = await Blog.findByIdAndDelete(id);

    if (!deletedBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
      data: deletedBlog,
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to delete blog.",
    });
  }
};

exports.updateBlog = async (req, res) => {
  try {
    const { id, title, description, mediaType, mediaUrl } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        title,
        description,
        media: {
          type: mediaType,
          url: mediaUrl,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      success: false,
      message: "Server Error. Failed to update blog.",
    });
  }
};
