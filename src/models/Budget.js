import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    period: { type: String, enum: ["weekly", "monthly"], default: "monthly" },
    month: { type: Number }, 
    year: { type: Number }, 
    startDate: { type: Date },
    endDate: { type: Date },
  }, { timestamps: true });
  

export default mongoose.model("Budget", budgetSchema);
