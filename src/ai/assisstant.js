import OpenAI from "openai";
import { detectIntent } from "./intent.js";
import { getFinancialData } from "./processor.js";
import { systemPrompt } from "./prompt.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });

export const aiAssistant = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;

        // 1. Detect what the user wants
        const intent = detectIntent(message);

        // 2. Fetch the right data from the database
        const financialData = await getFinancialData(intent, userId);

        // 3. Generate response from GPT
        const ai = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { 
                    role: "user", 
                    content: `
User asked: "${message}"
User financial data: ${JSON.stringify(financialData)}
                    `
                }
            ]
        });

        return res.json({
            status: "success",
            reply: ai.choices[0].message.content,
            intent
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "AI Assistant failed" });
    }
};
