import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { createGroup, getGroup, joinGroup } from "../controllers/esusuController.js";

const router = express.Router();

router.post("/create", protect, createGroup);
router.post("/join", protect, joinGroup);
router.get("/:id", protect, getGroup)





export default router;