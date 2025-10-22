import express from "express";
import { processEsusuPayouts } from "../controllers/esusuPayoutController.js";
import { retryFailedPayouts } from "../controllers/esusuRetryController.js";
import EsusuGroup from "../models/EsusuGroup.js";

const router = express.Router();

// 1️ Trigger payout manually
router.post("/process", async (req, res) => {
  try {
    const results = await processEsusuPayouts();
    res.status(200).json({ message: "Payouts processed", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2️ Retry failed payouts
router.post("/retry", async (req, res) => {
    try {
      const results = await retryFailedPayouts();
      res.status(200).json({ message: "Retry completed", results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // 3️ View payout history (for a specific group)
  router.get("/:groupId/history", async (req, res) => {
    try {
      const group = await EsusuGroup.findById(req.params.groupId)
        .populate("payoutHistory.member", "name email")
        .populate("members.user", "name email");
      if (!group) return res.status(404).json({ message: "Group not found" });
      res.json({ payoutHistory: group.payoutHistory });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

export default router;
