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

    const { amount, category, date, description, paymentMethod } = req.body;

    const expense = new Expense({
      user: userId,
      amount,
      category,
      date: date || new Date(),
      description,
      paymentMethod,
      status: "active" 
    });
    
    await expense.save();

    if (user.incrementUsage) {
        await user.incrementUsage('expense');
    }

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get All expenses for user 
export const getExpense = async (req, res) => {
  try {
    const isMonthsOnlyRequest = !!req.query.monthsOnly;
    const { month, year, category, status } = req.query;
    const userId = req.user._id;

    // 1. Initial Match Stage
    const matchQuery = { user: userId };
    
    // Status Filter (Default to active)
    matchQuery.status = status ? status.toString().trim().toLowerCase() : "active";

    // Category Filter (Optional)
    if (category) matchQuery.category = category.toString().trim();

    // 2. Handle "Months Only" Request
    if (isMonthsOnlyRequest) {
      const uniqueMonths = await Expense.aggregate([
        { $match: matchQuery },
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

    // 3. Date Filtering (If month/year provided)
    if (month && year) {
      const m = Number(month);
      const y = Number(year);
      matchQuery.date = {
        $gte: new Date(y, m - 1, 1),
        $lte: new Date(y, m, 0, 23, 59, 59, 999)
      };
    }

    // 4. Main Data Aggregation
    const expenses = await Expense.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "categories",
          let: { expenseCat: "$category" },
          pipeline: [
            { $unwind: "$subcategories" },
            {
              $match: {
                $expr: {
                  $or: [
                    // Match if it's the Name (e.g., "Vacation")
                    { $eq: ["$subcategories.name", "$$expenseCat"] },
                    // Match if it's a valid ID (Regex prevents crashing on non-hex strings)
                    {
                      $and: [
                        { $regexMatch: { input: { $ifNull: ["$$expenseCat", ""] }, regex: /^[0-9a-fA-F]{24}$/ } },
                        { $eq: ["$subcategories._id", { $toObjectId: "$$expenseCat" }] }
                      ]
                    }
                  ]
                }
              }
            },
            { $project: { _id: 0, name: "$subcategories.name" } }
          ],
          as: "categoryDetails"
        }
      },
      {
        $project: {
          amount: 1,
          description: 1,
          paymentMethod: 1,
          date: 1,
          status: 1,
          createdAt: 1,
          // Extract the name or fallback to the raw category string
          category: {
            $ifNull: [
              { $arrayElemAt: ["$categoryDetails.name", 0] },
              "$category"
            ]
          },
          month: { $month: "$date" },
          year: { $year: "$date" }
        }
      },
      { $sort: { date: -1 } }
    ]);

    return res.json({
      data: expenses,
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
          // 1. Security & Scope
          { $match: { user: req.user._id, status: "active" } },

          // 2. Group by the subcategory ID first
          {
              $group: {
                  _id: "$category", // This is the ID of the subcategory
                  total: { $sum: "$amount" },
                  count: { $sum: 1 },
              },
          },

          // 3. JOIN with Categories (The container)
          {
            $lookup: {
                from: "categories", // 🚩 Ensure this is lowercase plural if that's your DB name
                pipeline: [
                    { $unwind: "$subcategories" },
                    { $project: { name: "$subcategories.name", subId: "$subcategories._id" } }
                ],
                as: "foundCategory"
            }
        },

          // 4. Match the specific subcategory name
          {
              $project: {
                  total: 1,
                  count: 1,
                  categoryName: {
                      $arrayElemAt: [
                          {
                              $map: {
                                  input: {
                                      $filter: {
                                          input: "$foundCategory",
                                          as: "cat",
                                          cond: { $eq: ["$$cat.subId", "$_id"] }
                                      }
                                  },
                                  as: "match",
                                  in: "$$match.name"
                              }
                          },
                          0
                      ]
                  }
              }
          },

          // 5. Final Formatting
          {
              $project: {
                  _id: 0,
                  category: { $ifNull: ["$categoryName", "Uncategorized"] },
                  total: 1,
                  count: 1
              }
          },
          { $sort: { total: -1 } }
      ]);

      res.json(summary);
  } catch (error) {
      console.error("Summary Error:", error);
      res.status(500).json({ message: error.message });
  }
};


// @desc Get daily expense breakdown
export const getDailyExpenses = async (req, res) => {
  try {
      const daily = await Expense.aggregate([
          // 🚩 FIX: Prevent seeing other users' daily data
          { $match: { user: req.user._id, status: "active" } },
          {
              $group: {
                  _id: {
                      day: { $dayOfMonth: "$date" },
                      month: { $month: "$date" },
                      year: { $year: "$date" },
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
          // 🚩 FIX: Only pull data for THIS user
          { $match: { user: req.user._id, status: "active" } },
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

    // ... (Your existing group/sort stage logic stays the same) ...

    // 3. Calculate "Comparison to Last Month" Percentage with Zero-Base Guard
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
    let comparisonMessage = "";

    // 🛡️ THE ZERO-BASE GUARD
    if (prevMonthTotal === 0 && thisMonthTotal > 0) {
        diffPercent = 100; // It's technically a 100% increase from nothing
        comparisonMessage = "First month of tracking!";
    } else if (prevMonthTotal === 0 && thisMonthTotal === 0) {
        diffPercent = 0;
        comparisonMessage = "No spending recorded yet.";
    } else {
        diffPercent = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
        comparisonMessage = `${diffPercent.toFixed(1)}% ${diffPercent >= 0 ? 'more' : 'less'} than last month`;
    }

    res.json({
      timeframe,
      comparison: {
        percentage: diffPercent.toFixed(1),
        isIncrease: diffPercent >= 0,
        message: comparisonMessage // Extra context for the Frontend
      },
      chartData
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};