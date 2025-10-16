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
    // console.log("⚙️ createNotification() called", { userId, type, title });
  
  // try {
    const user = await User.findById(userId);
    const notification = new Notification.create({
      user: userId,
      type,
      title,
      message,
    });
    await notification.save();

    if (user.expoPushToken) {
      await sendPushNotification(user.expoPushToken, title, message)
    }

    console.log(`📢 Notification for ${type}: ${title}`);
    
    // FIX: Remove or properly await the setTimeout if you really need it
    // await new Promise(res => setTimeout(res, 10));
    
    return notification;
  // } catch (error) {
  //   console.error("Failed to create notification:", error);
  //   throw error; // FIX: Re-throw the error so it bubbles up
  }

