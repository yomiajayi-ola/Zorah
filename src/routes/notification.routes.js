import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    getNotifications,
    markAsRead,
} from "../controllers/notificationController.js"

const router = express.Router();

router.get("/get-not", protect, getNotifications);
router.patch("/:id/read", protect, markAsRead)

export default router;