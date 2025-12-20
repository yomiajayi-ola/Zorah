import express from "express";
import { depositFunds, getTransactions, getWalletBalance, withdrawFunds, getFundingHistory } from "../controllers/walletController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/deposit", protect, depositFunds);
router.post("/withdraw", protect, withdrawFunds);
router.get("/balance", protect, getWalletBalance);
router.get("/transactions", protect, getTransactions);
router.get("/history", protect, getFundingHistory);


export default router;