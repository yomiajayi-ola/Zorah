
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import fetch from "node-fetch";

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

  // @desc register push notification 
  export const registerPushToken = async (req, res) => {
    try {
      const { expoPushToken } = req.body; 
      const user = await User.findById(req.user._id);
      if(!user) return res.status(404).json({ message: "User not found" });

      user.expoPushToken = expoPushToken;
      await user.save();

      res.json({ message: "Expo push token saved successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }


  // @desc send push notification 
  export const sendTestNotification = async (req, res) => {
    try {
      const { expoPushToken, title, body } = req.body;

      if(!expoPushToken) 
        return res.status(400).json({ message: "Expo Push Token required"});

      const message = {
        to: expoPushToken,
        sound: "default",
        title: title || "Test Notification",
        body: body || "This is a test from Zorah backend🚀",
      };

      const response = await fetch ("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      const data = await response.json();
      res.json({ message: "Notification sent succesfully", data });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };