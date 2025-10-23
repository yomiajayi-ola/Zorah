import express from "express";
import { depositFunds, getOrCreateWallet, withdrawFunds } from "../controllers/walletController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/create", getOrCreateWallet);
router.post("/deposit", depositFunds);
router.post("/withdraw", withdrawFunds)


export default router;