import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
    try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Wait, listModels might not be exposed directly in this way on the client, let's see.
        // Or we can try calling gemini-1.5-flash or gemini-2.5-flash or gemini-pro or models/gemini-2.5-flash
        console.log("Trying models/gemini-2.5-flash...");
        const model = ai.getGenerativeModel({ model: "models/gemini-2.5-flash" });
        const result = await model.generateContent("Hello!");
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Error with gemini-2.5-flash:", error);
    }

    try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log("Trying gemini-1.5-pro...");
        const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent("Hello!");
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Error with gemini-1.5-pro:", error);
    }
}

test();
