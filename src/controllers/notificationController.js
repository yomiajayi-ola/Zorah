
import Notification from "../models/Notification.js";

// @desc Get all user notifications
export const getNotifications = async (req, res) => {
    try {
      const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Error fetching notifications" });
    }
  };
  
  // @desc Mark a notification as read
  export const markAsRead = async (req, res) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { read: true },
        { new: true }
      );
      if (!notification) return res.status(404).json({ message: "Not found" });
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Error updating notification" });
    }
  };