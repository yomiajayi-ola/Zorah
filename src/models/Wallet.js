import mongoose from "mongoose";

// models/Wallet.js
const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  accountType: { 
    type: String, 
    enum: ["bank", "cash", "savings", "investment"], 
    default: "bank" 
  },
  name: { type: String, default: "Zorah Wallet" }, 
  
  // BANKING DETAILS FROM XPRESS
  xpressCustomerId: { type: String },  
  xpressWalletId: { type: String },    
  accountNumber: { type: String }, // This is the NUBAN used for funding
  accountName: { type: String },

  balance: { type: Number, default: 0, required: true },
  currency: { type: String, default: "NGN" },
  isDefault: { type: Boolean, default: true },

  tier: { type: Number, enum: [1, 2, 3], default: 1 },
  status: { type: String, default: "active" },
}, { timestamps: true });

export default mongoose.model("Wallet", walletSchema);