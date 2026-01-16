import Transactions from "../models/Transaction.js";
import Budgets from "../models/Budget.js";
import Savings from "../models/SavingsGoal.js";
import Income from "../models/Income.js";

export async function getFinancialData(intent, userId) {
    let financialData = {};

    // 1. Fetch ALL Income (No date filter)
    financialData.income = await Income.find({ user: userId })
        .sort({ date: -1 });

    // 2. Fetch ALL Budgets
    financialData.budgets = await Budgets.find({ user: userId }); 

    // 3. Fetch ALL Savings Goals
    financialData.savings = await Savings.find({ user: userId });

    // 4. Fetch ALL Transactions/Expenses (No date filter)
    // Note: Use your actual Expense model if Transactions is different
    financialData.transactions = await Transactions.find({ user: userId })
        .sort({ date: -1 }) 
        .limit(100); 

    // Log what was found to your VS Code terminal
    // console.log(`--- DEBUG DATA FOR USER ${userId} ---`);
    // console.log(`Income found: ${financialData.income.length}`);
    // console.log(`Expenses found: ${financialData.transactions.length}`);
    // console.log(`Goals found: ${financialData.savings.length}`);

    return financialData;
}