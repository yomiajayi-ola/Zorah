import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import axios from "axios";
const XPRESS_BASE_URL = process.env.XPRESS_WALLET_API_URL || "https://payment.xpress-wallet.com/api/v1";

export const creditWallet = async (userId, amount, purpose, reference, metadata = {}) => {
  return await Transaction.create({
    user: userId,
    type: "credit",
    amount,
    purpose, // e.g., 'deposit' or 'refund'
    reference,
    status: "successful",
    metadata
  });
};

// /services/walletService.js
export const debitWallet = async (userId, amount, purpose, reference) => {
  // Since we are using Xpress Wallet, the 'true' balance check happens 
  // at the API level. This local function creates the matching record.
  return await Transaction.create({
    user: userId,
    type: "debit",
    purpose, // e.g., 'savings_contribution'
    amount,
    reference,
    status: "successful" // Usually set to successful after the API confirms
  });
};

export const patchMerchantNameAdmin = async () => {
  try {
    if (!process.env.XPRESS_WALLET_SECRET_KEY) {
      console.warn("⚠️ [Wallet Service] Skipping Name Patch: XPRESS_WALLET_SECRET_KEY is missing in .env");
      return;
    }

    // 🔍 Find an existing wallet in your database to grab the production/sandbox merchantId
    const sampleWallet = await Wallet.findOne({ xpressCustomerId: { $exists: true } });
    
    // Fallback: If your local DB doesn't have it yet, grab the test ID from your screenshot docs
    const merchantId = sampleWallet?.xpressCustomerId || "754f4daa-b93b-4011-ac2a-857dfdccf96a";

    const targetBusinessName = "Zorah (TechStack LTD)";
    console.log(`⏳ Sending PUT request to update merchant ${merchantId} to: ${targetBusinessName}...`);

    // 🚀 Exact endpoint and method from your Postman screenshot
    const response = await axios.put(
      `${XPRESS_BASE_URL}/merchant/details/${merchantId}`, 
      { 
        // Spreading their expected default configuration flags from the docs screenshot
        canLogin: true,
        sendEmail: true,
        // Adding the target corporate entity name
        businessName: targetBusinessName 
      },
      { 
        headers: { 
          Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );
    
    console.log("🚀 [Xpress Wallet] Profile Name successfully updated to Zorah (TechStack LTD):", response.data);
  } catch (error) {
    console.error("❌ [Xpress Wallet] Update failed:", error.response?.data?.message || error.message);
  }
};