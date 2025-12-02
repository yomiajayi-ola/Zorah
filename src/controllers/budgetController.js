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
// @desc Fetch current budgets & show balance left 
export const getBudgets = async (req, res) => {

  try {

    // --- Prepare Query ---
    console.log("RAW QUERY:", req.query);
    
    const isMonthsOnlyRequest = !!req.query.monthsOnly;
    
    // Destructure filtering parameters early
    const { month, year, period, status } = req.query; // ✅ Add status to destructuring

    const query = { user: req.user._id };
    
    // ====== 1️⃣ RETURN ONLY MONTHS AVAILABLE (No Status Filter Applied Here) ======
    if (isMonthsOnlyRequest) {
      console.log("EXECUTING: UNIQUE MONTHS LOGIC");
      
      const budgets = await Budget.find(query)
        .select("month year -_id")
        .sort({ year: 1, month: 1 });

      // ... (rest of uniqueMonths logic) ...
      return res.status(200).json({ months: uniqueMonths });
    }

    // --- Build Filtering Query (If not monthsOnly) ---
    console.log("EXECUTING: BUDGET BREAKDOWN LOGIC");
    
    // If month, year, or period are provided, add them to the query object
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (period) query.period = period.toString().trim().toLowerCase(); 

    // =========================================================
    // ✅ FIX 1: DEFAULT STATUS FILTER
    // Only return 'active' budgets unless 'status' is explicitly provided in the URL query.
    // =========================================================
    if (status) {
        query.status = status.toString().trim().toLowerCase();
    } else {
        // This is the default behavior you want: Hide archived budgets
        query.status = "active";
    }
    // =========================================================

    // ====== FETCH FILTERED BUDGETS (OR ALL ACTIVE) ======
    const budgets = await Budget.find(query);

    // ====== 3️⃣ BREAKDOWN CALCULATION & FULL PAYLOAD MERGE ======
    const data = await Promise.all(
      budgets.map(async (budget) => {
        
        // Convert the Mongoose document to a plain JavaScript object
        const budgetObject = budget.toObject(); 

        // 🎯 FIX 2: Rename the DB status to 'archiveStatus' before calculating the spending status.
        const archiveStatus = budgetObject.status;
        delete budgetObject.status; // Prevent the calculated status from overwriting the DB status
        
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
        
        // 💡 CRITICAL CHANGE: Return the new fields
        return {
          ...budgetObject, 
          Limit: budget.amount, 
          archiveStatus: archiveStatus, // <-- NEW: Shows 'active' or 'archived' from DB
          totalSpent,
          remaining,
          percentageused: `${percentageused}%`,
          spendingStatus: // <-- NEW FIELD NAME for the calculated status
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


// @route GET /api/budgets/archived
// @access Private
export const getArchivedBudgets = async (req, res) => {
    try {
        const archivedBudgets = await Budget.find({ 
            user: req.user._id,
            status: "archived" // Filters by the archived status
        });
        
        if (archivedBudgets.length === 0) {
            // Optional: return a 200 with an empty array if nothing is found
            return res.status(200).json({ message: "No archived budgets found.", budgets: [] });
        }

        res.json(archivedBudgets);
    } catch (error) {
        console.error("Error in getArchivedBudgets:", error);
        res.status(500).json({ message: error.message });
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
  