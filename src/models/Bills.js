import mongoose from "mongoose";

const billSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true }, 
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  category: { type: String, required: true }, // e.g., "Electricity", "Water", "Internet"
  frequency: { 
    type: String, 
    enum: ["One-Time", "Monthly", "Quarterly", "Yearly"], 
    default: "Monthly" 
  },
  paymentMethod: { type: String }, 
  note: { type: String },
  status: { 
    type: String, 
    enum: ["paid", "unpaid", "overdue"], 
    default: "unpaid" 
  },
  reminderEnabled: { type: Boolean, default: true }, 
}, { timestamps: true });

export default mongoose.model("Bill", billSchema);