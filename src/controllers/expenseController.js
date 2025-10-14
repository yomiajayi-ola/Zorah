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

// @desc Get All expenses for user 
export const getExpense = async (req, res) => {
    try {
        const expenses = await Expense.find({ user: req.user.id}).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get Expense summary (total per category)
export const getExpenseSummary = async (req, res) => {
    try {
        const summary = await Expense.aggregate([
            { $match: { user: req.user._id } },
            {
              $group: {
                _id: "$category",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
            { $sort: { total: -1 } },
            {
              $project: {
                _id: 0,
                category: "$_id",
                total: 1,
                count: 1,
              },
            },
          ]);
          

        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// @desc Get daily expense breakdown
export const getDailyExpenses = async (req, res) => {
    try {
        const daily = await Expense.aggregate([
            { $match: { user: req.user._id } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$date" },
                    },
                    total: { $sum: "$amount" },
                }, 
            }, 
            { $sort: { _id: 1 } },
        ]);

        res.json(daily);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};