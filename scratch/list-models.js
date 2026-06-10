import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

async function listModels() {
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use the client's internal fetch or general REST endpoint
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("=== Available Gemini Models ===");
    if (data.models) {
      data.models.forEach(m => {
        console.log(`- ID: ${m.name} (DisplayName: ${m.displayName})`);
        console.log(`  Supported Methods: ${m.supportedGenerationMethods.join(', ')}`);
      });
    } else {
      console.log("No models returned:", data);
    }
  } catch (error) {
    console.error("Error listing models:", error.message);
  }
}

listModels();
