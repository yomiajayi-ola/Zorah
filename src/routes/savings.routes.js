import express from "express";
import { addContribution, createGoal, getGoals, getGoalById, updateGoal, archiveGoal, restoreGoal, deleteGoalPermanently } from "../controllers/savingsController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createGoal);
router.post("/contribute", protect, addContribution);
router.get("/get-goals", protect, getGoals);
router.get("/:id", protect, getGoalById);
router.put("/:id", protect, updateGoal);
router.patch("/:id/archive", protect, archiveGoal);
router.patch("/:id/restore", protect, restoreGoal);
router.delete("/:id", protect, deleteGoalPermanently);



export default router;