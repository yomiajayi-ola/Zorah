import Budget from "../models/Budget.js";
import { createNotification } from "../services/notificationService.js";

// Helper to calculate total spent in a category
const calculateTotalSpent = async (userId, category, start, end) => {
    
    const Expense = (await import("../models/Expense.js")).default;
    const result = await Expense.aggregate([
        { $match: { 
            user: userId, 
            category, 
            status: "active",
            date: { $gte: start, $lte: end } 
        } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    return result[0]?.total || 0;
};

export const checkBudgetAndNotify = async (userId, category) => {
    try {
        const budget = await Budget.findOne({
            user: userId,
            category: category,
            status: "active"
        });

        if (budget) {
            const totalSpent = await calculateTotalSpent(userId, category, budget.startDate, budget.endDate);
            const percentUsed = (totalSpent / budget.amount) * 100;

            if (percentUsed >= 100) {
                await createNotification({
                    userId,
                    type: "limit_exceeded",
                    title: "Budget Exceeded! 🚨",
                    message: `Your ${category} spending is now at ${percentUsed.toFixed(0)}%.`,
                });
            } else if (percentUsed >= 80) {
                await createNotification({
                    userId,
                    type: "warning",
                    title: "Approaching Limit ⛔️",
                    message: `You've used ${percentUsed.toFixed(0)}% of your ${category} budget.`,
                });
            }
        }
    } catch (error) {
        console.error("Budget Check Error:", error);
    }
};