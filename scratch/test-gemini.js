import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const systemPrompt = "You are a helpful assistant.";
const message = "Help me create or improve my budget. What categories should I focus on?";
const financialData = { snapshot: {}, raw: {} };

async function test() {
    try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Calling generateContent...");
        const result = await model.generateContent(payload);
        console.log("Result:", result.response.text());
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

test();
