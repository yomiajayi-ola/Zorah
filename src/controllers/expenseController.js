import Expense from "../models/Expense.js";

// @desc Add new expense 
export const addExpense = async (req, res) => {
    try {
        const { amount, category, description, paymentMethod, date } = req.body;

        // Amount
        if (!amount) return res.status(400).json({ message: "Amount is required" });

        const expense = await Expense.create({
            user: req.user.id,
            amount,
            category,
            description,
            paymentMethod,
            date,
        });

        res.status(201).json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};