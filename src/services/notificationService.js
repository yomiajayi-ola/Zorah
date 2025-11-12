import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendPushNotification } from "./pushService.js";

/**
 * Creates a new notification for a user
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} options.type - 'budget' | 'expense' | 'system'
 * @param {string} options.title
 * @param {string} options.message
 */

export const createNotification = async ({ userId, type, title, message }) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
    });

    if (user.expoPushToken) {
      await sendPushNotification(user.expoPushToken, title, message);
    }

    return notification;
  } catch (error) {
    console.error("❌ Failed to create notification:", error.message);
    throw error;
  }
};


