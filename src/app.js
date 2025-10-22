import express from "express";
import dotenv from "dotenv";
// import { API_URL, DB_KEY } from '@env';
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import budgetRoutes from "./routes/budget.routes.js"
import notificationRoutes from "./routes/notification.routes.js"
import savingsRoutes from "./routes/savings.routes.js";
import esusuRoutes from "./routes/esusu.routes.js"
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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/savings", savingsRoutes);
app.use("/api/esusu", esusuRoutes);







// Database
connectDB();

app.get("/", (req, res) => {
    res.send("Zorah API is running");
  });
  

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
 