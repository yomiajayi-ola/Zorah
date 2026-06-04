import express from "express";
import { xpressWebhook } from "../controllers/webHookController.js";

const router = express.Router();

router.post('/xpress-wallet', xpressWebhook);

export default router;
