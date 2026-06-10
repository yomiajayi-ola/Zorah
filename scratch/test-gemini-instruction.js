import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const systemPrompt = "You are a helpful finance assistant.";
const message = "Help me create or improve my budget. What categories should I focus on?";
const financialData = { snapshot: {}, raw: {} };

async function test() {
    try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ 
            model: "models/gemini-2.5-flash",
            systemInstruction: systemPrompt
        });
        
        console.log("Calling generateContent with models/gemini-2.5-flash...");
        const result = await model.generateContent({
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
        });
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

test();
