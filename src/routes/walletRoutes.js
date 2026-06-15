import express from "express";
import { 
  depositFunds, 
  getTransactions, 
  getWalletBalance, 
  withdrawFunds, 
  getFundingHistory, 
  getOverview, 
  transferToCustomer,
  getBanksList,
  verifyBankAccount,
  lookupRecipient 
} from "../controllers/walletController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// router.use(protect);

router.post("/deposit", protect, depositFunds);
router.post("/withdraw", protect, withdrawFunds);
router.get("/balance", protect, getWalletBalance);
router.get("/transactions", protect, getTransactions);
router.get("/history", protect, getFundingHistory);
router.get("/overview", protect, getOverview);
router.post("/transfer", protect, transferToCustomer);

// Helper endpoints for frontend integration
router.get("/banks", protect, getBanksList);
router.get("/verify-account", protect, verifyBankAccount);
router.get("/lookup-recipient", protect, lookupRecipient);

export default router;