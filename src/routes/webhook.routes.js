import express from "express";
import { handleWebhook } from "../controllers/webHookController.js";

const router = express.Router();

router.post("/xpress-wallet", handleWebhook);

export default router;
