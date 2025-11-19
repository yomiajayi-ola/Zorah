import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    addExpense,
    getDailyExpenses,
    getExpense,
    getExpenseSummary,
    getMonthlyExpenses,
    getExpenseById,
    updateExpense,
    archiveExpense,
    restoreExpense,
    deleteExpensePermanently
} from "../controllers/expenseController.js";

const router = express.Router();

router.post("/add-expense", protect, addExpense);
router.get("/get-expense", protect, getExpense);
router.get("/summary", protect, getExpenseSummary);
router.get("/daily", protect, getDailyExpenses);
router.get("/monthly", protect, getMonthlyExpenses);
router.get("/:id", protect, getExpenseById);
router.put("/:id", protect, updateExpense);
router.patch("/:id/archive", protect, archiveExpense);
router.patch("/:id/restore", protect, restoreExpense);
router.delete("/:id", protect, deleteExpensePermanently);


export default router;