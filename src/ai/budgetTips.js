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
        
        // 1. Fetch relevant data (Use "general-advice" intent for processing)
        const financialData = await getFinancialData("general-advice", userId);

        // 2. Define the payload for the dedicated tip request
        const payload = {
            systemInstruction: systemPrompt, 
            
            contents: [
                { role: "user", parts: [{ text: `
User financial data for analysis: ${JSON.stringify(financialData)}
${TIPS_USER_PROMPT}
                ` }] }
            ],
            
            generationConfig: { temperature: 0.2 }, // Slightly more creative than 0.1
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                // ... include other necessary safety settings
            ],
        };

        // 3. Call Gemini using the robust retry function
        const response = await retryGeminiRequest(async () => {
            return await ai.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent(payload);
        });

        // 4. Handle success/failure of the AI response
        let replyText = response.text;
        let responseStatus = "success";
        let finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
        
        if (!replyText) {
            responseStatus = "failed";
            // Detailed failure messages for debugging
            replyText = `Unable to generate tips due to API error (${finishReason}). Please check data filtering.`;
            console.warn("Smart Tips Failed:", finishReason, response.candidates);
        }
        
        // 5. Send final response
        return res.json({
            status: responseStatus,
            reply: replyText,
            source_data: financialData // Optional: Include data used for debugging
        });

    } catch (err) {
        console.error("Smart Tips Controller Error:", err);
        res.status(500).json({ error: "Failed to generate smart budget tips" });
    }
};