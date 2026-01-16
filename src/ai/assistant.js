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


// 🔄 Retry Logic Wrapper for Gemini API calls
async function callGeminiWithRetry(ai, modelName, payload) {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const model = ai.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(payload);
            return result;
        } catch (error) {
            // Check if it is a Rate Limit error
            if (error.status === 429) {
                console.warn(`Rate limit hit. Attempt ${i + 1}. Waiting 45 seconds...`);
                // Wait much longer for 429s (free tier usually requires a minute)
                await new Promise(resolve => setTimeout(resolve, 45000));
                continue; 
            }
            
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
}


export const aiAssistant = async (req, res) => {
    try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        const { message } = req.body;
        const userId = req.user.id;
        
        // 1. Detect user intent
        const intent = detectIntent(message);

        // 2. Fetch DB info (Assuming data filtering has been implemented in processor.js)
        const financialData = await getFinancialData(intent, userId);

        console.log("DEBUG: Data sent to Gemini ->", JSON.stringify(financialData, null, 2));

        // Payload definition with the CORRECT structure

        const payload = {
            systemInstruction: {
                role: "system",
                parts: [
                    { text: systemPrompt }
                ]
            },
        
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `User asked: "${message}"
        User financial data: ${JSON.stringify(financialData)}`
                        }
                    ]
                }
            ],
        
            generationConfig: {
                temperature: 0.1,
                topP: 1,
                maxOutputTokens: 500,
            },
        
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                }
            ]
        };
        


        // 3. Generate response from Gemini using Retry Logic
        const response = await callGeminiWithRetry(ai, "gemini-2.0-flash", payload);

        
        
        // 🚨 Robust response handling
        let replyText = response?.response?.text() || "";
        let responseStatus = "success";
        let finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
        
        // 1. Check if the final response text was empty
        if (!replyText) {
            
            // 2. Construct the failure message
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
        
        
        // ✅ Final Return
        return res.json({
            status: responseStatus,
            reply: replyText,
            intent
        });

    } catch (err) {
        console.error("Gemini Assistant Error:", err);
        // Returning details helps with debugging network/auth errors
        res.status(500).json({ error: "AI Assistant failed", details: err.message });
    }
};