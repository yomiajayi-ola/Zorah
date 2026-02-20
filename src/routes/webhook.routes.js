import express from "express";
import { xpressWebhook } from "../controllers/webHookController.js";

const router = express.Router();

router.post('/xpress', xpressWebhook);

export default router;
