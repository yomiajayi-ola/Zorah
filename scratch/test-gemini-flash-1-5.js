import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
    try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log("Trying models/gemini-1.5-flash...");
        const model = ai.getGenerativeModel({ model: "models/gemini-1.5-flash" });
        const result = await model.generateContent("Hello!");
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Error with models/gemini-1.5-flash:", error);
    }
}

test();
