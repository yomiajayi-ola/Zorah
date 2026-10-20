import mongoose from "mongoose";
import crypto from "crypto";

/**
 * Esusu / Ajo rotating savings group.
 *
 * Lifecycle (status):
 *   pending   → created, collecting members/invites. Creator can edit, reorder, start, cancel.
 *   active    → cycles running. Each cycle (round) every joined member contributes
 *               `contributionAmount`; the round's picker receives the pool on `nextPayoutDate`.
 *   completed → every joined member has been picked once (cyclesCompleted === totalCycles).
 *   cancelled → creator cancelled before start.
 *
 * `active` (boolean) is kept in sync for legacy queries/clients.
 */

export const MEMBER_STATUSES = ["invited", "joined", "declined", "removed", "left"];
export const GROUP_STATUSES = ["pending", "active", "completed", "cancelled"];
export const PICKER_TYPES = ["rotating", "automatic", "manual"];
export const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];

const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: Number }, // payout order position (1-based)
    status: { type: String, enum: MEMBER_STATUSES, default: "joined" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invitedAt: Date,
    respondedAt: Date,
    hasReceived: { type: Boolean, default: false },
    receivedRound: Number,
    receivedAt: Date,
    payoutStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "skipped"],
        default: "pending",
    },
    payoutAttempts: { type: Number, default: 0 },
    lastPayoutAttempt: Date,
    joinedAt: { type: Date, default: Date.now },
});

const contributionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: Number,            // contribution amount (excludes late fee)
    lateFee: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    date: Date,
    round: Number,
    method: { type: String, enum: ["wallet", "manual"], default: "wallet" },
    paymentMethod: String,     // manual: "cash", "bank_transfer", "pos", ...
    receiptUrl: String,
    note: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const payoutSchema = new mongoose.Schema({
    member: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    round: Number,
    amount: Number,
    status: String, // paid | failed | skipped | topup
    timestamp: Date,
    transactionId: String,
    note: String,
});

const esusuGroupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contributionAmount: { type: Number, required: true, min: 1 },
    frequency: { type: String, enum: FREQUENCIES, default: "weekly" },
    maxMembers: { type: Number, default: 10, min: 2, max: 100 },
    isPublic: { type: Boolean, default: true },
    pickerType: { type: String, enum: PICKER_TYPES, default: "rotating" },
    startDate: { type: Date },
    latePaymentFee: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: GROUP_STATUSES, default: "pending", index: true },
    inviteCode: { type: String, unique: true, sparse: true },
    collectionAccount: {
        accountNumber: { type: String, default: "" },
        bankName: { type: String, default: "" },
        accountName: { type: String, default: "" },
    },
    members: [memberSchema],
    nextPayoutDate: { type: Date },     // due date of the current round
    active: { type: Boolean, default: true },
    currentRound: { type: Number, default: 1 },
    totalCycles: { type: Number, default: 0 },
    cyclesCompleted: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
    contributions: [contributionSchema],
    payoutHistory: [payoutSchema],
}, { timestamps: true });

esusuGroupSchema.index({ "members.user": 1 });
esusuGroupSchema.index({ creator: 1 });

esusuGroupSchema.pre("validate", function (next) {
    if (!this.inviteCode) this.inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    this.active = this.status !== "completed" && this.status !== "cancelled";
    next();
});

/** Members currently in the circle (excludes invited/declined/removed/left). */
esusuGroupSchema.methods.joinedMembers = function () {
    return this.members.filter((m) => (m.status || "joined") === "joined");
};

esusuGroupSchema.methods.findMember = function (userId) {
    const id = String(userId);
    return this.members.find((m) => String(m.user?._id ?? m.user) === id);
};

export default mongoose.model("EsusuGroup", esusuGroupSchema);