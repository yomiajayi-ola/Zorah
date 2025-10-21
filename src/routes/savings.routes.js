import express from "express";
import { createGoal } from "../controllers/savingsController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createGoal);


export default router;