import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";


dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes


// Database
connectDB();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
