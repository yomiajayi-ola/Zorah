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
            budgets.map(async (budget) => {
                const spent = await Expense.aggregate([
                    {
                        $match: {
                            user: req.user._id,
                            category: budget.category,
                            date: { $gte: budget.startDate, $lte: budget.endDate },
                        },
                    },
                    { $group: { _id: null, total: { $sum: "$amount" } } },
                ]);

                const totalSpent = spent[0]?.total || 0;
                const remaining = budget.amount - totalSpent;
                const percentageused = ((totalSpent / budget.amount) * 100).toFixed(2);

                return {
                    _id: budget._id,               // 🚀 ADD ID HERE
                    category: budget.category,
                    Limit: budget.amount,
                    totalSpent,
                    remaining,
                    percentageused: `${percentageused}%`,
                    status: 
                        remaining <= 0
                        ? "over budget 🚨"
                        : remaining < budget.amount * 0.1
                        ? "Almost reached ⛔️"
                        : "On track ✅",
                };
            })
        );

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getBudgetById = async (req, res) => {
    try {
      const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id
      }).populate("categories");
  
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
  
      res.status(200).json({ budget });
    } catch (error) {
      res.status(500).json({ message: "Error fetching budget", error: error.message });
    }
  };
  


  export const updateBudget = async (req, res) => {
    try {
        const budgetId = req.params.id;
        const userId = req.user._id;

        const budget = await Budget.findOne({ _id: budgetId, user: userId });
        if (!budget) {
            return res.status(404).json({ message: "Budget not found" });
        }

        const { category, amount, period, startDate, endDate } = req.body;

        if (category) budget.category = category;
        if (period) budget.period = period;
        if (startDate) budget.startDate = startDate;
        if (endDate) budget.endDate = endDate;

        // Recalculate month/year if startDate was provided
        if (startDate) {
            const d = new Date(startDate);
            budget.month = d.getMonth() + 1;
            budget.year = d.getFullYear();
        }

        if (amount) {
            budget.amount = amount;
            
            // Recalculate remaining in case amount changed
            const totalSpent = budget.spent || 0;
            budget.remaining = amount - totalSpent;
        }

        await budget.save();

        return res.status(200).json({
            message: "Budget updated successfully",
            budget
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating budget", error: error.message });
    }
};


  
  export const archiveBudget = async (req, res) => {
    try {
      const budgetId = req.params.id;
      const userId = req.user._id;
  
      const budget = await Budget.findOne({ _id: budgetId, user: userId });
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
  
      budget.status = "archived";
      await budget.save();
  
      return res.status(200).json({
        message: "Budget archived successfully",
        budget
      });
    } catch (error) {
      res.status(500).json({ message: "Error archiving budget", error: error.message });
    }
  };

  
  export const restoreBudget = async (req, res) => {
    try {
      const budgetId = req.params.id;
      const userId = req.user._id;
  
      const budget = await Budget.findOne({ _id: budgetId, user: userId });
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
  
      budget.status = "active";
      await budget.save();
  
      return res.status(200).json({
        message: "Budget restored successfully",
        budget
      });
    } catch (error) {
      res.status(500).json({ message: "Error restoring budget", error: error.message });
    }
  };

  
  export const deleteBudgetPermanently = async (req, res) => {
    try {
      const budgetId = req.params.id;
      const userId = req.user._id;
  
      const budget = await Budget.findOneAndDelete({ _id: budgetId, user: userId });
  
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
  
      return res.status(200).json({ message: "Budget deleted permanently" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting budget", error: error.message });
    }
  };
  