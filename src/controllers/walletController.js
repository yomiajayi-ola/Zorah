import https from 'https';
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import KYC from "../models/Kyc.js";
import Transaction from "../models/Transaction.js";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import axios from "axios";
const XPRESS_BASE_URL = process.env.XPRESS_WALLET_API_URL || "https://payment.xpress-wallet.com/api/v1";


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
        `${XPRESS_BASE_URL}/wallet/credit`,
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
        `${XPRESS_BASE_URL}/wallet/debit`,
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
  
      const trx = await Transaction.create({
        user: req.user.id,
        type: "debit",
        amount,
        purpose: "withdrawal",
        reference: response.data?.data?.reference || uuidv4(),
        status: "pending",
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
    if (!wallet) {
      return res.status(200).json({ success: true, balance: 0, hasWallet: false, message: "KYC not completed. No wallet exists yet." });
    }
    
    // Fetch directly from Xpress using the customer endpoint
    const response = await axios.get(
      `${XPRESS_BASE_URL}/customer/${wallet.xpressCustomerId}`,
      { headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` } }
    );

    const liveBalance = response.data.customer.availableBalance;
    
    // Update your local wallet balance field so it's not always 0
    wallet.balance = liveBalance;
    await wallet.save();

    return res.json({ success: true, balance: liveBalance });
  } catch (error) {
    console.error("Fetch Balance Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Could not fetch live balance", error: error.message });
  }
};

export const transferToCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  let isApiSuccessful = false;
  let apiResponseData = null;

  try {
    session.startTransaction();

    const { amount, toCustomerId, purpose } = req.body;
    const fromUserId = req.user.id; // Use id from auth middleware
    const transferAmount = Number(amount);

    if (!transferAmount || transferAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid amount specified." });
    }

    // 1. Fetch Sender's Wallet Details (within transaction session)
    const fromWallet = await Wallet.findOne({ user: fromUserId }).session(session);
    if (!fromWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Sender wallet not found." });
    }

    // 2. Fetch Recipient's Wallet Details (within transaction session)
    const toWallet = await Wallet.findOne({ xpressCustomerId: toCustomerId }).session(session);
    if (!toWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Recipient wallet not found in Zorah records." });
    }

    // 3. Local Balance Check
    if (fromWallet.balance < transferAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Insufficient funds in your Zorah wallet." });
    }

    // 4. Xpress Wallet API Call
    // NOTE: External API call cannot be rolled back, so if it fails, we safely abort the MongoDB transaction.
    const agent = new https.Agent({ rejectUnauthorized: false });
    let xpressResponse;
    try {
      xpressResponse = await axios.post(
        `${XPRESS_BASE_URL}/transfer/wallet`,
        {
          amount: transferAmount,
          fromCustomerId: fromWallet.xpressCustomerId,
          toCustomerId: toCustomerId 
        },
        {
          headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
          httpsAgent: agent
        }
      );
    } catch (apiError) {
      console.error("Xpress Transfer API Network Error:", apiError.response?.data || apiError.message);
      await session.abortTransaction();
      session.endSession();
      return res.status(502).json({
        message: "External transfer service unavailable.",
        error: apiError.response?.data?.message || apiError.message
      });
    }

    if (!xpressResponse.data.status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Transfer declined by payment gateway.",
        error: xpressResponse.data.message
      });
    }

    // Mark that API succeeded, so if DB writes fail afterwards we know we have a desync.
    isApiSuccessful = true;
    apiResponseData = xpressResponse.data;
    const transferData = apiResponseData.data;

    // 5. UPDATE SENDER: Debit balance and record transaction (within transaction session)
    fromWallet.balance -= transferAmount;
    await fromWallet.save({ session });

    await Transaction.create([{
      user: fromUserId,
      type: 'debit',
      amount: transferAmount,
      purpose: purpose || 'transfer',
      reference: transferData.reference,
      status: 'successful',
      metadata: apiResponseData
    }], { session });

    // 6. UPDATE RECIPIENT: Credit balance and record transaction (within transaction session)
    toWallet.balance += transferAmount;
    await toWallet.save({ session });

    await Transaction.create([{
      user: toWallet.user,
      type: 'credit',
      amount: transferAmount,
      purpose: 'transfer',
      reference: `${transferData.reference}-REC`,
      status: 'successful',
      metadata: { senderName: fromWallet.accountName }
    }], { session });

    // Commit all MongoDB changes atomically
    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Transactional Transfer Successful: ${fromWallet.accountName} -> ${toWallet.accountName}`);

    return res.status(200).json({
      success: true,
      message: `Successfully transferred ₦${transferAmount} to ${toWallet.accountName}`,
      reference: transferData.reference
    });

  } catch (error) {
    console.error("Transfer Controller DB/Commit Error:", error.message);
    
    // Rollback DB changes if session is still active
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    if (isApiSuccessful) {
      // CRITICAL WARNING: External payment provider transferred the money, but our database failed to log/commit.
      // This is a ledger inconsistency that requires manual reconciliation or a secondary queue job.
      console.error(
        `🚨 CRITICAL LEDGER DESYNC: Xpress Wallet transfer succeeded but local MongoDB transaction failed to commit. ` +
        `API Response Reference: ${apiResponseData?.data?.reference}. Error: ${error.message}`
      );
      
      return res.status(500).json({
        message: "Transfer succeeded at gateway but failed to record locally. Support has been notified.",
        reference: apiResponseData?.data?.reference
      });
    }

    return res.status(500).json({ 
      message: "Internal transfer processing error", 
      error: error.message 
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

    if (!wallet) {
      return res.status(200).json({ 
        success: true,
        hasWallet: false, 
        message: "Complete KYC to activate your wallet." 
      });
    }
    const chartData = recentTransactions.reduce((acc, curr) => {
      const date = curr.createdAt.toISOString().split('T')[0];
      const existing = acc.find(item => item.date === date);
      
      if (existing) {
        existing[curr.type] = (existing[curr.type] || 0) + curr.amount;
      } else {
        acc.push({ 
          date, 
          [curr.type]: curr.amount 
        });
      }
      return acc;
    }, []);

    res.status(200).json({
      success: true,
      account: {
        balance: wallet.balance,
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
      recentTransactions,
      chartData, // Included safe computed data
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