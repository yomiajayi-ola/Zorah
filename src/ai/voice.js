import Expense from "../models/Expense.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Transactions from "../models/Transaction.js";
import { retryGeminiRequest } from "../utils/geminiRetry.js";
import crypto from "crypto";
import { checkBudgetAndNotify } from "../utils/budgetCheck.js";
import User from "../models/User.js";

// 1. Function declaration Gemini can call
const addExpenseDeclaration = {
  name: "add_expense_to_db",
  description: "Adds a new expense transaction to the database.",
  parameters: {
    type: "object",
    properties: {
      amount: { type: "number", description: "Expense amount in Naira." },
      category: { type: "string", description: "Expense category (e.g., Food, Transport, Rent)." },
      description: { type: "string", description: "What the expense is for." },
      date: { type: "string", description: "Date (YYYY-MM-DD). Defaults to today." },
    },
    required: ["amount", "category", "description"],
  },
};

export const voiceExpenseLogger = async (req, res) => {
  try {
    const userInput = req.body.message;
    const userId = req.user.id || req.user._id;

    if (!userInput) return res.status(400).json({ error: "Message is required" });

    // 🛡️ 1. FETCH & GUARD
    const user = await User.findById(userId);
    if (!user.walletId && (user.usageMetrics.expensesLoggedCount >= 5 || user.usageMetrics.isFeatureLocked)) {
        return res.status(403).json({ // <--- THE 'RETURN' IS VITAL
            status: "failed",
            hasReachedLimit: true,
            message: "Limit reached. Create a Zorah Wallet to continue."
        });
    }

    // --- IF THE CODE REACHES HERE, IT PROCEEDS TO AI ---
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // ... rest of your Gemini code ...

    // At the very end, after creating the expense:
    await user.incrementUsage('expense');
      
    return res.json({
      status: "success",
      message: `Logged ₦${amount} under ${category}.`,
      expense: newExpense,
    });

  } catch (err) {
    console.error("Voice Expense Logger Error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}