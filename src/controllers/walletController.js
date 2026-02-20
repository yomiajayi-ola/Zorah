import https from 'https';
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
    const wallet = await Wallet.findOne({ user: req.user.id });
    
    // Fetch directly from Xpress to get that ₦2,000 you see in the dashboard
    const response = await axios.get(
      `https://payment.xpress-wallet.com/api/v1/wallet/${wallet.customerId}/balance`,
      { headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` } }
    );

    const liveBalance = response.data.data.availableBalance;
    
    // Update your local wallet balance field so it's not always 0
    wallet.balance = liveBalance;
    await wallet.save();

    return res.json({ success: true, balance: liveBalance });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch live balance" });
  }
};

export const transferToCustomer = async (req, res) => {
  try {
    const { amount, toCustomerId, purpose } = req.body;
    const fromUserId = req.user.id; // Use id from auth middleware

    // 1. Fetch Sender's Wallet Details
    const fromWallet = await Wallet.findOne({ user: fromUserId });
    if (!fromWallet) {
      return res.status(404).json({ message: "Sender wallet not found." });
    }

    // 2. Fetch Recipient's Wallet Details (To update them locally later)
    const toWallet = await Wallet.findOne({ xpressCustomerId: toCustomerId });
    if (!toWallet) {
      return res.status(404).json({ message: "Recipient wallet not found in Zorah records." });
    }

    // 3. Local Balance Check
    if (fromWallet.balance < Number(amount)) {
      return res.status(400).json({ message: "Insufficient funds in your Zorah wallet." });
    }

    // 4. Xpress Wallet API Call
    const agent = new https.Agent({ rejectUnauthorized: false });
    const xpressResponse = await axios.post(
      'https://payment.xpress-wallet.com/api/v1/transfer/wallet',
      {
        amount: Number(amount),
        fromCustomerId: fromWallet.xpressCustomerId,
        toCustomerId: toCustomerId 
      },
      {
        headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
        httpsAgent: agent
      }
    );

    if (xpressResponse.data.status) {
      const transferData = xpressResponse.data.data;
      const transferAmount = Number(amount);

      // 5. UPDATE SENDER: Debit balance and record transaction
      fromWallet.balance -= transferAmount;
      await fromWallet.save();

      await Transaction.create({
        user: fromUserId,
        type: 'debit',
        amount: transferAmount,
        purpose: purpose || 'transfer',
        reference: transferData.reference,
        status: 'successful',
        metadata: xpressResponse.data
      });

      // 6. UPDATE RECIPIENT: Credit balance and record transaction
      toWallet.balance += transferAmount;
      await toWallet.save();

      await Transaction.create({
        user: toWallet.user,
        type: 'credit',
        amount: transferAmount,
        purpose: 'transfer', // Changed from 'transfer_received' to 'transfer' to match your enum
        reference: `${transferData.reference}-REC`,
        status: 'successful',
        metadata: { senderName: fromWallet.accountName }
      });

      console.log(`✅ Transfer Successful: ${fromWallet.accountName} -> ${toWallet.accountName}`);

      return res.status(200).json({
        success: true,
        message: `Successfully transferred ₦${transferAmount} to ${toWallet.accountName}`,
        reference: transferData.reference
      });
    }

  } catch (error) {
    console.error("Transfer Error:", error.response?.data || error.message);
    res.status(500).json({ 
      message: "Transfer failed", 
      error: error.response?.data?.message || error.message 
    });
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

    // 1. Fetch all local data in parallel
    const [user, wallet, kyc, recentTransactions] = await Promise.all([
      User.findById(userId).select("name email biometricEnabled KycStatus"),
      Wallet.findOne({ user: userId }),
      KYC.findOne({ user: userId }),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    // 2. Handle cases where the wallet hasn't been created yet
    if (!wallet) {
      return res.status(200).json({ 
        success: true,
        hasWallet: false, 
        message: "Complete KYC to activate your wallet." 
      });
    }

    // 3. Return the data directly from your MongoDB
    // The balance here will reflect the 1200 you see in your logs
    res.status(200).json({
      success: true,
      account: {
        balance: wallet.balance, // Reading directly from your DB
        currency: wallet.currency || "NGN",
        accountNumber: wallet.accountNumber,
        accountName: wallet.accountName,
        tier: kyc?.tier || 1,
        xpressCustomerId: wallet.xpressCustomerId,
        xpressWalletId: wallet.xpressWalletId
      },
      kyc: {
        status: kyc?.walletStatus || "pending",
        currentTier: kyc?.tier || 1
      },
      recentTransactions, // These will show the 'successful' status after your webhook test
      userSettings: { 
        biometricEnabled: user?.biometricEnabled || false
      }
    });
  } catch (error) {
    console.error("Overview Fetch Error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching overview", 
      error: error.message 
    });
  }
};