import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import EsusuGroup from "../models/EsusuGroup.js";

const router = express.Router();

/**
 * @route   GET /api/esusu/payouts/:groupId/history
 * @desc    View payout history for a specific Esusu group
 * @access  Private — must be a member or creator of the group
 */
router.get("/:groupId/history", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const group = await EsusuGroup.findById(req.params.groupId)
      .populate("payoutHistory.member", "firstName lastName email")
      .populate("members.user", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Only members or the creator can view payout history
    const isMember = group.members.some(
      (m) => m.user && m.user._id.toString() === userId.toString()
    );
    const isCreator = group.creator._id.toString() === userId.toString();

    if (!isMember && !isCreator) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You must be a member of this group to view its payout history.",
      });
    }

    return res.status(200).json({
      success: true,
      groupName: group.name,
      currentRound: group.currentRound,
      totalMembers: group.members.length,
      payoutHistory: group.payoutHistory || [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
