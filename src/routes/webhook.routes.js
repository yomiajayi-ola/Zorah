import express from "express";
import { xpressWalletWebhook } from "../controllers/webHookController.js";

const router = express.Router();

router.post("/xpress-wallet", xpressWalletWebhook);

export default router;
