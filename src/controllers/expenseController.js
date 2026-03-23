import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";
import User from "../models/User.js";

// @desc    Add new expense
// @route   POST /api/expenses
// @access  Private

// Add Expense
export const addExpense = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    // 🛡️ GUARD: Limit to 5 entries for non-wallet users
    // if (!user.walletId && user.usageMetrics.expensesLoggedCount >= 5) {
    //         return res.status(403).json({
    //     status: "failed",
    //     hasReachedLimit: true, // Frontend triggers Wallet Modal
    //     message: "You've reached the limit for manual expenses. Create a Zorah Wallet to unlock unlimited tracking!"
    //   });
    // }`
    const { amount, category, date, description, paymentMethod } = req.body;

    const expense = new Expense({
      user: userId,
      amount,
      category,
      date: date || new Date(),
      description,
      paymentMethod
    });
    
    await expense.save();

    // 📈 INCREMENT: Track usage
    await user.incrementUsage('expense');

    // ... (Your existing Budget Alert Logic) ...

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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

// @desc Get Spending Overview for Charts (Daily, Weekly, Monthly)
// @route GET /api/expenses/spending-overview?timeframe=weekly
export const getSpendingOverview = async (req, res) => {
  try {
    const { timeframe = 'daily' } = req.query;
    const userId = req.user._id;

    let groupStage;
    let sortStage = { "_id.year": 1, "_id.period": 1 };

    // 1. Define grouping based on Figma chart logic
    if (timeframe === 'daily') {
        groupStage = {
            day: { $dayOfMonth: "$date" },
            month: { $month: "$date" },
            year: { $year: "$date" }
        };
        sortStage = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
    } else if (timeframe === 'weekly') {
        groupStage = {
            week: { $week: "$date" }, // Weeks 0-53
            year: { $year: "$date" }
        };
    } else { // Monthly
        groupStage = {
            month: { $month: "$date" },
            year: { $year: "$date" }
        };
    }

    // 2. Aggregate spending data
    const chartData = await Expense.aggregate([
      { $match: { user: userId, status: "active" } },
      {
        $group: {
          _id: groupStage,
          totalAmount: { $sum: "$amount" }
        }
      },
      { $sort: sortStage }
    ]);

    // 3. Calculate "Comparison to Last Month" Percentage (+7.1%)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const stats = await Expense.aggregate([
      { $match: { user: userId, status: "active" } },
      {
        $group: {
          _id: { month: { $month: "$date" }, year: { $year: "$date" } },
          monthlyTotal: { $sum: "$amount" }
        }
      }
    ]);

    const thisMonthTotal = stats.find(s => s._id.month === currentMonth && s._id.year === currentYear)?.monthlyTotal || 0;
    const prevMonthTotal = stats.find(s => s._id.month === lastMonth && s._id.year === lastMonthYear)?.monthlyTotal || 0;

    let diffPercent = 0;
    if (prevMonthTotal > 0) {
        diffPercent = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
    }

    res.json({
      timeframe,
      comparison: {
        percentage: diffPercent.toFixed(1),
        isIncrease: diffPercent >= 0
      },
      chartData
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};