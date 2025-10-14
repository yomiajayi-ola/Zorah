import { date, number, required } from "joi";
import mongoose, { mongo } from "mongoose";

const expenseSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: {
            type: number,
            required: true,
        },
        category: {
            type: String,
            enum: ["Food", "Transport", "Housing", "Health", "Entertainment", "Others"],
            default: "Others",
        },
        description: {
            type: String,
            trim: true,
        },
        paymentMethod: {
            type: String,
            enum: ["Cash", "Card", "Transfer", "wallet"],
            default: "cash",
        },
        date: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);