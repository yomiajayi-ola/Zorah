import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true }, // Budget limit
  period: { type: String, enum: ["weekly", "monthly"], default: "monthly" },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model("Budget", budgetSchema);
