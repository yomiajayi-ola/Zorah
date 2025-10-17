import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    getNotifications,
    markAsRead,
    registerPushToken,
    sendTestNotification,
} from "../controllers/notificationController.js"

const router = express.Router();

router.get("/get-not", protect, getNotifications);
router.patch("/:id/read", protect, markAsRead)
router.post("/register-token", protect, registerPushToken);
router.post("/test", sendTestNotification);

export default router;