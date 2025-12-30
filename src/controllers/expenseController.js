import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";

// @desc    Add new expense
// @route   POST /api/expenses
// @access  Private

// In expenseController.js
export const addExpense = async (req, res) => {
  try {
    const { amount, category, date } = req.body;
    // ... existing expense creation logic ...

    // 1. Calculate Budget vs Actual (Real-time comparison)
    const budget = await Budget.findOne({
      user: req.user._id,
      category: category,
      status: "active"
    });

    if (budget) {
      const totalSpent = await calculateTotalSpent(req.user._id, category, budget.startDate, budget.endDate);
      const percentUsed = (totalSpent / budget.amount) * 100;

      // 2. Trigger Notification based on Figma logic (80% and 100%)
      if (percentUsed >= 100) {
        await createNotification({
          userId: req.user._id,
          type: "limit_exceeded",
          title: "Budget Exceeded! 🚨",
          message: `Your ${category} spending is now at ${percentUsed.toFixed(0)}%.`,
        });
        // Optional: Emit websocket event for "Instant Red"
        // io.to(req.user._id).emit('budget_alert', { category, status: 'over' });
      } else if (percentUsed >= 80) {
        await createNotification({
          userId: req.user._id,
          type: "warning",
          title: "Approaching Limit ⛔️",
          message: `You've used ${percentUsed.toFixed(0)}% of your ${category} budget.`,
        });
      }
    }

    res.status(201).json(expense);
  } catch (error) { /* error handling */ }
};

// @desc Get All expenses for user 
export const getExpense = async (req, res) => {
  try {
      // --- Prepare Query ---
      const isMonthsOnlyRequest = !!req.query.monthsOnly;
      const { month, year, category, status } = req.query; 
      
      const userId = req.user._id; 
      const query = { user: userId };
      
      // ====== 1️⃣ RETURN ONLY MONTHS AVAILABLE (monthsOnly=true) ======
      if (isMonthsOnlyRequest) {
          
          const uniqueMonths = await Expense.aggregate([
              { $match: query }, // Filter by user ID
              {
                  $group: {
                      _id: {
                          month: { $month: "$date" },
                          year: { $year: "$date" }
                      }
                  }
              },
              {
                  $project: {
                      _id: 0,
                      month: "$_id.month",
                      year: "$_id.year"
                  }
              },
              { $sort: { year: 1, month: 1 } }
          ]);

          return res.status(200).json({ months: uniqueMonths });
      }

      // --- Build Filtering Query (If not monthsOnly) ---
      
      // A. Filter by status (Default to 'active')
      if (status) {
          query.status = status.toString().trim().toLowerCase();
      } else {
          // Default behavior: only show active expenses
          query.status = "active"; 
      }

      // B. Filter by month and year (Requires calculating date range)
      if (month && year) {
          const m = Number(month);
          const y = Number(year);
          
          // Start of the month (e.g., 2026-01-01T00:00:00.000Z)
          const startOfMonth = new Date(y, m - 1, 1);
          
          // End of the month (Day 0 of the next month)
          const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999); 
          
          query.date = {
              $gte: startOfMonth,
              $lte: endOfMonth
          };
      } else if (month || year) {
          // Error handling if only one is provided
          return res.status(400).json({ message: "Must provide both month and year for date filtering." });
      }

      // C. Filter by category
      if (category) {
          query.category = category.toString().trim();
      }

      // ====== FETCH FILTERED EXPENSES ======
      const expenses = await Expense.find(query)
                                  .sort({ date: -1 }); // Sort by date descending

      // ====== 3️⃣ DATA MAPPING AND STRUCTURE ADJUSTMENT (NEW LOGIC) ======
      const data = expenses.map((expense) => {
          
          // Convert Mongoose document to a plain object
          const expenseObject = expense.toObject(); 

          // Calculate month and year from the date field
          const d = expense.date; 
          const expenseMonth = d.getMonth() + 1; // getMonth() returns 0-11, so +1
          const expenseYear = d.getFullYear();

          // Return the new structured object with month/year added
          return {
              ...expenseObject, 
              month: expenseMonth,
              year: expenseYear,
          };
      });


      // 🛑 Return the expenses data
      return res.json({
          data: data, 
          month: month ? Number(month) : null,
          year: year ? Number(year) : null
      });

  } catch (error) {
      console.error("Error in getExpense:", error);
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

