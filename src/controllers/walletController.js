import https from 'https';
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import KYC from "../models/Kyc.js";
import Transaction from "../models/Transaction.js";
import { createVirtualAccount } from "../services/xpressWalletService.js";
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
    const { amount, idempotencyKey, sessionId } = req.body;
    const userId = req.user._id || req.user.id;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ status: "fail", message: "Invalid deposit amount specified." });
    }

    // 1. Idempotency Guard Check
    const activeIdempotencyKey = idempotencyKey || req.headers?.["x-idempotency-key"];
    if (activeIdempotencyKey) {
      const existingTx = await Transaction.findOne({ idempotencyKey: activeIdempotencyKey, user: userId });
      if (existingTx) {
        return res.status(200).json({
          status: "success",
          message: "Deposit already processed",
          isIdempotent: true,
          data: {
            transaction: existingTx,
            balance: existingTx.balanceAfter
          }
        });
      }
    }

    // 2. Fetch User's Wallet
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(400).json({
        status: "fail",
        message: "No wallet exists for this user. Complete KYC to create wallet."
      });
    }

    const reference = `DEP-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let responseData = null;

    // 3. Xpress Wallet credit call if configured & live
    const hasSecretKey = !!process.env.XPRESS_WALLET_SECRET_KEY;
    if (hasSecretKey && process.env.NODE_ENV !== "test") {
      try {
        const response = await axios.post(
          `${XPRESS_BASE_URL}/wallet/credit`,
          {
            amount: numAmount,
            reference,
            customerId: wallet.xpressCustomerId,
            metadata: { purpose: "deposit" }
          },
          {
            headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` }
          }
        );
        responseData = response.data;
      } catch (apiErr) {
        console.error("Xpress Deposit API Error:", apiErr.response?.data || apiErr.message);
        return res.status(500).json({
          status: "error",
          message: apiErr.response?.data?.message || "Xpress deposit gateway failed."
        });
      }
    }

    // 4. Update MongoDB Wallet balance & ledgerBalance (Authoritative Source of Truth)
    const balanceBefore = wallet.balance || 0;
    const balanceAfter = balanceBefore + numAmount;

    wallet.balance = balanceAfter;
    wallet.ledgerBalance = (wallet.ledgerBalance || balanceBefore) + numAmount;
    await wallet.save();

    // 5. Create Transaction record with double-entry fields
    const trx = await Transaction.create({
      user: userId,
      wallet: wallet._id,
      type: "credit",
      amount: numAmount,
      purpose: "deposit",
      reference,
      idempotencyKey: activeIdempotencyKey || undefined,
      sessionId: sessionId || undefined,
      balanceBefore,
      balanceAfter,
      status: "successful",
      metadata: responseData || { purpose: "deposit" }
    });

    return res.status(200).json({
      status: "success",
      message: "Deposit successful",
      data: {
        transaction: trx,
        balance: wallet.balance,
        reference
      }
    });

  } catch (err) {
    console.error("Deposit Error:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
  
  

// Withdraw funds to external bank
export const withdrawFunds = async (req, res) => {
  try {
    const { amount, bankCode, accountNumber, accountName, narration, pin, transactionPin, idempotencyKey, sessionId } = req.body;
    const activePin = pin !== undefined ? pin : transactionPin;
    const userId = req.user._id || req.user.id;
    const numAmount = Number(amount);

    console.log(`[WITHDRAW CONTROLLER HIT] userId: ${userId}, hasPin: ${activePin !== undefined && activePin !== ""}`);

    // 1. Mandatory User Loading & PIN Validation (Enforced FIRST before financial operations)
    const user = await User.findById(userId).select("+pinHash +pin");
    if (!user) {
      return res.status(404).json({ status: "fail", message: "User account not found." });
    }

    if (!user.isPinSet) {
      return res.status(400).json({ status: "fail", message: "Transaction PIN is required and must be set." });
    }

    if (activePin === undefined || activePin === null || String(activePin).trim() === "") {
      return res.status(400).json({ status: "fail", message: "Transaction PIN is required." });
    }

    const isPinValid = await user.matchPin(String(activePin).trim());
    if (!isPinValid) {
      return res.status(400).json({ status: "fail", message: "Invalid transaction PIN." });
    }

    // 2. Validate Amount
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ status: "fail", message: "Invalid withdrawal amount specified." });
    }

    // 3. Idempotency Guard Check
    const activeIdempotencyKey = idempotencyKey || req.headers?.["x-idempotency-key"];
    if (activeIdempotencyKey) {
      const existingTx = await Transaction.findOne({ idempotencyKey: activeIdempotencyKey, user: userId });
      if (existingTx) {
        return res.status(200).json({
          status: "success",
          message: "Transfer already processed",
          isIdempotent: true,
          data: {
            transaction: existingTx,
            balance: existingTx.balanceAfter
          }
        });
      }
    }

    // 4. Wallet & Balance Check
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({ status: "fail", message: "Wallet not found for this user." });
    }

    if (wallet.balance < numAmount) {
      return res.status(400).json({ status: "fail", message: "Insufficient funds in your Zorah wallet." });
    }

    console.log(`[PIN VALIDATION PASSED — CALLING XPRESS WITHDRAWAL] userId: ${userId}, amount: ₦${numAmount}`);

    // 5. Beneficiary Verification & Transfer Execution
    let resolvedAccountName = accountName || "Beneficiary";
    let xpressResponseData = null;
    let transferRef = `WDW-${Date.now()}-${uuidv4().substring(0, 8)}`;

    const hasSecretKey = !!process.env.XPRESS_WALLET_SECRET_KEY;
    if (hasSecretKey && process.env.NODE_ENV !== "test") {
      // 5a. Verify beneficiary account details
      try {
        const verifyRes = await axios.get(
          `${XPRESS_BASE_URL}/transfer/account/details?sortCode=${bankCode}&accountNumber=${accountNumber}`,
          {
            headers: { 
              Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
          }
        );
        if (verifyRes.data?.status && verifyRes.data?.account?.accountName) {
          resolvedAccountName = verifyRes.data.account.accountName;
        }
      } catch (verifyErr) {
        console.error("Account Verification Error:", verifyErr.response?.data || verifyErr.message);
        return res.status(400).json({ 
          status: "fail",
          message: verifyErr.response?.data?.message || "Could not verify beneficiary account details." 
        });
      }

      // 5b. Perform Customer External Bank Transfer via Xpress
      try {
        const response = await axios.post(
          `${XPRESS_BASE_URL}/transfer/bank/customer`,
          {
            customerId: wallet.xpressCustomerId,
            amount: numAmount,
            sortCode: bankCode,
            accountNumber,
            accountName: resolvedAccountName,
            narration: narration || "Withdrawal",
          },
          {
            headers: { 
              Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
          }
        );

        xpressResponseData = response.data;
        transferRef = response.data?.data?.reference || transferRef;
      } catch (transferErr) {
        console.error("External Bank Transfer Error:", transferErr.response?.data || transferErr.message);
        return res.status(500).json({
          status: "error",
          message: transferErr.response?.data?.message || "External bank transfer failed."
        });
      }
    }

    // 6. Double-Entry Ledger Updates & Snapshots
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - numAmount;

    wallet.balance = balanceAfter;
    wallet.ledgerBalance = (wallet.ledgerBalance || balanceBefore) - numAmount;
    await wallet.save();

    // 7. Record Transaction Ledger Document
    const trx = await Transaction.create({
      user: userId,
      wallet: wallet._id,
      type: "debit",
      amount: numAmount,
      purpose: "withdrawal",
      reference: transferRef,
      idempotencyKey: activeIdempotencyKey || undefined,
      sessionId: sessionId || undefined,
      balanceBefore,
      balanceAfter,
      status: "successful",
      merchantName: resolvedAccountName,
      originalNarration: narration || "Withdrawal",
      metadata: xpressResponseData || { bankCode, accountNumber, accountName: resolvedAccountName }
    });

    return res.status(200).json({
      status: "success",
      message: "Transfer successful",
      data: {
        transaction: trx,
        balance: wallet.balance,
        reference: transferRef
      }
    });

  } catch (err) {
    console.error("Withdrawal Error:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
  
  


// Get wallet balance (Authoritative read from MongoDB Wallet ledger)
export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(200).json({ status: "success", balance: 0, hasWallet: false, message: "KYC not completed. No wallet exists yet." });
    }
    
    // Return authoritative balance from MongoDB ledger
    return res.status(200).json({ status: "success", balance: wallet.balance, ledgerBalance: wallet.ledgerBalance || wallet.balance });
  } catch (error) {
    console.error("Fetch Balance Error:", error.message);
    return res.status(500).json({ status: "error", message: "Could not fetch balance", error: error.message });
  }
};

export const transferToCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  let isApiSuccessful = false;
  let apiResponseData = null;

  try {
    const { amount, toCustomerId, purpose, pin, idempotencyKey, sessionId, reference } = req.body;
    const fromUserId = req.user.id || req.user._id;
    const transferAmount = Number(amount);

    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({ status: "fail", message: "Invalid amount specified." });
    }

    // 1. Mandatory PIN Validation
    const user = await User.findById(fromUserId).select("+pinHash +pin");
    if (!user) {
      return res.status(404).json({ status: "fail", message: "User not found." });
    }

    if (!pin || !user.isPinSet) {
      return res.status(400).json({ status: "fail", message: "Transaction PIN is required and must be set." });
    }

    const isPinValid = await user.matchPin(pin);
    if (!isPinValid) {
      return res.status(400).json({ status: "fail", message: "Invalid transaction PIN." });
    }

    // 2. Idempotency Guard Check
    const activeIdempotencyKey = idempotencyKey || req.headers["x-idempotency-key"];
    if (activeIdempotencyKey) {
      const existingTx = await Transaction.findOne({ idempotencyKey: activeIdempotencyKey, user: fromUserId });
      if (existingTx) {
        return res.status(200).json({
          status: "success",
          message: "Transaction already processed",
          isIdempotent: true,
          data: {
            transaction: existingTx,
            reference: existingTx.reference
          }
        });
      }
    }

    session.startTransaction();

    // 3. Fetch Sender's Wallet Details (within transaction session)
    const fromWallet = await Wallet.findOne({ user: fromUserId }).session(session);
    if (!fromWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ status: "fail", message: "Sender wallet not found." });
    }

    // 4. Fetch Recipient's Wallet Details (within transaction session)
    const toWallet = await Wallet.findOne({ xpressCustomerId: toCustomerId }).session(session);
    if (!toWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ status: "fail", message: "Recipient wallet not found in Zorah records." });
    }

    // 5. Local Balance Check
    if (fromWallet.balance < transferAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: "fail", message: "Insufficient funds in your Zorah wallet." });
    }

    // 6. Xpress Wallet API Call (if configured and live)
    const hasSecretKey = !!process.env.XPRESS_WALLET_SECRET_KEY;
    let transferRef = reference || `TRF-${Date.now()}-${uuidv4().substring(0, 8)}`;

    if (hasSecretKey && process.env.NODE_ENV !== "test") {
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
          status: "fail",
          message: "External transfer service unavailable.",
          error: apiError.response?.data?.message || apiError.message
        });
      }

      if (!xpressResponse.data.status) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "Transfer declined by payment gateway.",
          error: xpressResponse.data.message
        });
      }

      isApiSuccessful = true;
      apiResponseData = xpressResponse.data;
      transferRef = apiResponseData.data?.reference || transferRef;
    }

    // 7. UPDATE SENDER: Record snapshots, update balance & ledgerBalance
    const senderBalanceBefore = fromWallet.balance;
    const senderBalanceAfter = senderBalanceBefore - transferAmount;

    fromWallet.balance = senderBalanceAfter;
    fromWallet.ledgerBalance = (fromWallet.ledgerBalance || senderBalanceBefore) - transferAmount;
    await fromWallet.save({ session });

    const [senderTx] = await Transaction.create([{
      user: fromUserId,
      wallet: fromWallet._id,
      type: "debit",
      amount: transferAmount,
      purpose: purpose || "transfer",
      reference: transferRef,
      idempotencyKey: activeIdempotencyKey || undefined,
      sessionId: sessionId || undefined,
      balanceBefore: senderBalanceBefore,
      balanceAfter: senderBalanceAfter,
      status: "successful",
      metadata: apiResponseData || { recipientName: toWallet.accountName }
    }], { session });

    // 8. UPDATE RECIPIENT: Credit balance & ledgerBalance, record transaction
    const recipientBalanceBefore = toWallet.balance;
    const recipientBalanceAfter = recipientBalanceBefore + transferAmount;

    toWallet.balance = recipientBalanceAfter;
    toWallet.ledgerBalance = (toWallet.ledgerBalance || recipientBalanceBefore) + transferAmount;
    await toWallet.save({ session });

    await Transaction.create([{
      user: toWallet.user,
      wallet: toWallet._id,
      type: "credit",
      amount: transferAmount,
      purpose: "transfer",
      reference: `${transferRef}-REC`,
      sessionId: sessionId || undefined,
      balanceBefore: recipientBalanceBefore,
      balanceAfter: recipientBalanceAfter,
      status: "successful",
      metadata: { senderName: fromWallet.accountName }
    }], { session });

    // Commit all MongoDB changes atomically
    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Transactional Transfer Successful: ${fromWallet.accountName} -> ${toWallet.accountName}`);

    return res.status(200).json({
      status: "success",
      message: `Successfully transferred ₦${transferAmount} to ${toWallet.accountName}`,
      data: {
        reference: transferRef,
        amount: transferAmount,
        balanceBefore: senderBalanceBefore,
        balanceAfter: senderBalanceAfter,
        transaction: senderTx
      }
    });

  } catch (error) {
    console.error("Transfer Controller DB/Commit Error:", error.message);
    
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    if (isApiSuccessful) {
      console.error(
        `🚨 CRITICAL LEDGER DESYNC: Xpress Wallet transfer succeeded but local MongoDB transaction failed to commit. ` +
        `API Response Reference: ${apiResponseData?.data?.reference}. Error: ${error.message}`
      );
      
      return res.status(500).json({
        status: "error",
        message: "Transfer succeeded at gateway but failed to record locally. Support has been notified.",
        reference: apiResponseData?.data?.reference
      });
    }

    return res.status(500).json({ 
      status: "error",
      message: "Internal transfer processing error", 
      error: error.message 
    });
  }
};


// Get paginated transaction history with filters
export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // 1. Extract query parameters & pagination limits
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { type, status, purpose, startDate, endDate } = req.query;

    // 2. Build dynamic query filters
    const filter = { user: userId };

    if (type) {
      filter.type = type;
    }
    if (status) {
      filter.status = status;
    }
    if (purpose) {
      filter.purpose = purpose;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // 3. Fetch count & paginated documents
    const [total, transactions] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("wallet", "accountNumber accountName bankName")
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      status: "success",
      data: {
        transactions,
        pagination: {
          total,
          page,
          pages,
          limit
        }
      }
    });
  } catch (error) {
    console.error("Get Transactions Error:", error.message);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

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

/**
 * Helper to resolve authoritative KYC status for mobile API output.
 * Authoritative field is KYC.status, with User.KycStatus as fallback.
 * Maps DB statuses ("approved"/"verified", "pending", "rejected", "unverified")
 * to the exact status strings supported by the mobile client contract.
 */
export const resolveKycStatus = (kycDoc, userDoc) => {
  const rawStatus = kycDoc?.status || userDoc?.KycStatus || "unverified";
  const normalized = String(rawStatus).trim().toLowerCase();

  if (normalized === "approved" || normalized === "verified") {
    return "verified";
  }
  if (normalized === "pending") {
    return "pending";
  }
  if (normalized === "rejected") {
    // Mobile UI KYC_STATUS_STYLES currently handles 'verified', 'pending', and falls back to 'unverified'
    return "unverified";
  }
  return "unverified";
};

export const getOverview = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // 1. Fetch all local data in parallel
    const [user, wallet, kyc, recentTransactions] = await Promise.all([
      User.findById(userId).select("name email biometricEnabled KycStatus"),
      Wallet.findOne({ user: userId }),
      KYC.findOne({ user: userId }),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    const resolvedStatus = resolveKycStatus(kyc, user);

    if (!wallet) {
      return res.status(200).json({ 
        success: true,
        hasWallet: false, 
        message: "Complete KYC to activate your wallet.",
        account: {
          balance: 0,
          currency: "NGN",
          accountNumber: "",
          accountName: "",
          tier: kyc?.tier || 0,
          xpressCustomerId: "",
          xpressWalletId: ""
        },
        kyc: {
          status: resolvedStatus,
          currentTier: kyc?.tier || 0
        },
        recentTransactions: [],
        chartData: [],
        userSettings: { 
          biometricEnabled: user?.biometricEnabled || false
        }
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
      hasWallet: true,
      account: {
        balance: wallet.balance,
        currency: wallet.currency || "NGN",
        accountNumber: wallet.accountNumber,
        accountName: wallet.accountName,
        tier: wallet.tier || kyc?.tier || 1,
        xpressCustomerId: wallet.xpressCustomerId,
        xpressWalletId: wallet.xpressWalletId
      },
      kyc: {
        status: resolvedStatus,
        currentTier: kyc?.tier || wallet.tier || 1
      },
      recentTransactions,
      chartData,
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

// 1. Bank List Fetcher
export const getBanksList = async (req, res) => {
  try {
    const response = await axios.get(
      `${XPRESS_BASE_URL}/transfer/banks`,
      {
        headers: { 
          Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
      }
    );
    return res.json({ success: true, banks: response.data?.banks || [] });
  } catch (err) {
    return res.status(500).json({ message: err.response?.data?.message || err.message });
  }
};

// 2. Standalone Name Enquiry
export const verifyBankAccount = async (req, res) => {
  try {
    const { bankCode, accountNumber } = req.query;
    if (!bankCode || !accountNumber) {
      return res.status(400).json({ message: "bankCode and accountNumber are required query parameters." });
    }

    const response = await axios.get(
      `${XPRESS_BASE_URL}/transfer/account/details?sortCode=${bankCode}&accountNumber=${accountNumber}`,
      {
        headers: { 
          Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
      }
    );

    if (response.data?.status && response.data?.account) {
      return res.json({ 
        success: true, 
        accountName: response.data.account.accountName,
        account: response.data.account
      });
    } else {
      return res.status(400).json({ message: "Could not resolve bank information." });
    }
  } catch (err) {
    return res.status(500).json({ message: err.response?.data?.message || err.message });
  }
};

// 3. P2P Recipient Lookup
export const lookupRecipient = async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier) {
      return res.status(400).json({ message: "identifier is a required query parameter." });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase().trim() },
        { phoneNumber: identifier.trim() }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Look up user's Wallet record
    const wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found for this user." });
    }

    return res.json({
      success: true,
      xpressCustomerId: wallet.xpressCustomerId,
      accountName: wallet.accountName,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Provisions a virtual bank account (NUBAN) via Xpress Wallet for the authenticated user.
 * Idempotent: returns existing account details with HTTP 200 if already provisioned.
 */
export const provisionVirtualAccount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // 1. Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "fail", message: "User not found." });
    }

    // 2. Check if user already has an active wallet with account details
    const existingWallet = await Wallet.findOne({ user: userId });
    if (existingWallet && existingWallet.accountNumber) {
      return res.status(200).json({
        status: "success",
        message: "Virtual account already provisioned",
        data: {
          accountNumber: existingWallet.accountNumber,
          accountName: existingWallet.accountName,
          bankName: existingWallet.bankName || "Providus Bank",
          xpressCustomerId: existingWallet.xpressCustomerId,
          xpressWalletId: existingWallet.xpressWalletId,
          tier: existingWallet.tier,
          balance: existingWallet.balance,
          currency: existingWallet.currency
        }
      });
    }

    // 3. Call xpressWalletService to provision / recover virtual account
    const accountResult = await createVirtualAccount({
      customerId: user.xpressCustomerId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth || "1995-05-15",
      userId: user._id
    });

    if (!accountResult.success || !accountResult.accountNumber) {
      return res.status(500).json({
        status: "error",
        message: "Failed to provision virtual bank account details from Xpress Wallet."
      });
    }

    // 4. Update or create Wallet document
    const wallet = await Wallet.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        name: "Zorah Wallet",
        accountType: "bank",
        accountNumber: accountResult.accountNumber,
        accountName: accountResult.accountName,
        bankName: accountResult.bankName || "Providus Bank",
        xpressCustomerId: accountResult.xpressCustomerId,
        xpressWalletId: accountResult.xpressWalletId,
        tier: 1,
        status: "active"
      },
      { new: true, upsert: true }
    );

    // 5. Update User document with walletId and xpressCustomerId
    await User.findByIdAndUpdate(userId, {
      walletId: accountResult.accountNumber,
      xpressCustomerId: accountResult.xpressCustomerId
    });

    return res.status(201).json({
      status: "success",
      message: "Virtual account created successfully",
      data: {
        accountNumber: wallet.accountNumber,
        accountName: wallet.accountName,
        bankName: wallet.bankName,
        xpressCustomerId: wallet.xpressCustomerId,
        xpressWalletId: wallet.xpressWalletId,
        tier: wallet.tier,
        balance: wallet.balance,
        currency: wallet.currency
      }
    });
  } catch (error) {
    console.error("❌ [provisionVirtualAccount Error]:", error.message);
    return res.status(500).json({
      status: "error",
      message: error.message || "Error provisioning virtual bank account"
    });
  }
};