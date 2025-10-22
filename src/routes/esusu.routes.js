import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { createGroup } from "../controllers/esusuController.js";

const router = express.Router();

router.post("/create", protect, createGroup);




export default router;