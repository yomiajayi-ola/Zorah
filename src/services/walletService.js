import https from 'https';
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
  const poolCustomerId = process.env.XPRESS_POOL_CUSTOMER_ID;
  if (!poolCustomerId) {
    console.warn("⚠️ [debitWallet] XPRESS_POOL_CUSTOMER_ID is not configured. Falling back to local-only mock debit.");
    const wallet = await Wallet.findOne({ user: userId });
    if (wallet) {
      wallet.balance -= Number(amount);
      await wallet.save();
    }
    return await Transaction.create({
      user: userId,
      type: "debit",
      purpose, 
      amount: Number(amount),
      reference,
      status: "successful"
    });
  }

  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    throw new Error("Wallet not found for this user.");
  }

  const debitAmount = Number(amount);
  if (!debitAmount || debitAmount <= 0) {
    throw new Error("Invalid transfer amount.");
  }

  // 1. Call Xpress API to transfer from customer to pool wallet
  const agent = new https.Agent({ rejectUnauthorized: false });
  let xpressResponse;
  try {
    xpressResponse = await axios.post(
      `${XPRESS_BASE_URL}/transfer/wallet`,
      {
        amount: debitAmount,
        fromCustomerId: wallet.xpressCustomerId,
        toCustomerId: poolCustomerId
      },
      {
        headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
        httpsAgent: agent
      }
    );
  } catch (apiError) {
    console.error("Pool Debit API Error:", apiError.response?.data || apiError.message);
    throw new Error(apiError.response?.data?.message || "Custodial transfer service unavailable.");
  }

  if (!xpressResponse.data.status) {
    throw new Error(xpressResponse.data.message || "Custodial transfer declined.");
  }

  // 2. Update local wallet balance and create Transaction
  wallet.balance -= debitAmount;
  await wallet.save();

  const transferData = xpressResponse.data.data;
  return await Transaction.create({
    user: userId,
    type: "debit",
    purpose, 
    amount: debitAmount,
    reference: transferData?.reference || reference,
    status: "successful",
    metadata: xpressResponse.data
  });
};

export const creditWalletFromPool = async (userId, amount, purpose, reference) => {
  const poolCustomerId = process.env.XPRESS_POOL_CUSTOMER_ID;
  if (!poolCustomerId) {
    console.warn("⚠️ [creditWalletFromPool] XPRESS_POOL_CUSTOMER_ID is not configured. Falling back to local-only mock credit.");
    const wallet = await Wallet.findOne({ user: userId });
    if (wallet) {
      wallet.balance += Number(amount);
      await wallet.save();
    }
    return await Transaction.create({
      user: userId,
      type: "credit",
      purpose, 
      amount: Number(amount),
      reference,
      status: "successful"
    });
  }

  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    throw new Error("Wallet not found for this user.");
  }

  const creditAmount = Number(amount);
  if (!creditAmount || creditAmount <= 0) {
    throw new Error("Invalid transfer amount.");
  }

  // 1. Call Xpress API to transfer from pool wallet back to customer
  const agent = new https.Agent({ rejectUnauthorized: false });
  let xpressResponse;
  try {
    xpressResponse = await axios.post(
      `${XPRESS_BASE_URL}/transfer/wallet`,
      {
        amount: creditAmount,
        fromCustomerId: poolCustomerId,
        toCustomerId: wallet.xpressCustomerId
      },
      {
        headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
        httpsAgent: agent
      }
    );
  } catch (apiError) {
    console.error("Pool Credit API Error:", apiError.response?.data || apiError.message);
    throw new Error(apiError.response?.data?.message || "Custodial transfer service unavailable.");
  }

  if (!xpressResponse.data.status) {
    throw new Error(xpressResponse.data.message || "Custodial transfer declined.");
  }

  // 2. Update local wallet balance and create Transaction
  wallet.balance += creditAmount;
  await wallet.save();

  const transferData = xpressResponse.data.data;
  return await Transaction.create({
    user: userId,
    type: "credit",
    purpose, 
    amount: creditAmount,
    reference: transferData?.reference || reference,
    status: "successful",
    metadata: xpressResponse.data
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