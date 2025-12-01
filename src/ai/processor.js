import Transactions from "../models/Transactions.js";
import Budgets from "../models/Budgets.js";
import Savings from "../models/Savings.js";
import Income from "../models/Income.js";

export async function getFinancialData(intent, userId) {

    let financialData = {};

    if (intent === "spending-summary") {
        financialData.transactions = await Transactions.find({ user: userId });
    }

    if (intent === "budget-analysis") {
        financialData.budgets = await Budgets.find({ user: userId });
    }

    if (intent === "savings-goal") {
        financialData.savings = await Savings.find({ user: userId });
    }

    if (intent === "income-summary") {
        financialData.income = await Income.find({ user: userId });
    }

    return financialData;
}
