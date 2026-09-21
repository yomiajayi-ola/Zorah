import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  createEventBudget,
  getEventBudgets,
  getEventBudgetById,
  updateEventBudget,
  addOrUpdateEventExpense,
  deleteEventExpense,
  deleteEventBudget,
} from "../controllers/owambeController.js";

const router = express.Router();

// Apply auth middleware to all Owambe routes
router.use(protect);

// Event Budget CRUD
router.post("/events", createEventBudget);
router.get("/events", getEventBudgets);
router.get("/events/:id", getEventBudgetById);
router.patch("/events/:id", updateEventBudget);
router.delete("/events/:id", deleteEventBudget);

// Itemized Expenses under Event Budget
router.post("/events/:id/expenses", addOrUpdateEventExpense);
router.delete("/events/:id/items/:itemId", deleteEventExpense);

export default router;
