import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    period: { type: String, enum: ["daily","weekly","monthly"], required: true },
    month: { type: Number }, 
    year: { type: Number }, 
    startDate: { type: Date },
    endDate: { type: Date },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }], 
    spent: { type: Number, default: 0 },              // auto-calculated
    remaining: { type: Number, default: 0 },

    status: { type: String, enum: ["active","archived"], default: "active" },
  }, { timestamps: true });
  

export default mongoose.model("Budget", budgetSchema);
