import express from "express";
import { registerUser, loginUser, getProfile, setUserPin } from "../controllers/authController.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);


// PIN $ biometric routes
router.post("/set-pin", protect, setUserPin);

export default router;
