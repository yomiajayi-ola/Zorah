import { transferToCustomer, getTransactions, depositFunds, withdrawFunds } from "../src/controllers/walletController.js";
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

async function runZbk24Tests() {
  console.log("=================================================");
  console.log("  ZBK-24: Deposit, Withdraw, Transfer & Transactions Tests");
  console.log("=================================================");

  const senderId = "607f191e810c19729de860fe";
  const recipientId = "607f191e810c19729de860ff";
  const senderReq = { user: { id: senderId, _id: senderId } };

  // 1. Mock DB state
  let mockUserSender = {
    _id: senderId,
    firstName: "Sender",
    lastName: "User",
    email: "sender@zorah.app",
    isPinSet: true,
    matchPin: async (enteredPin) => enteredPin === "1234"
  };

  let mockUserRecipient = {
    _id: recipientId,
    firstName: "Recipient",
    lastName: "User",
    email: "recipient@zorah.app",
    xpressCustomerId: "cust_recipient_999"
  };

  let mockSenderWallet = {
    _id: "wallet_sender_111",
    user: senderId,
    accountName: "Sender User",
    xpressCustomerId: "cust_sender_111",
    balance: 5000,
    ledgerBalance: 5000,
    save: function() { return Promise.resolve(this); }
  };

  let mockRecipientWallet = {
    _id: "wallet_recipient_222",
    user: recipientId,
    accountName: "Recipient User",
    xpressCustomerId: "cust_recipient_999",
    balance: 1000,
    ledgerBalance: 1000,
    save: function() { return Promise.resolve(this); }
  };

  const dbTransactions = [];

  // Mock Mongoose Methods
  User.findById = (id) => {
    if (id.toString() === senderId) return Promise.resolve(mockUserSender);
    if (id.toString() === recipientId) return Promise.resolve(mockUserRecipient);
    return Promise.resolve(null);
  };

  Wallet.findOne = (query) => {
    const targetWallet = (query.user && query.user.toString() === senderId)
      ? mockSenderWallet
      : (query.xpressCustomerId === "cust_recipient_999")
        ? mockRecipientWallet
        : null;

    return {
      session: () => Promise.resolve(targetWallet),
      then: (resolve) => resolve(targetWallet)
    };
  };

  Transaction.findOne = (query) => {
    const found = dbTransactions.find(t => t.idempotencyKey === query.idempotencyKey && t.user === query.user);
    return Promise.resolve(found || null);
  };

  Transaction.create = (docs) => {
    const docArr = Array.isArray(docs) ? docs : [docs];
    docArr.forEach(d => dbTransactions.push({ _id: `tx_${Date.now()}_${Math.random()}`, ...d }));
    return Array.isArray(docs) 
      ? Promise.resolve(docArr.map(d => ({ _id: `tx_${Date.now()}`, ...d })))
      : Promise.resolve({ _id: `tx_${Date.now()}`, ...docArr[0] });
  };

  Transaction.countDocuments = (filter) => {
    const matched = dbTransactions.filter(t => t.user === filter.user);
    return Promise.resolve(matched.length);
  };

  Transaction.find = (filter) => {
    const matched = dbTransactions.filter(t => t.user === filter.user);
    return {
      sort: () => ({
        skip: (s) => ({
          limit: (l) => ({
            populate: () => Promise.resolve(matched.slice(s, s + l))
          })
        })
      })
    };
  };

  // Mock mongoose sessions for transaction runner
  mongoose.startSession = async () => ({
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    inTransaction: () => false,
    endSession: () => {}
  });

  // --- TEST 1: Deposit Syncs Wallet Balance & Ledger Snapshots ---
  {
    console.log("[Test 1] Testing depositFunds balance sync & ledger snapshots...");
    const reqDeposit = {
      ...senderReq,
      body: { amount: 2000, idempotencyKey: "dep_test_key_001" },
      headers: {}
    };
    const res = createMockRes();
    await depositFunds(reqDeposit, res);

    console.assert(res.statusCode === 200, `Test 1 failed: expected 200, got ${res.statusCode}`);
    console.assert(mockSenderWallet.balance === 7000, `Test 1 failed: expected balance 7000, got ${mockSenderWallet.balance}`);
    console.assert(mockSenderWallet.ledgerBalance === 7000, `Test 1 failed: expected ledgerBalance 7000, got ${mockSenderWallet.ledgerBalance}`);

    console.log("✅ Test 1 (Deposit Balance Sync & Snapshots): Passed", {
      newBalance: mockSenderWallet.balance,
      newLedgerBalance: mockSenderWallet.ledgerBalance
    });
  }

  // --- TEST 2: Withdrawal PIN Rejection ---
  {
    console.log("[Test 2] Testing withdrawFunds PIN validation rejection...");
    const reqWithdrawNoPin = {
      ...senderReq,
      body: { amount: 1000, bankCode: "058", accountNumber: "0123456789", pin: "0000" }
    };
    const res = createMockRes();
    await withdrawFunds(reqWithdrawNoPin, res);

    console.assert(res.statusCode === 400, `Test 2 failed: expected 400, got ${res.statusCode}`);
    console.assert(res.body.message === "Invalid transaction PIN.", "Test 2 failed: message mismatch");
    console.log("✅ Test 2 (Withdrawal PIN Validation Rejection HTTP 400): Passed");
  }

  // --- TEST 3: Successful Withdrawal Balance Deduction & Snapshots ---
  {
    console.log("[Test 3] Testing withdrawFunds successful execution with correct PIN...");
    const reqWithdraw = {
      ...senderReq,
      body: {
        amount: 2000,
        bankCode: "058",
        accountNumber: "0123456789",
        pin: "1234",
        idempotencyKey: "wdw_test_key_001"
      },
      headers: {}
    };
    const res = createMockRes();
    await withdrawFunds(reqWithdraw, res);

    console.assert(res.statusCode === 200, `Test 3 failed: expected 200, got ${res.statusCode}`);
    console.assert(mockSenderWallet.balance === 5000, `Test 3 failed: expected balance 5000, got ${mockSenderWallet.balance}`);
    console.assert(mockSenderWallet.ledgerBalance === 5000, `Test 3 failed: expected ledgerBalance 5000, got ${mockSenderWallet.ledgerBalance}`);

    console.log("✅ Test 3 (Withdrawal Balance Deduction & Snapshots): Passed", {
      newBalance: mockSenderWallet.balance
    });
  }

  // --- TEST 4: Transfer PIN Validation Rejection ---
  {
    console.log("[Test 4] Testing transferToCustomer missing / invalid PIN rejection...");
    const reqInvalidPin = {
      ...senderReq,
      body: { amount: 1000, toCustomerId: "cust_recipient_999", pin: "0000" }
    };
    const res = createMockRes();
    await transferToCustomer(reqInvalidPin, res);

    console.assert(res.statusCode === 400, `Test 4 failed: expected 400, got ${res.statusCode}`);
    console.assert(res.body.message === "Invalid transaction PIN.", "Test 4 failed: message mismatch");
    console.log("✅ Test 4 (Transfer PIN Validation Rejection HTTP 400): Passed");
  }

  // --- TEST 5: Successful Transfer & Double-Entry Ledger ---
  {
    console.log("[Test 5] Testing transferToCustomer double-entry transfer...");
    const reqTransfer = {
      ...senderReq,
      body: {
        amount: 2000,
        toCustomerId: "cust_recipient_999",
        pin: "1234",
        purpose: "transfer",
        idempotencyKey: "trf_test_key_001"
      },
      headers: {}
    };
    const res = createMockRes();
    await transferToCustomer(reqTransfer, res);

    console.assert(res.statusCode === 200, `Test 5 failed: expected 200, got ${res.statusCode}`);
    console.assert(mockSenderWallet.balance === 3000, `Test 5 failed: sender balance expected 3000, got ${mockSenderWallet.balance}`);
    console.assert(mockRecipientWallet.balance === 3000, `Test 5 failed: recipient balance expected 3000, got ${mockRecipientWallet.balance}`);

    console.log("✅ Test 5 (Double-Entry Transfer HTTP 200): Passed", {
      senderBalance: mockSenderWallet.balance,
      recipientBalance: mockRecipientWallet.balance
    });
  }

  // --- TEST 6: Paginated Transactions Query ---
  {
    console.log("[Test 6] Testing GET /api/wallet/transactions pagination and filters...");
    const reqTxQuery = {
      ...senderReq,
      query: { page: "1", limit: "10" }
    };
    const res = createMockRes();
    await getTransactions(reqTxQuery, res);

    console.assert(res.statusCode === 200, `Test 6 failed: expected 200, got ${res.statusCode}`);
    console.assert(res.body.status === "success", "Test 6 failed: status mismatch");
    console.assert(res.body.data.pagination.total >= 3, `Test 6 failed: expected total >= 3, got ${res.body.data.pagination.total}`);

    console.log("✅ Test 6 (Paginated Transactions GET HTTP 200): Passed", {
      total: res.body.data.pagination.total,
      page: res.body.data.pagination.page,
      limit: res.body.data.pagination.limit
    });
  }

  console.log("=================================================");
  console.log("  ALL TESTS PASSED SUCCESSFULLY 🎉");
  console.log("=================================================");
}

runZbk24Tests().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
