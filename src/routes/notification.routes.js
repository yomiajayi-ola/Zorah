import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    getNotifications,
} from "../controllers/notificationController.js"

const router = express.Router();

router.get("/get-not", protect, getNotifications);

export default router;