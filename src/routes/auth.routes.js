import express from "express";
import { registerUser, loginUser, getProfile, setUserPin, verifyUserPin, toggleBiometric, requestPasswordReset, resetPassword, refreshAccessToken, updateOnboardingProfile, updateProfile } from "../controllers/authController.js";
import { googleAuth } from "../controllers/googleAuthController.js";
import User from "../models/User.js";

import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.put("/update-profile", protect, updateProfile);
router.post("/request-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/refresh-token", refreshAccessToken)
router.post("/google", googleAuth);
router.patch("/onboarding", protect, updateOnboardingProfile);

// Add this to your router
router.post("/reset-usage", protect, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $set: {
                "usageMetrics.aiSessionsCount": 0,
                "usageMetrics.expensesLoggedCount": 0,
                "usageMetrics.isFeatureLocked": false
            }
        });
        res.status(200).json({ status: "success", message: "Usage limits reset for demo." });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});




// PIN $ biometric routes
router.post("/set-pin", protect, setUserPin);
router.post("/verify-pin", protect, verifyUserPin);
router.post("/toggle-biometrics", protect, toggleBiometric);

export default router;
