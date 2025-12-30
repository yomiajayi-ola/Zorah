import admin from "firebase-admin";

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