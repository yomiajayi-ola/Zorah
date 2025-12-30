import Notification from "../models/Notification.js";
import User from "../models/User.js";
import admin from "../config/firebase.js"; // Your Firebase Admin initialization

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

// @desc Register FCM push notification token
export const registerPushToken = async (req, res) => {
    try {
      const { fcmToken } = req.body; // Expect fcmToken from mobile client
      if (!fcmToken) return res.status(400).json({ message: "FCM token required" });
  
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: "User not found" });
  
      // Initialize fcmTokens array if it doesn't exist
      if (!user.fcmTokens) user.fcmTokens = [];

      // Store tokens in an array to support multiple devices
      if (!user.fcmTokens.includes(fcmToken)) {
        user.fcmTokens.push(fcmToken);
        await user.save();
      }
  
      res.json({ message: "FCM device token registered successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

// @desc Send manual test notification using Firebase Admin SDK
export const sendTestNotification = async (req, res) => {
    try {
      const { fcmToken, title, body } = req.body;

      if (!fcmToken) 
        return res.status(400).json({ message: "FCM Token required" });

      // Construct the FCM message payload
      const message = {
        notification: {
          title: title || "Test Notification 🚀",
          body: body || "Your Firebase integration for Zorah is live!",
        },
        token: fcmToken,
      };

      // Send via Firebase Admin SDK
      const response = await admin.messaging().send(message);

      res.json({ 
        message: "Notification sent successfully", 
        messageId: response 
      });
    } catch (error) {
      console.error("FCM Send Error:", error.message);
      res.status(500).json({ message: error.message });
    }
};