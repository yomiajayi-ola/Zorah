import Transactions from "../models/Transaction.js";
import Budgets from "../models/Budget.js";
import Savings from "../models/SavingsGoal.js";
import Income from "../models/Income.js";

export async function getFinancialData(intent, userId) {
    let financialData = {};
    const threeMonthsAgo = new Date();
    // Calculate the date 3 months ago 
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Filter criteria for time-series data
    const dateFilter = { createdAt: { $gte: threeMonthsAgo } };

    if (intent === "spending-summary") {
        // ✅ FIX: Only fetch the last 3 months of transactions, max 100
        financialData.transactions = await Transactions.find({ 
            user: userId,
            ...dateFilter 
        })
        .sort({ createdAt: -1 }) // Get most recent first
        .limit(100); 
    }

    if (intent === "budget-analysis") {
        financialData.budgets = await Budgets.find({ user: userId }); 
        // Note: Budgets are usually few, so no date filter needed unless they are time-series
    }

    if (intent === "savings-goal") {
        financialData.savings = await Savings.find({ user: userId });
    }

    if (intent === "income-summary") {
        // ✅ FIX: Filter income by date, max 50 records
        financialData.income = await Income.find({ 
            user: userId,
            ...dateFilter 
        })
        .limit(50);
    }

    return financialData;
}