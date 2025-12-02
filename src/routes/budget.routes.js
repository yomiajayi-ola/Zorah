import express from "express";
import { protect } from "../middlewares/auth.middleware.js";

import {
  setBudget,
  getBudgets,
  // getBudgetMonths,
  getBudgetById,
  updateBudget,
  archiveBudget,
  restoreBudget,
  deleteBudgetPermanently,
  getArchivedBudgets,
} from "../controllers/budgetController.js";

const router = express.Router();

// Create a new budget
router.post("/", protect, setBudget);

// Get all active budgets
router.get("/get-budgets", protect, getBudgets)

// Get Archived budget
router.get("/archived", protect, getArchivedBudgets);

// Get all active budgets with monhts
// router.get("/get-budgets-months", protect, getBudgetMonths)

// Get single budget
router.get("/:id", protect, getBudgetById);

// Update/Edit budget
router.patch("/:id", protect, updateBudget);

// Archive budget (soft delete)
router.patch("/:id/archive", protect, archiveBudget);

// Restore archived budget
router.patch("/:id/restore", protect, restoreBudget);

// Permanently delete budget
router.delete("/:id", protect, deleteBudgetPermanently);

export default router;
