import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";

// @desc    Add new expense
// @route   POST /api/expenses
// @access  Private

export const addExpense = async (req, res) => {
  try {
    const { amount, category, description, paymentMethod, date } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const expense = await Expense.create({
      user: req.user._id,
      amount,
      category,
      description,
      paymentMethod,
      date,
    });

    const expenseDate = new Date(date);
    const expenseMonth = expenseDate.getMonth() + 1;
    const expenseYear = expenseDate.getFullYear();

    const budget = await Budget.findOne({
      user: req.user._id,
      category: expense.category,
      $or: [
        { month: expenseMonth, year: expenseYear },
        { 
          startDate: { $lte: expenseDate },
          endDate: { $gte: expenseDate }
        }
      ]
    });

    if (!budget) {
      return res.status(201).json(expense);
    }

    const totalSpent = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          category: expense.category,
          $expr: {
            $and: [
              { $eq: [{ $month: "$date" }, expenseMonth] },
              { $eq: [{ $year: "$date" }, expenseYear] },
            ],
          },
        },
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$amount" } 
        } 
      },
    ]);

    const spent = totalSpent[0]?.total || 0;
    const percent = (spent / budget.amount) * 100;

    if (percent >= 80 && percent < 100) {
      await createNotification({
        userId: req.user._id,
        type: "budget",
        title: "Budget nearing limit",
        message: `You've spent ${percent.toFixed(1)}% of your ${category} budget.`,
      });
    } else if (percent >= 100) {
      await createNotification({
        userId: req.user._id,
        type: "budget",
        title: "Budget exceeded", 
        message: `You've exceeded your ${category} budget!`,
      });
    }

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
                        day: { $dayOfMonth: "$date" },
                        month: { $month: "$date" },
                        year: { $year: "$date" },
                        // $dateToString: { format: "%Y-%m-%d", date: "$date" },
                    },
                    total: { $sum: "$amount" },
                }, 
            }, 
            { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
        ]);

        res.json(daily);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get monthly expense breakdown
export const getMonthlyExpenses = async (req, res) => {
    try {
        const monthlySummary = await Expense.aggregate([
            {
                $group: {
                    _id: {
                        month: { $month: "$date" },
                        year: { $year: "$date" },
                    },
                    total: { $sum: "$amount" },
                },
            },
            { $sort: { "_id.year": -1, "_id.month": -1} },
        ]);
        res.json(monthlySummary);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const { amount, category, description, paymentMethod, date } = req.body;

    if (amount !== undefined) expense.amount = amount;
    if (category) expense.category = category;
    if (description) expense.description = description;
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (date) expense.date = date;

    await expense.save();

    res.json({ message: "Expense updated successfully", expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const archiveExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    expense.status = "archived";
    expense.archivedAt = new Date();
    await expense.save();

    res.json({ message: "Expense archived successfully", expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const restoreExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    expense.status = "active";
    expense.archivedAt = null;

    await expense.save();

    res.json({ message: "Expense restored successfully", expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteExpensePermanently = async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deleted)
      return res.status(404).json({ message: "Expense not found" });

    res.json({ message: "Expense deleted permanently" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

