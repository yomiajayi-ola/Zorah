import { GoogleGenerativeAI } from "@google/generative-ai";
import Transactions from "../models/Transaction.js";
import { retryGeminiRequest } from "../utils/geminiRetry.js";

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
      if (!userInput) {
        return res.status(400).json({ error: "Message is required" });
      }
  
      const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      // Define contents with explicit instruction for the model
      const contents = [
          { role: "user", parts: [{ text: `You are a financial logger. Your SOLE task is to extract the amount, category, and description from the user's expense statement and call the 'add_expense_to_db' function. Expense statement: ${userInput}` }] },
      ];
  
      let result;
      try {
        result = await retryGeminiRequest(async () => {
          return await ai
            .getGenerativeModel({ model: "gemini-2.5-flash" })
            .generateContent({
              contents: contents,
              tools: [{ functionDeclarations: [addExpenseDeclaration] }],

              // ✅ FIX 1: generationConfig for temperature (for model tuning)
              generationConfig: { 
                  temperature: 0.0, 
              },

              // ✅ FIX 2: toolConfig for function calling mode (for tool use)
              toolConfig: {
                  functionCallingConfig: {
                      mode: 'ANY', // Forces the model to use the defined function
                      allowedFunctionNames: ['add_expense_to_db'],
                  },
              },
            });
        });
      } catch (err) {
        // ... (Error handling remains the same)
        if (err.status === 503) {
          return res.status(503).json({
            status: "failed",
            message: "Service is busy right now, try again in a few seconds.",
          });
        }
        // If we catch the 400 Bad Request error here, log it explicitly
        if (err.status === 400) {
            console.error("Critical API Structure Error in Voice Logger:", err.message);
        }
        throw err;
      }
  
      const response = result.response;
      
      // Handling the case where the model returns natural language instead of a function call
      if (!response.functionCalls || response.functionCalls.length === 0) {
        return res.status(422).json({
          status: "failed",
          message: "I couldn’t understand that clearly. Try something like: 'I spent 2500 on transport.'",
        });
      }
  
      const { amount, category, description, date } = response.functionCalls[0].args || {};
  
      if (!amount || !category || !description) {
        return res.status(422).json({
          status: "failed",
          message: "Missing important details. Please say something like: 'I spent 1500 on food.'",
        });
      }
  
      const newTransaction = await Transactions.create({
        user: req.user.id,
        amount,
        category,
        description,
        date: date ? new Date(date) : new Date(),
        type: "expense",
      });
  
      return res.json({
        status: "success",
        message: `Logged ₦${amount} under ${category}.`,
        transaction: newTransaction,
      });
  
    } catch (err) {
      console.error("Voice Expense Logger Error:", err);
      return res.status(500).json({
        status: "error",
        message: "Unable to log expense at the moment.",
      });
    }
  };