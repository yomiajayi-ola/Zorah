import mongoose from "mongoose";

const incomeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: String,
      required: true, // e.g. “Salary”, “Freelance”, “Investment”
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
    },
    category: {
      type: String,
      enum: ["salary", "freelance", "business", "gift", "investment", "bonus", "other"],
      default: "other",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Income", incomeSchema);
