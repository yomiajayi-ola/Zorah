import Transactions from "../models/Transaction.js";
import Budgets from "../models/Budget.js"; // Ensure this matches your file name
import Savings from "../models/SavingsGoal.js";
import Income from "../models/Income.js";
import Wallet from "../models/Wallet.js"; // Added to calculate Net Worth

export async function getFinancialData(intent, userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Fetch Core Data
    const [income, budgets, savings, transactions, wallets] = await Promise.all([
        Income.find({ user: userId }).sort({ date: -1 }),
        Budgets.find({ user: userId }),
        Savings.find({ user: userId }),
        Transactions.find({ user: userId }).sort({ date: -1 }).limit(100),
        Wallet.find({ user: userId }) // Vital for the Maybe 'Net Worth' logic
    ]);

    // 2. Calculate the Snapshot (The "Maybe" Intelligence)
    const netWorth = wallets.reduce((acc, w) => acc + w.balance, 0);
    
    // Group 30-day spending by category
    const recentExpenses = transactions.filter(tx => tx.type === 'expense' && tx.date >= thirtyDaysAgo);
    const categoryTotals = recentExpenses.reduce((acc, tx) => {
        const cat = tx.category || "Uncategorized";
        acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount);
        return acc;
    }, {});

    // Find top spending category
    const topCategory = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)[0] || ["None", 0];

    // Count uncategorized for AI engagement hooks
    const uncategorizedCount = transactions.filter(tx => tx.category === 'uncategorized').length;

    // 3. Return a clean, summarized "Fact Sheet"
    return {
        snapshot: {
            netWorth,
            walletsCount: wallets.length,
            topCategory: topCategory[0],
            topCategoryAmount: topCategory[1],
            uncategorizedCount,
            totalIncome: income.reduce((acc, i) => acc + i.amount, 0),
        },
        // We still keep the raw data for specific queries
        raw: {
            recentTransactions: transactions.slice(0, 10), // Only top 10 for context
            activeBudgets: budgets.length,
            savingsGoals: savings.map(s => ({ name: s.name, target: s.targetAmount, current: s.currentAmount }))
        }
    };
}