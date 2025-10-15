import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { setBudget } from "../controllers/budgetController.js";

const router = express.Router();

router.post("/set-budget", protect, setBudget);

export default router;