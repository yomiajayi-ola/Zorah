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

    const user = await User.findById(userId);

     
    // 1. Initialize the SDK
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 2. Initialize the model WITHOUT forcing v1
    // Using the 'models/' prefix helps avoid the 404 error
    const model = ai.getGenerativeModel({ 
      model: "models/gemini-2.5-flash", 
      tools: [{ functionDeclarations: [addExpenseDeclaration] }] 
    });

      const toolConfig = {
  function_calling_config: {
    mode: "ANY", // 🎯 This forces the AI to use a function, no "chatting" allowed
    allowed_function_names: ["add_expense_to_db"]
  }
};


    const chat = model.startChat();
    const result = await chat.sendMessage(userInput);
    
    // 3. Robust extraction of function calls
    const response = result.response;
    const call = response.functionCalls() ? response.functionCalls()[0] : null;
    
    if (call && call.name === "add_expense_to_db") {
        const { amount, category, description } = call.args;

        const newExpense = await Expense.create({
            user: userId,
            amount,
            category,
            description,
            date: new Date()
        });

        await user.incrementUsage('expense');

        return res.json({
            status: "success",
            message: `Logged ₦${amount} under ${category}.`,
            expense: newExpense,
        });
    } else {
        // If the AI just talked back instead of calling the function
        const textFallback = response.text();
        return res.status(400).json({ 
            status: "error", 
            message: "AI provided a text response instead of logging the expense.",
            aiResponse: textFallback 
        });
    }

  } catch (err) {
    console.error("Voice Expense Logger Error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}