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
import { retryGeminiRequest } from "../utils/geminiRetry.js";
import User from "../models/User.js";

export const aiAssistant = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ status: "fail", message: "Message is required." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({
            model: "models/gemini-2.5-flash",
            systemInstruction: systemPrompt
        });

        // Detect intent & fetch financial context data in parallel
        const [intent, financialData] = await Promise.all([
            Promise.resolve(detectIntent(message)),
            getFinancialData(detectIntent(message), userId)
        ]);

        console.log("DEBUG: Intent ->", intent, "| Data keys ->", Object.keys(financialData));

        const payload = {
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

        // Use shared retry utility (handles 429 & 503 with exponential backoff)
        const response = await retryGeminiRequest(
            () => model.generateContent(payload)
        );

        let replyText = response?.response?.text() || "";
        let responseStatus = "success";
        const finishReason = response?.response?.candidates?.[0]?.finishReason || "UNKNOWN";

        if (!replyText) {
            responseStatus = "failed";
            if (finishReason === "SAFETY") {
                replyText = "I apologize, but that response was blocked by safety filters. Please try rephrasing your request.";
            } else if (finishReason === "MAX_TOKENS") {
                replyText = "The request was too large for me to process. Try asking a shorter question.";
            } else {
                replyText = `I ran into an internal issue while generating the analysis (${finishReason}). Please try again shortly.`;
            }
            console.warn("Final Gemini Response Failure:", finishReason);
        }

        // Increment usage only on successful responses
        if (responseStatus === "success" && replyText) {
            await user.incrementUsage('ai');
            console.log(`[USAGE_TRACKER] AI session +1 for ${userId}. Count: ${user.usageMetrics.aiSessionsCount}`);
        }

        return res.json({
            status: responseStatus,
            reply: replyText,
            intent
        });

    } catch (err) {
        console.error("Gemini Assistant Error:", err.status || err.code, err.message);

        if (err.status === 429) {
            return res.status(429).json({
                status: "failed",
                reply: "Eyaa, I'm a bit overwhelmed with requests right now. 😅 Please give me about a minute to rest and try asking again!",
                intent: "rate-limit-hit"
            });
        }

        if (err.status === 503) {
            return res.status(503).json({
                status: "failed",
                reply: "I'm temporarily unavailable. Please try again in a few seconds.",
                intent: "service-unavailable"
            });
        }

        return res.status(500).json({
            status: "error",
            reply: "Something went wrong on my end. Please try again.",
            details: err.message
        });
    }
};