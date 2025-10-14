import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    addExpense,
    getDailyExpenses,
    getExpense,
    getExpenseSummary,
} from "../controllers/expenseController.js";

const router = express.Router();

router.post("/add-expense", protect, addExpense);
router.get("/get-expense", protect, getExpense);
router.get("/summary", protect, getExpenseSummary);
router.get("/daily", protect, getDailyExpenses);


export default router;