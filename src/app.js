import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from 'path';
import bodyParser from 'body-parser';
// import { API_URL, DB_KEY } from '@env';
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import budgetRoutes from "./routes/budget.routes.js"
import notificationRoutes from "./routes/notification.routes.js"
import savingsRoutes from "./routes/savings.routes.js";
import esusuRoutes from "./routes/esusu.routes.js"
import esusuPayoutRoutes from "./routes/esusuPayoutRoutes.js";
import walletRoutes from "./routes/walletRoutes.js"; // <-- Note: NO 'src' here
import incomeRoutes from "./routes/income.routes.js";
import categoryRoutes from './routes/category.routes.js';
import kycRoutes from "./routes/kycRoutes.js";
import aiRoutes from "./routes/ai.routes.js";
import voiceRoutes from "./routes/voice.routes.js"
import webhookRoutes from "./routes/webhook.routes.js"
// import Config from "react-native-config";

// Access variables like this:
// const api = Config.API_URL;




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

// app.use('/api/payment/webhook', bodyParser.json({
//   // We add a `verify` function to store the raw body buffer.
//   verify: (req, res, buf) => {
//       if (buf && buf.length) {
//           // Save the raw body buffer to a property on the request object.
//           // This buffer is what the payment gateway uses to calculate its signature.
//           req.rawBody = buf; 
//       }
//   }
// }));

app.use(express.json({
  verify: (req, res, buf) => {
    // Check if the request is going to the webhook path
    if (req.originalUrl.startsWith('/api/webhooks')) {
      req.rawBody = buf; // Store the raw buffer for signature verification
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
app.use("/api/webhooks", webhookRoutes);



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

  // server.js (put this right after your middleware)
app.post("/api/test-route", (req, res) => {
    res.json({ message: "Test route works!" });
});
  

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
 