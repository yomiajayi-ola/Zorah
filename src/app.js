import express from "express";
import dotenv from "dotenv";
import path from 'path';
import bodyParser from 'body-parser';
// import { API_URL, DB_KEY } from '@env';
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "../src/routes/auth.routes.js";
import expenseRoutes from "../src/routes/expense.routes.js";
import budgetRoutes from "../src/routes/budget.routes.js"
import notificationRoutes from "../src/routes/notification.routes.js"
import savingsRoutes from "../src/routes/savings.routes.js";
import esusuRoutes from "../src/routes/esusu.routes.js"
import esusuPayoutRoutes from "../src/routes/esusuPayoutRoutes.js";
import walletRoutes from "../src/routes/walletRoutes.js";
import incomeRoutes from "../src/routes/income.routes.js";
import categoryRoutes from '../src/routes/category.routes.js';
import kycRoutes from "../src/routes/kycRoutes.js";
import aiRoutes from "../src/routes/ai.routes.js";
import voiceRoutes from "../src/routes/voice.routes.js"
// import Config from "react-native-config";

// Access variables like this:
// const api = Config.API_URL;



dotenv.config();
const app = express();

// Middleware
app.use(express.json( { strict: true }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: "Invalid JSON format in request body" });
  }
  next();
});
app.use(cors());

app.use('/api/payment/webhook', bodyParser.json({
  // We add a `verify` function to store the raw body buffer.
  verify: (req, res, buf) => {
      if (buf && buf.length) {
          // Save the raw body buffer to a property on the request object.
          // This buffer is what the payment gateway uses to calculate its signature.
          req.rawBody = buf; 
      }
  }
}));

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



const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use('/images', express.static('public/images'));




// Database
connectDB();

app.get("/api", (req, res) => {
    res.send("Zorah API is running");
  });
  
  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'Zorah backend is live 🚀' });
  });
  

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
 