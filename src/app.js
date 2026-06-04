import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from 'path';
import bodyParser from 'body-parser';
import admin from "./config/firebase.js";
import { patchMerchantNameAdmin } from './services/walletService.js'; // 🚀 Line 7 is perfect
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import budgetRoutes from "./routes/budget.routes.js"
import notificationRoutes from "./routes/notification.routes.js"
import savingsRoutes from "./routes/savings.routes.js";
import esusuRoutes from "./routes/esusu.routes.js"
import esusuPayoutRoutes from "./routes/esusuPayoutRoutes.js";
import walletRoutes from "./routes/walletRoutes.js"; 
import incomeRoutes from "./routes/income.routes.js";
import categoryRoutes from './routes/category.routes.js';
import kycRoutes from "./routes/kycRoutes.js";
import aiRoutes from "./routes/ai.routes.js";
import voiceRoutes from "./routes/voice.routes.js"
import webhookRoutes from "./routes/webhook.routes.js"
import billRoutes from "./routes/bills.routes.js";
import "./cron/billAlerts.js";

console.log("Firebase Initialized", admin.apps.length)

const app = express();

// Webhook raw body middleware
app.use('/api/webhooks/xpress-wallet', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body; 
  next();
});

// Middleware
app.use(express.json( { strict: true }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: "Invalid JSON format in request body" });
  }
  next();
});
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/savings", savingsRoutes);
app.use("/api/esusu", esusuRoutes);
app.use("/api/esusu/payouts", esusuPayoutRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/income", incomeRoutes);
app.use('/api/categories', categoryRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/bills", billRoutes);

const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use('/images', express.static('public/images'));

// 🗄️ Database Connection
connectDB();

// 🚀 MOUNTED FIX HERE: Execute the admin patch when server boots up
// patchMerchantNameAdmin();

// Basic Checks & Testing Endpoints
app.get("/api", (req, res) => {
    res.send("Zorah API is running");
});
  
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'Zorah backend is live 🚀' });
});

app.post("/api/test-route", (req, res) => {
    res.json({ message: "Test route works!" });
});
  
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));