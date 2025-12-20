import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

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