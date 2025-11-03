const checkAuthorization = require("../../../middlewares/authMiddleware");
const User = require("../../../models/auth");
const Transaction = require("../../../models/Transaction");

exports.getTransactionsByType = async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { transactionType, page = 1, limit = 50, status } = req.body;

    if (!transactionType) {
      return res
        .status(400)
        .json({ success: false, message: "transactionType is required" });
    }

    let query = { transactionType };
    if (status && ["approved", "pending", "rejected"].includes(status)) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const populatedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        const transactionObj = transaction.toObject();

        if (
          transactionObj.senderId === 0 ||
          transactionObj.senderId === "0" ||
          transactionObj.senderId === "system"
        ) {
          transactionObj.senderDetails = {
            name: "Admin",
            username: "admin",
            email: "admin@system.com",
            isAdmin: true,
          };
        } else {
          try {
            const sender = await User.findById(transactionObj.senderId).select(
              "username email firstName lastName profileImg"
            );
            if (sender) {
              transactionObj.senderDetails = {
                name:
                  sender.firstName && sender.lastName
                    ? `${sender.firstName} ${sender.lastName}`
                    : sender.username,
                username: sender.username,
                email: sender.email,
                profileImage: sender.profileImg,
                isAdmin: false,
              };
            } else {
              transactionObj.senderDetails = {
                name: `User ${transactionObj.senderId
                  .toString()
                  .substring(0, 8)}...`,
                username: "Unknown User",
                email: "N/A",
                isAdmin: false,
              };
            }
          } catch (error) {
            console.error("Error fetching sender details:", error);
            transactionObj.senderDetails = {
              name: `User ${transactionObj.senderId
                .toString()
                .substring(0, 8)}...`,
              username: "Unknown User",
              email: "N/A",
              isAdmin: false,
            };
          }
        }

        if (
          transactionObj.receiverId === 0 ||
          transactionObj.receiverId === "0" ||
          transactionObj.receiverId === "system"
        ) {
          transactionObj.receiverDetails = {
            name: "Admin",
            username: "admin",
            email: "admin@system.com",
            isAdmin: true,
          };
        } else {
          try {
            const receiver = await User.findById(
              transactionObj.receiverId
            ).select("username email firstName lastName profileImg");
            if (receiver) {
              transactionObj.receiverDetails = {
                name:
                  receiver.firstName && receiver.lastName
                    ? `${receiver.firstName} ${receiver.lastName}`
                    : receiver.username,
                username: receiver.username,
                email: receiver.email,
                profileImage: receiver.profileImg,
                isAdmin: false,
              };
            } else {
              transactionObj.receiverDetails = {
                name: `User ${transactionObj.receiverId
                  .toString()
                  .substring(0, 8)}...`,
                username: "Unknown User",
                email: "N/A",
                isAdmin: false,
              };
            }
          } catch (error) {
            console.error("Error fetching receiver details:", error);
            transactionObj.receiverDetails = {
              name: `User ${transactionObj.receiverId
                .toString()
                .substring(0, 8)}...`,
              username: "Unknown User",
              email: "N/A",
              isAdmin: false,
            };
          }
        }

        return transactionObj;
      })
    );

    res.status(200).json({
      success: true,
      transactions: populatedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTransactions,
        pages: totalPages,
      },
      message: "Transactions retrieved successfully",
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching transactions",
    });
  }
};
