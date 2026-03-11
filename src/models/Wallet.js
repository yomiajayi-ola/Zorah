import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    // REMOVED unique: true to allow multiple accounts per user (Maybe's multi-account logic)
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ADDED: Distinguish between Zorah Wallet, Cash, and Linked Banks
    accountType: { 
      type: String, 
      enum: ["bank", "cash", "savings", "investment"], 
      default: "bank" 
    },
    name: { type: String, required: true }, // e.g., "GTBank", "Zorah Wallet"
    isDefault: { type: Boolean, default: false },

    // External Provider Identifiers (Keep these for your Xpress integration)
    xpressCustomerId: { type: String },  
    xpressWalletId: { type: String },    
    accountNumber: { type: String },
    accountName: { type: String },

    // Financial Data
    balance: { type: Number, default: 0, required: true },
    currency: { type: String, default: "NGN" },

    // ADDED: To identify the default wallet for the AI to reference first
    isDefault: { type: Boolean, default: false },

    tier: { type: Number, enum: [1, 2, 3], default: 1 },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

// ADDED: Static method for the AI to quickly fetch the "Financial Snapshot"
walletSchema.statics.getNetWorth = async function(userId) {
  const wallets = await this.find({ user: userId });
  return wallets.reduce((acc, curr) => acc + curr.balance, 0);
};
export default mongoose.model("Wallet", walletSchema);