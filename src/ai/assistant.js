import dotenv from "dotenv";
dotenv.config();

import { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} from "@google/generative-ai"; 

import { detectIntent } from "./intent.js";
import { getFinancialData } from "./processor.js";
import { systemPrompt } from "./prompt.js";
import User from "../models/User.js"; // Required for usage tracking

// 🔄 Retry Logic Wrapper for Gemini API calls
async function callGeminiWithRetry(ai, modelName, payload) {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const model = ai.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(payload);
            return result;
        } catch (error) {
            if (error.status === 429) {
                const rateLimitError = new Error("RATE_LIMIT_EXCEEDED");
                rateLimitError.status = 429;
                throw rateLimitError;
            }
            
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); 
        }
    }
}

export const aiAssistant = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 2. Detect intent & fetch data
        const intent = detectIntent(message);
        const financialData = await getFinancialData(intent, userId);

        console.log("DEBUG: Data sent to Gemini ->", JSON.stringify(financialData, null, 2));

        const payload = {
            systemInstruction: {
                role: "system",
                parts: [{ text: systemPrompt }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{
                        text: `User asked: "${message}"\nUser financial data: ${JSON.stringify(financialData)}`
                    }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                topP: 1,
                maxOutputTokens: 500,
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
            ]
        };

        // 3. Generate response
        const response = await callGeminiWithRetry(ai, "gemini-2.0-flash", payload);

        let replyText = response?.response?.text() || "";
        let responseStatus = "success";
        let finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
        
        if (!replyText) {
            responseStatus = "failed";
            if (finishReason === "SAFETY") {
                replyText = `I apologize, but the response was blocked by safety filters. Please try rephrasing your request.`;
            } else if (finishReason === "MAX_TOKENS") {
                replyText = `The request was too large for the model to process. Try asking a shorter question.`;
            } else {
                replyText = `I ran into an internal issue while generating the analysis (${finishReason}). Please try again shortly.`;
            }
            console.warn("Final Gemini Response Failure:", finishReason, response.candidates);
        }

        // 📈 4. INCREMENT USAGE: Only if the session was successful
        if (responseStatus === "success" && replyText) {
            await user.incrementUsage('ai'); 
            console.log(`[USAGE_TRACKER] AI session +1 for ${userId}. Current Count: ${user.usageMetrics.aiSessionsCount}`);
        }

        return res.json({
            status: responseStatus,
            reply: replyText,
            intent
        });

    } catch (err) {
        console.error("Gemini Assistant Error:", err);

        if (err.status === 429) {
            return res.status(429).json({
                status: "failed",
                reply: "Eyaa, I'm a bit overwhelmed with requests right now. 😅 Please give me about a minute to rest and try asking again!",
                intent: "rate-limit-hit"
            });
        }

        res.status(500).json({ error: "AI Assistant failed", details: err.message });
    }
};