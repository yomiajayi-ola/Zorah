import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },

    // External Provider Identifiers
    xpressCustomerId: { type: String, required: true },  
    xpressWalletId: { type: String, required: true },    
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },

    // Financial Data
    balance: { type: Number, default: 0, required: true },
    currency: { type: String, default: "NGN" },

    // Tracking & Limits
    tier: { 
      type: Number, 
      enum: [1, 2, 3], 
      default: 1 
    },
    status: { type: String, default: "active" },
    providerReference: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", walletSchema);