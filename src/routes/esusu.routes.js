import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { createGroup, joinGroup } from "../controllers/esusuController.js";

const router = express.Router();

router.post("/create", protect, createGroup);
router.post("/join", protect, joinGroup);





export default router;