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
    enum: ["deposit", "withdrawal", "savings", "esusu", "transfer", "esusu_contribution", "savings_contribution", "other"],
    default: "other"
  },
  reference: {
    type: String,
    unique: false,
    sparse: true // This allows multiple documents to have a null reference
  },
  status: {
    type: String,
    enum: ["pending", "successful", "failed"],
    default: "pending"
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet"
  },
  idempotencyKey: {
    type: String,
    sparse: true
  },
  sessionId: {
    type: String,
    sparse: true
  },
  balanceBefore: {
    type: Number
  },
  balanceAfter: {
    type: Number
  },
  category: { 
    type: String, 
    default: "uncategorized" 
  },
  merchantName: {
     type: String 
    }, 
  originalNarration: { 
    type: String 
  },
  isOneTime: {
     type: Boolean, 
     default: false 
    }, 
  metadata: Object
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);
