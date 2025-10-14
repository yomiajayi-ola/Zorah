import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number, 
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
      enum: ["Cash", "Card", "Transfer", "Wallet"], 
      default: "Cash",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
