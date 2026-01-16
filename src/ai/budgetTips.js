import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFinancialData } from "./processor.js"; 
import { systemPrompt } from "./prompt.js";     
import { retryGeminiRequest } from "../utils/geminiRetry.js";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai"; 

// define a dedicated user prompt for the automatic tip request
const TIPS_USER_PROMPT = 
    "Analyze the user's recent financial data and provide 3 smart, actionable budget tips or savings recommendations based on their spending and goals.";

    export const getSmartBudgetTips = async (req, res) => {
        try {
            const userId = req.user.id;
            const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const financialData = await getFinancialData("general-advice", userId);
    
            const model = ai.getGenerativeModel({ 
                model: "gemini-2.0-flash", 
                systemInstruction: systemPrompt 
            });
    
            const result = await retryGeminiRequest(async () => {
                return await model.generateContent({
                    contents: [{ 
                        role: "user", 
                        parts: [{ text: `User data: ${JSON.stringify(financialData)}\n${TIPS_USER_PROMPT}` }] 
                    }],
                    generationConfig: { 
                        temperature: 0.2,
                        maxOutputTokens: 8192, // Increased as per your Python experience
                    },
                });
            });
    
            return res.json({
                status: "success",
                reply: result.response.text(),
            });
    
        } catch (err) {
            console.error(`[AI Failure] Details: ${err.message}`);
            res.status(err.status || 500).json({ 
                error: "Service unavailable", 
                details: err.message 
            });
        }
    };