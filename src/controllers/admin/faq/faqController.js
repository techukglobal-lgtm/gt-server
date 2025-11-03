const checkAuthorization = require("../../../middlewares/authMiddleware");
const Faqs = require("../../../models/faqs");

exports.addFaq = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { question, answer } = req.body;

  if (!question || !answer) {
    return res
      .status(400)
      .json({ success: false, message: "Question and answer are required" });
  }

  try {
    const newFaq = new Faqs({ question, answer });
    await newFaq.save();
    res
      .status(201)
      .json({ success: true, message: "FAQ added successfully", faq: newFaq });
  } catch (error) {
    console.error("Error saving FAQ:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllFaqs = async (req, res) => {
  try {
    const faqs = await Faqs.find();
    res.status(200).json({ success: true, faqs });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteFaq = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { id } = req.body;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "FAQ ID is required" });
  }
  try {
    const deletedFaq = await Faqs.findByIdAndDelete(id);
    if (!deletedFaq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "FAQ deleted successfully" });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateFaq = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { id, question, answer } = req.body;

  if (!id || !question || !answer) {
    return res.status(400).json({
      success: false,
      message: "ID, question, and answer are required",
    });
  }

  try {
    const updatedFaq = await Faqs.findByIdAndUpdate(
      id,
      { question, answer },
      { new: true }
    );

    if (!updatedFaq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      faq: updatedFaq,
    });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
