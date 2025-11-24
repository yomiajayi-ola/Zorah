import Budget from "../models/Budget.js";
import Expense from "../models/Expense.js";

// @desc create or update a budget 
export const setBudget = async (req, res) => {
  try {
    const { category, amount, period, startDate, endDate } = req.body;

    const start = new Date(startDate);
    const month = start.getMonth() + 1; // 1-12
    const year = start.getFullYear();

    let budget = await Budget.findOne({
      user: req.user._id,
      category,
      month,
      year
    });

    if (budget) {
      budget.amount = amount;
      budget.period = period || budget.period;
      budget.startDate = startDate || budget.startDate;
      budget.endDate = endDate || budget.endDate;

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
      month,   // ✅ make sure month/year are saved
      year
    });

    res.status(201).json({ message: "Budget created successfully", budget });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc Fetch current budgets & show balance left 
export const getBudgets = async (req, res) => {

  try {

    // --- Prepare Query ---
    console.log("RAW QUERY:", req.query);
    
    // 💡 NEW: Check if the 'monthsOnly' property exists in the query object at all.
    // This is more resilient than checking for a specific string/boolean value.
    const isMonthsOnlyRequest = !!req.query.monthsOnly;
    
    // Destructure filtering parameters early
    const { month, year, period } = req.query; 

    const query = { user: req.user._id };
    
    // ====== 1️⃣ RETURN ONLY MONTHS AVAILABLE ======
    if (isMonthsOnlyRequest) {
      console.log("EXECUTING: UNIQUE MONTHS LOGIC");
      
      // We don't apply month/year/period filters here, as we want ALL periods.
      const budgets = await Budget.find(query)
        .select("month year -_id")
        .sort({ year: 1, month: 1 });

      // Create unique list of month/year combinations
      const uniqueMonths = Array.from(
        new Map(
          budgets.map(b => [`${b.year}-${b.month}`, b])
        ).values()
      ).map(b => ({ month: b.month, year: b.year })); // Clean the output structure

      // 🛑 Return the unique months and STOP
      return res.status(200).json({ months: uniqueMonths });
    }

    // --- Build Filtering Query (If not monthsOnly) ---
    // --- Build Filtering Query (If not monthsOnly) ---
    console.log("EXECUTING: BUDGET BREAKDOWN LOGIC");
    
    // If month, year, or period are provided, add them to the query object
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    // Normalize and add the period filter
    if (period) query.period = period.toString().trim().toLowerCase(); 

    // ====== FETCH FILTERED BUDGETS (OR ALL) ======
    const budgets = await Budget.find(query);

    // ====== 3️⃣ BREAKDOWN CALCULATION & FULL PAYLOAD MERGE ======
    const data = await Promise.all(
      budgets.map(async (budget) => {
        
        // Convert the Mongoose document to a plain JavaScript object
        const budgetObject = budget.toObject(); 

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
        
        // 💡 CRITICAL CHANGE: Merge original budget fields and calculated fields
        return {
          ...budgetObject, // Include ALL original fields (month, year, startDate, etc.)
          Limit: budget.amount, // Rename 'amount' to 'Limit' for consistency
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
    
    // 🛑 Return the budget breakdown data along with the active month/year filter
    return res.json({
        data,
        month: month ? Number(month) : null,
        year: year ? Number(year) : null
    });

  } catch (error) {
    console.error("Error in getBudgets:", error);
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
  