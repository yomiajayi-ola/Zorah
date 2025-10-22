import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // order: Number, // payout order
    hasReceived: { type: Boolean, default: false },
    payoutStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "skipped"],
        default: "pending",
    },
    payoutAttempts: { type: Number, default: 0 },
    lastPayoutAttempt: Date,
});

const esusuGroupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contributionAmount: { type: Number, required: true },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    members: [memberSchema],
    nextPayoutDate: { type: Date },
    active: { type: Boolean, default: true },
    currentRound: { type: Number, default: 1},
    payoutHistory: [
        {
            member: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            status: String,
            timestamp: Date,
            note: String,
        },
    ],
});

export default mongoose.model("EsusuGroup", esusuGroupSchema)