import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  createDebt,
  getDebts,
  getDebtById,
  updateDebt,
  settleDebt,
  triggerNudge,
  deleteDebt,
} from "../controllers/debtController.js";

const router = express.Router();

// Apply auth middleware to all Debt routes
router.use(protect);

// Debt CRUD
router.post("/", createDebt);
router.get("/", getDebts);
router.get("/:id", getDebtById);
router.patch("/:id", updateDebt);
router.delete("/:id", deleteDebt);

// Special Action Endpoints
router.patch("/:id/settle", settleDebt);
router.post("/:id/nudge", triggerNudge);

export default router;
