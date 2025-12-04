import express from "express";
import { aiAssistant } from "../ai/assistant.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/ask", protect, aiAssistant);

export default router;
