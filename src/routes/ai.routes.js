import express from "express";
import { aiAssistant } from "../ai/assistant.js";
import { protect } from "../middlewares/auth.middleware.js";
import { getSmartBudgetTips } from "../ai/budgetTips.js";

const router = express.Router();

router.post("/ask", protect, aiAssistant);
router.get("/tips", protect, getSmartBudgetTips);


export default router;
