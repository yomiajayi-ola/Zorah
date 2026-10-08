import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  addEsusuContribution,
  createGroup,
  getGroup,
  joinGroup,
  getAllEsusuGroups,
  getUserGroups,
} from "../controllers/esusuController.js";

const router = express.Router();

// List endpoints
router.get("/", protect, getAllEsusuGroups);
router.get("/my-groups", protect, getUserGroups);

// Group management endpoints
router.post("/create", protect, createGroup);
router.post("/join", protect, joinGroup);
router.post("/contribute", protect, addEsusuContribution);

// Single group detail (placed after specific routes like /my-groups)
router.get("/:id", protect, getGroup);

export default router;