import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  purpose: {
    type: String,
    enum: ["deposit", "withdrawal", "savings", "esusu", "transfer", "other"],
    default: "other"
  },
  reference: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ["pending", "successful", "failed"],
    default: "pending"
  },
  metadata: Object
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);
