import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: Number }, // payout order position
    hasReceived: { type: Boolean, default: false },
    payoutStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "skipped"],
        default: "pending",
    },
    payoutAttempts: { type: Number, default: 0 },
    lastPayoutAttempt: Date,
    joinedAt: { type: Date, default: Date.now },
});

const esusuGroupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contributionAmount: { type: Number, required: true },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    maxMembers: { type: Number, default: 10 },          // Maximum members allowed in the group
    isPublic: { type: Boolean, default: true },          // Whether the group appears in listings
    members: [memberSchema],
    nextPayoutDate: { type: Date },
    active: { type: Boolean, default: true },
    currentRound: { type: Number, default: 1 },
    contributions: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            amount: Number,
            date: Date,
            round: Number,
        }
    ],
    payoutHistory: [
        {
            member: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            status: String,
            timestamp: Date,
            note: String,
        },
    ],
}, { timestamps: true });

export default mongoose.model("EsusuGroup", esusuGroupSchema);