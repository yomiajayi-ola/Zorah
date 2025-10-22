import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: Number, // payout order
    hasReceived: { type: Boolean, default: false },
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
}, { timestamps: true }
);

export default mongoose.model("EsusuGroup", esusuGroupSchema)