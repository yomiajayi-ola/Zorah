import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { voiceExpenseLogger } from "../ai/voice.js";

const router = express.Router();

router.post("/log-expense", protect, voiceExpenseLogger);

export default router;
