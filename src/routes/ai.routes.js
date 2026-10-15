import express from "express";
import { aiAssistant } from "../ai/assistant.js";
import { protect } from "../middlewares/auth.middleware.js";
import { getSmartBudgetTips } from "../ai/budgetTips.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Dedicated AI limiter: max 10 requests/min per user to protect the shared Gemini API key
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === "OPTIONS",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: "failed",
      reply: "Eyaa, I'm a bit overwhelmed with requests right now. 😅 Please give me about a minute to rest and try asking again!",
      intent: "rate-limit-hit"
    });
  }
});

router.post("/ask", protect, aiLimiter, aiAssistant);
router.get("/tips", protect, aiLimiter, getSmartBudgetTips);

export default router;
