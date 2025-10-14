import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";



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





// Database
connectDB();

app.get("/", (req, res) => {
    res.send("Zorah API is running");
  });
  

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
 