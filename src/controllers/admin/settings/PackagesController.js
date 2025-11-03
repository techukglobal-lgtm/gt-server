const checkAuthorization = require("../../../middlewares/authMiddleware");
const packages = require("../../../models/pakages");

exports.addPackage = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { payload } = req.body;

  if (
    !payload.fee ||
    !payload.amount ||
    !payload.hubPrice ||
    !payload.hubCapacity ||
    !payload.minimumMintingRequired ||
    !payload.minimumMinting
  ) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (amount, hubPrice, hubCapacity, minimumMinting) are required",
    });
  }

  try {
    const newPackage = new packages({
      fee: payload.fee,
      amount: payload.amount,
      hubPrice: payload.hubPrice,
      hubCapacity: payload.hubCapacity,
      minimumMinting: payload.minimumMinting,
      minimumMintingRequired: payload.minimumMintingRequired,
    });
    await newPackage.save();
    res.status(201).json({
      success: true,
      message: "Package added successfully",
      package: newPackage,
    });
  } catch (error) {
    console.error("Error saving package:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllPackages = async (req, res) => {
  try {
    const allPackages = await packages.find();
    res.status(200).json({
      success: true,
      packages: allPackages,
    });
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updatePackage = async (req, res) => {
  const authUser = await checkAuthorization(req, res);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { payload } = req.body;

  if (
    !payload._id ||
    !payload.fee ||
    !payload.amount ||
    !payload.hubPrice ||
    !payload.hubCapacity ||
    !payload.minimumMinting
  ) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (id, amount, hubPrice, hubCapacity, minimumMinting) are required",
    });
  }

  try {
    const updatedPackage = await packages.findByIdAndUpdate(
      payload._id,
      {
        amount: payload.amount,
        hubPrice: payload.hubPrice,
        hubCapacity: payload.hubCapacity,
        fee: payload.fee,
        minimumMinting: payload.minimumMinting,
        minimumMintingRequired: payload.minimumMintingRequired,
      },
      { new: true }
    );

    if (!updatedPackage) {
      return res
      .status(404)
      .json({ success: false, message: "Package not found" });
    }

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      package: updatedPackage,
    });
  } catch (error) {
    console.error("Error updating package:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
