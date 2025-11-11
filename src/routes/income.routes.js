import express from "express";
import {
  addIncome,
  getIncomes,
  getIncomeById,
  updateIncome,
  deleteIncome,
} from "../controllers/incomeController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/add-income", protect, addIncome);
router.post("/get-income", protect, getIncomes);
router.get("/:id", protect, getIncomeById);
router.put("/:id", protect, updateIncome);
router.delete("/:id", protect, deleteIncome)


export default router;
