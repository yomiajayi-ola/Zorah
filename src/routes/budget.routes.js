import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { getBudgets, setBudget } from "../controllers/budgetController.js";

const router = express.Router();

router.post("/set-budget", protect, setBudget);
router.get("/get-budgets", protect, getBudgets)

export default router;