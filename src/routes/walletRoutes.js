import express from "express";
import { depositFunds, getOrCreateWallet, getTransactions, getWalletBalance, withdrawFunds } from "../controllers/walletController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/create", getOrCreateWallet);
router.post("/deposit", depositFunds);
router.post("/withdraw", withdrawFunds);
router.get("/balance", getWalletBalance);
router.get("/transactions", getTransactions);


export default router;