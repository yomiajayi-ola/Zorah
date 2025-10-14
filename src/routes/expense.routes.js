import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    addExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

router.post("/add-expense", protect, addExpense);

export default router;