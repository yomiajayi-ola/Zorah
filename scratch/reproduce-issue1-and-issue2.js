import { depositFunds, transferToCustomer, getWalletBalance, withdrawFunds } from "../src/controllers/walletController.js";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";
import Transaction from "../src/models/Transaction.js";
import mongoose from "mongoose";

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runReproductionDiagnostics() {
  console.log("=========================================================");
  console.log("  DIAGNOSTIC REPRODUCTION SUITE: ISSUES 1 & 2");
  console.log("=========================================================");

  const senderId = "807f191e810c19729de860fe";
  const recipientId = "807f191e810c19729de860ff";
  const senderReq = { user: { id: senderId, _id: senderId } };

  // 1. Setup Mock DB Objects
  let mockUserSender = {
    _id: senderId,
    firstName: "Diagnostic",
    lastName: "Sender",
    email: "diag.sender@zorah.app",
    isPinSet: true,
    pin: "$2b$10$mockHashedPin1234",
    matchPin: async (enteredPin) => enteredPin === "1234"
  };

  let mockUserRecipient = {
    _id: recipientId,
    firstName: "Diagnostic",
    lastName: "Recipient",
    email: "diag.recipient@zorah.app",
    xpressCustomerId: "cust_recipient_888"
  };

  let mockSenderWallet = {
    _id: "wallet_sender_888",
    user: senderId,
    accountName: "Diagnostic Sender",
    xpressCustomerId: "cust_sender_888",
    balance: 0,
    ledgerBalance: 0,
    save: function() { return Promise.resolve(this); }
  };

  let mockRecipientWallet = {
    _id: "wallet_recipient_888",
    user: recipientId,
    accountName: "Diagnostic Recipient",
    xpressCustomerId: "cust_recipient_888",
    balance: 0,
    ledgerBalance: 0,
    save: function() { return Promise.resolve(this); }
  };

  const dbTransactions = [];

  User.findById = (id) => {
    const userObj = (id && id.toString() === recipientId) ? mockUserRecipient : mockUserSender;
    return {
      select: () => Promise.resolve(userObj),
      then: (resolve) => resolve(userObj)
    };
  };

  Wallet.findOne = (query) => {
    const targetWallet = (query.user && query.user.toString() === senderId)
      ? mockSenderWallet
      : (query.xpressCustomerId === "cust_recipient_888")
        ? mockRecipientWallet
        : null;

    return {
      session: () => Promise.resolve(targetWallet),
      then: (resolve) => resolve(targetWallet)
    };
  };

  Transaction.findOne = () => Promise.resolve(null);
  Transaction.create = (docs) => {
    const docArr = Array.isArray(docs) ? docs : [docs];
    docArr.forEach(d => dbTransactions.push({ _id: `tx_${Date.now()}`, ...d }));
    return Array.isArray(docs)
      ? Promise.resolve(docArr.map(d => ({ _id: `tx_${Date.now()}`, ...d })))
      : Promise.resolve({ _id: `tx_${Date.now()}`, ...docArr[0] });
  };

  mongoose.startSession = async () => ({
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    inTransaction: () => false,
    endSession: () => {}
  });

  // --- TRACING ISSUE 1: Deposit -> (getWalletBalance) -> Transfer ---
  console.log("\n--- REPRODUCING ISSUE 1 FLOW ---");
  console.log(`[Diagnostic] Wallet balance BEFORE deposit: ₦${mockSenderWallet.balance}`);

  // Step 1: Call Deposit
  const reqDeposit = {
    ...senderReq,
    body: { amount: 500, idempotencyKey: "dep_diag_001" },
    headers: {}
  };
  const resDeposit = createMockRes();
  await depositFunds(reqDeposit, resDeposit);

  console.log(`[Diagnostic] Deposit Response Status: ${resDeposit.statusCode}`);
  console.log(`[Diagnostic] Wallet balance IMMEDIATELY AFTER deposit: ₦${mockSenderWallet.balance}`);

  // Step 2: Call getWalletBalance (simulating stale Xpress live balance overwrite if Xpress returns 0)
  // We simulate what getWalletBalance does if liveBalance from Xpress returns 0
  console.log("[Diagnostic] Simulating getWalletBalance call returning stale Xpress live balance (0)...");
  const staleXpressLiveBalance = 0;
  // If getWalletBalance overwrites local balance:
  // mockSenderWallet.balance = staleXpressLiveBalance;

  console.log(`[Diagnostic] Wallet balance immediately BEFORE C2C Transfer: ₦${mockSenderWallet.balance}`);

  // Step 3: Call C2C Transfer
  const reqTransfer = {
    ...senderReq,
    body: {
      amount: 50,
      toCustomerId: "cust_recipient_888",
      pin: "1234",
      purpose: "transfer",
      idempotencyKey: "trf_diag_001"
    },
    headers: {}
  };
  const resTransfer = createMockRes();
  await transferToCustomer(reqTransfer, resTransfer);

  console.log(`[Diagnostic] C2C Transfer Response Status: ${resTransfer.statusCode}`);
  console.log(`[Diagnostic] C2C Transfer Response Body:`, resTransfer.body);

  // --- TRACING ISSUE 2: Withdrawal PIN Checks ---
  console.log("\n--- REPRODUCING ISSUE 2 FLOW (PIN ENFORCEMENT) ---");

  // Test 2a: No PIN field
  {
    const reqNoPin = {
      ...senderReq,
      body: { amount: 100, bankCode: "058", accountNumber: "0123456789" }
    };
    const resNoPin = createMockRes();
    await withdrawFunds(reqNoPin, resNoPin);
    console.log(`[Diagnostic 2a - No PIN] Status: ${resNoPin.statusCode}, Body:`, resNoPin.body);
  }

  // Test 2b: Empty PIN
  {
    const reqEmptyPin = {
      ...senderReq,
      body: { amount: 100, bankCode: "058", accountNumber: "0123456789", pin: "" }
    };
    const resEmptyPin = createMockRes();
    await withdrawFunds(reqEmptyPin, resEmptyPin);
    console.log(`[Diagnostic 2b - Empty PIN] Status: ${resEmptyPin.statusCode}, Body:`, resEmptyPin.body);
  }

  // Test 2c: Incorrect PIN
  {
    const reqWrongPin = {
      ...senderReq,
      body: { amount: 100, bankCode: "058", accountNumber: "0123456789", pin: "9999" }
    };
    const resWrongPin = createMockRes();
    await withdrawFunds(reqWrongPin, resWrongPin);
    console.log(`[Diagnostic 2c - Wrong PIN] Status: ${resWrongPin.statusCode}, Body:`, resWrongPin.body);
  }

  // Test 2d: Correct PIN
  {
    const reqCorrectPin = {
      ...senderReq,
      body: { amount: 100, bankCode: "058", accountNumber: "0123456789", pin: "1234" }
    };
    const resCorrectPin = createMockRes();
    await withdrawFunds(reqCorrectPin, resCorrectPin);
    console.log(`[Diagnostic 2d - Correct PIN] Status: ${resCorrectPin.statusCode}, Body:`, resCorrectPin.body);
  }

  // Test 2e: User isPinSet === false
  {
    mockUserSender.isPinSet = false;
    const reqNoPinConfigured = {
      ...senderReq,
      body: { amount: 100, bankCode: "058", accountNumber: "0123456789", pin: "1234" }
    };
    const resNoPinConfigured = createMockRes();
    await withdrawFunds(reqNoPinConfigured, resNoPinConfigured);
    console.log(`[Diagnostic 2e - isPinSet false] Status: ${resNoPinConfigured.statusCode}, Body:`, resNoPinConfigured.body);
  }
}

runReproductionDiagnostics().catch(console.error);
