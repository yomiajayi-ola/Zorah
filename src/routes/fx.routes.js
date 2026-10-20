import express from "express";
import { getRates, convertCurrency } from "../controllers/fx.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/rates", protect, getRates);
router.post("/convert", protect, convertCurrency);

export default router;
