import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },

    xpressCustomerId: { type: String, required: true },  // NEW
    xpressWalletId: { type: String, required: true },    // wallet.walletId
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },

    balance: { type: Number, default: 0, required: true },

    providerReference: { type: String },
    status: { type: String, default: "active" },
    currency: { type: String, default: "NGN" }
  },
  { timestamps: true }
);


export default mongoose.model("Wallet", walletSchema);
