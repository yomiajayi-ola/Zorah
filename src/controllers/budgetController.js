import Budget from "../models/Budget.js";
import Expense from "../models/Expense.js";

// @desc create or update a budget 
export const setBudget = async (req, res) => {
    try {
        const { category, amount, period, startDate, endDate } = req.body;

        let budget = await Budget.findOne({
            user: req.user._id,
            category,
            period
        });

        if (budget) {
            budget.amount = amount;
            budget.startDate = startDate;
            budget.endDate = endDate;
            await budget.save();
            return res.json ({ message: "Budget updated succesfully", budget });
        }

        budget = await Budget.create({
            user: req.user._id,
            category,
            amount,
            period,
            startDate,
            endDate,
        });

        res.status(201).json({ message: "Budget created succesfully", budget });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

