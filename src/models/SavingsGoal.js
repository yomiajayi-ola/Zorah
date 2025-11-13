// import { required } from "joi";
import mongoose from "mongoose";
// import { CreatedAt } from "sequelize-typescript";

const savingsGoalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date, required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("SavingsGoal", savingsGoalSchema);