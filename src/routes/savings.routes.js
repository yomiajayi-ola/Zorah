import express from "express";
import { addContribution, createGoal, getGoals } from "../controllers/savingsController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createGoal);
router.post("/contribute", protect, addContribution);
router.get("/get-goals", protect, getGoals);


export default router;