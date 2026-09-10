import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

const envFile = process.env.DOTENV_CONFIG_PATH || (process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : ".env");
dotenv.config({ path: path.isAbsolute(envFile) ? envFile : path.resolve(rootDir, envFile) });
dotenv.config({ path: path.resolve(rootDir, ".env") });

// Ensure the private key handles newlines correctly
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  // Debug check: This will help you see if they are still undefined
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("❌ FIREBASE_PROJECT_ID is missing from process.env");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

export default admin;