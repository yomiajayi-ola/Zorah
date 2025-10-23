import express from "express";
import { depositFunds, getOrCreateWallet } from "../controllers/walletController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/create", getOrCreateWallet);
router.post("/deposit", depositFunds)


export default router;