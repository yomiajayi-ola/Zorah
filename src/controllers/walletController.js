import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import KYC from "../models/Kyc.js";
import Transaction from "../models/Transaction.js";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import mongoose from "mongoose";


const getUserWallet = async (userId) => {
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) throw new Error("Wallet not found for this user.");
    return wallet;
  };
  

export const depositFunds = async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0)
        return res.status(400).json({ message: "Invalid amount" });
  
      const wallet = await Wallet.findOne({ user: req.user.id });
      if (!wallet)
        return res.status(400).json({
          status: false,
          message: "No wallet exists for this user. Complete KYC to create wallet."
        });
  
      const reference = uuidv4();
  
      const response = await axios.post(
        "https://payment.xpress-wallet.com/api/v1/wallet/credit",
        {
          amount,
          reference,
          customerId: wallet.xpressCustomerId,
          metadata: { purpose: "deposit" }
        },
        {
          headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` }
        }
      );
  
      await Transaction.create({
        user: req.user.id,
        type: "credit",
        amount,
        purpose: "deposit",
        reference,
        status: "pending",
        metadata: response.data
      });
  
      return res.json({ success: true, reference, xpress: response.data });
    } catch (err) {
      return res
        .status(500)
        .json({ message: err.response?.data?.message || err.message });
    }
  };
  
  

// Withdraw funds 
export const withdrawFunds = async (req, res) => {
    try {
      const { amount, bankCode, accountNumber } = req.body;
      const wallet = await getUserWallet(req.user.id);
  
      const response = await axios.post(
        "https://payment.xpress-wallet.com/api/v1/wallet/debit",
        {
          customerId: wallet.xpressCustomerId,
          amount,
          bankCode,
          accountNumber,
        },
        {
          headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
        }
      );
  
      const trx = await createTransaction({
        userId: req.user.id,
        type: "debit",
        amount,
        purpose: "withdrawal",
        reference: response.data?.data?.reference,
        metadata: response.data,
      });
  
      return res.json({ success: true, transaction: trx, xpress: response.data });
    } catch (err) {
      return res.status(500).json({ message: err.response?.data?.message || err.message });
    }
  };
  
  


// Get wallet balance
// /controllers/walletController.js
export const getWalletBalance = async (req, res) => {
  try {
      const transactions = await Transaction.find({ 
          user: req.user.id, 
          status: "successful" 
      });

      const balance = transactions.reduce((acc, curr) => {
          return curr.type === 'credit' ? acc + curr.amount : acc - curr.amount;
      }, 0);

      return res.json({ success: true, balance });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
};


// Get transaction history
export const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 });

        return res.status(200).json({ success: true, transactions });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// Get funding history
export const getFundingHistory = async (req, res) => {
  try {
      const history = await Transaction.find({ 
          user: req.user.id, 
          status: "successful", // ✅ Only show confirmed money
          purpose: "deposit" 
      }).sort({ createdAt: -1 });

      return res.json({ success: true, history });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
};

export const getOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch data from local DB in parallel for speed
    const [user, wallet, kyc, recentTransactions] = await Promise.all([
      User.findById(userId).select("name email biometricEnabled KycStatus"),
      Wallet.findOne({ user: userId }),
      KYC.findOne({ user: userId }),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    // 2. Fallback if wallet doesn't exist yet
    if (!wallet) {
      return res.status(200).json({
        user: { name: user.name, kycStatus: user.KycStatus },
        hasWallet: false,
        message: "Complete KYC to activate your wallet."
      });
    }

    // 3. Fetch LIVE Balance from Xpress Wallet (Source of Truth)
    let liveBalance = 0;
    try {
      const balanceResponse = await axios.get(
        `https://payment.xpress-wallet.com/api/v1/wallet/${wallet.xpressWalletId}/balance`,
        {
          headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
        }
      );
      liveBalance = balanceResponse.data.data.availableBalance;
    } catch (apiErr) {
      console.error("Xpress Wallet Balance Fetch Failed:", apiErr.message);
      // Fallback to 0 or a locally cached balance if API is down
    }

    // 4. Consolidate for the Frontend
    res.status(200).json({
      success: true,
      account: {
        balance: liveBalance,
        accountNumber: wallet.accountNumber,
        accountName: wallet.accountName,
        tier: kyc?.tier || 1
      },
      kyc: {
        status: kyc?.walletStatus || "pending",
        currentTier: kyc?.tier || 1
      },
      recentTransactions,
      userSettings: {
        biometricEnabled: user.biometricEnabled
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching overview", error: error.message });
  }
};