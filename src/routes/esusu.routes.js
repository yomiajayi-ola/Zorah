import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  // Lifecycle
  createGroup,
  updateGroup,
  startEsusu,
  cancelGroup,
  reorderPayout,
  // Discovery & user lists
  getAllEsusuGroups,
  getUserGroups,
  getMyInvites,
  // Single group views
  getGroup,
  getTracking,
  getTransactions,
  // Join / invites / membership
  joinGroup,
  inviteMembers,
  respondToInvite,
  removeMember,
  leaveGroup,
  // Contributions
  addEsusuContribution,
  recordManualPayment,
  remindMember,
} from "../controllers/esusuController.js";

const router = express.Router();

// ── Discovery ─────────────────────────────────────────────────────────────────
// GET /api/esusu              → browse public pending groups
router.get("/", protect, getAllEsusuGroups);

// ── User-scoped lists ─────────────────────────────────────────────────────────
// GET /api/esusu/my-groups    → all groups the caller is a member/creator of
router.get("/my-groups", protect, getUserGroups);

// GET /api/esusu/invites      → caller's pending invitations
router.get("/invites", protect, getMyInvites);

// ── Group lifecycle ───────────────────────────────────────────────────────────
// POST /api/esusu/create
router.post("/create", protect, createGroup);

// POST /api/esusu/join        body: { groupId } | { inviteCode }
router.post("/join", protect, joinGroup);

// POST /api/esusu/contribute  (legacy: body.groupId)
router.post("/contribute", protect, addEsusuContribution);

// ── Single-group routes (must come after the keyword paths above) ──────────────
// GET  /api/esusu/:id          → Group Detail screen
router.get("/:id", protect, getGroup);

// PATCH /api/esusu/:id         → edit group settings (pending only)
router.patch("/:id", protect, updateGroup);

// POST /api/esusu/:id/start
router.post("/:id/start", protect, startEsusu);

// POST /api/esusu/:id/cancel
router.post("/:id/cancel", protect, cancelGroup);

// PATCH /api/esusu/:id/order   → manually reorder payout queue
router.patch("/:id/order", protect, reorderPayout);

// POST /api/esusu/:id/leave
router.post("/:id/leave", protect, leaveGroup);

// ── Invites ───────────────────────────────────────────────────────────────────
// POST /api/esusu/:id/invites              → creator sends invites
router.post("/:id/invites", protect, inviteMembers);

// POST /api/esusu/:id/invites/respond      → invited user accepts / declines
router.post("/:id/invites/respond", protect, respondToInvite);

// ── Members ───────────────────────────────────────────────────────────────────
// DELETE /api/esusu/:id/members/:userId    → creator removes a member
router.delete("/:id/members/:userId", protect, removeMember);

// POST /api/esusu/:id/members/:userId/remind → remind an unpaid member
router.post("/:id/members/:userId/remind", protect, remindMember);

// ── Contributions ─────────────────────────────────────────────────────────────
// POST /api/esusu/:id/contribute            → member pays via wallet
router.post("/:id/contribute", protect, addEsusuContribution);

// POST /api/esusu/:id/record-payment        → creator logs an offline payment
router.post("/:id/record-payment", protect, recordManualPayment);

// ── Read views ────────────────────────────────────────────────────────────────
// GET /api/esusu/:id/tracking               → Payment & Contribution Tracking screen
router.get("/:id/tracking", protect, getTracking);

// GET /api/esusu/:id/transactions           → Transaction History tab
router.get("/:id/transactions", protect, getTransactions);

export default router;