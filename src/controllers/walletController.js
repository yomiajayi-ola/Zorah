import Wallet from "../models/Wallet.js";
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