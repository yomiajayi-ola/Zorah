import Budget from "../models/Budget.js";
import Expense from "../models/Expense.js";

// @desc create or update a budget 
export const setBudget = async (req, res) => {
    try {
        const { category, amount, period, startDate, endDate } = req.body;

        // ADD THIS: Calculate month and year from startDate
        const start = new Date(startDate);
        const month = start.getMonth() + 1;
        const year = start.getFullYear();

        let budget = await Budget.findOne({
            user: req.user._id,
            category,
            period,
            month,  // Add month to the query
            year    // Add year to the query
        });

        if (budget) {
            budget.amount = amount;
            budget.startDate = startDate;
            budget.endDate = endDate;
            budget.month = month;    // Update month
            budget.year = year;      // Update year
            await budget.save();
            return res.json({ message: "Budget updated successfully", budget });
        }

        budget = await Budget.create({
            user: req.user._id,
            category,
            amount,
            period,
            startDate,
            endDate,
            month,    // ADD THIS
            year      // ADD THIS
        });

        res.status(201).json({ message: "Budget created successfully", budget });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Fetch current budgets & show balance left 
export const getBudgets = async (req, res) => {
    try {
        const budgets = await Budget.find({ user: req.user._id });

        const data = await Promise.all(
            budgets.map(async (budgets) => {
                const spent = await Expense.aggregate([
                    {
                        $match: {
                            user: req.user._id,
                            category: budgets.category,
                            date: { $gte: budgets.startDate, $lte: budgets.endDate },
                        },
                    },
                    { $group: { _id: null, total: { $sum: "$amount" } } },
                ]);

                const totalSpent = spent[0]?.total || 0;
                const remaining = budgets.amount - totalSpent;
                const percentageused = ((totalSpent / budgets.amount) * 100).toFixed(2);

                return {
                    category: budgets.category,
                    Limit: budgets.amount,
                    totalSpent,
                    remaining,
                    percentageused: `${percentageused}%`,
                    status: 
                    remaining <= 0
                    ? "over budget 🚨"
                    : remaining < budgets.amount * 0.1
                    ? "Almost reached ⛔️"
                    : "On track ✅",
                }
            })
        );

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}