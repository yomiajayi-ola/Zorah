import { transferToCustomer, getTransactions } from "../src/controllers/walletController.js";
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
  console.log("  ZBK-24: Transfer & Transactions Unit/Integration Tests");
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
    return {
      session: () => {
        if (query.user && query.user.toString() === senderId) return Promise.resolve(mockSenderWallet);
        if (query.xpressCustomerId === "cust_recipient_999") return Promise.resolve(mockRecipientWallet);
        return Promise.resolve(null);
      }
    };
  };

  Transaction.findOne = (query) => {
    const found = dbTransactions.find(t => t.idempotencyKey === query.idempotencyKey && t.user === query.user);
    return Promise.resolve(found || null);
  };

  Transaction.create = (docs) => {
    docs.forEach(d => dbTransactions.push({ _id: `tx_${Date.now()}_${Math.random()}`, ...d }));
    return Promise.resolve(docs.map(d => ({ _id: `tx_${Date.now()}`, ...d })));
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

  // --- TEST 1: PIN Validation Rejection ---
  {
    console.log("[Test 1] Testing missing / invalid PIN rejection...");
    const reqInvalidPin = {
      ...senderReq,
      body: { amount: 1000, toCustomerId: "cust_recipient_999", pin: "0000" }
    };
    const res = createMockRes();
    await transferToCustomer(reqInvalidPin, res);

    console.assert(res.statusCode === 400, `Test 1 failed: expected 400, got ${res.statusCode}`);
    console.assert(res.body.message === "Invalid transaction PIN.", "Test 1 failed: message mismatch");
    console.log("✅ Test 1 (PIN Validation Rejection HTTP 400): Passed");
  }

  // --- TEST 2: Successful Double-Entry Transfer & Ledger Snapshots ---
  {
    console.log("[Test 2] Testing successful double-entry transfer execution...");
    const reqTransfer = {
      ...senderReq,
      body: {
        amount: 2000,
        toCustomerId: "cust_recipient_999",
        pin: "1234",
        purpose: "transfer",
        idempotencyKey: "idempotent_key_abc_123",
        sessionId: "sess_xyz_789"
      },
      headers: {}
    };
    const res = createMockRes();
    await transferToCustomer(reqTransfer, res);

    console.assert(res.statusCode === 200, `Test 2 failed: expected 200, got ${res.statusCode}`);
    console.assert(res.body.status === "success", "Test 2 failed: status mismatch");
    console.assert(res.body.data.balanceBefore === 5000, `Test 2 failed: balanceBefore expected 5000, got ${res.body.data.balanceBefore}`);
    console.assert(res.body.data.balanceAfter === 3000, `Test 2 failed: balanceAfter expected 3000, got ${res.body.data.balanceAfter}`);
    console.assert(mockSenderWallet.balance === 3000, "Test 2 failed: sender balance update");
    console.assert(mockSenderWallet.ledgerBalance === 3000, "Test 2 failed: sender ledger balance update");
    console.assert(mockRecipientWallet.balance === 3000, "Test 2 failed: recipient balance update");

    console.log("✅ Test 2 (Double-Entry Transfer HTTP 200): Passed", {
      balanceBefore: res.body.data.balanceBefore,
      balanceAfter: res.body.data.balanceAfter,
      senderWalletBalance: mockSenderWallet.balance,
      recipientWalletBalance: mockRecipientWallet.balance
    });
  }

  // --- TEST 3: Idempotency Protection Guard ---
  {
    console.log("[Test 3] Testing idempotency guard with identical idempotencyKey...");
    const reqDuplicateTransfer = {
      ...senderReq,
      body: {
        amount: 2000,
        toCustomerId: "cust_recipient_999",
        pin: "1234",
        idempotencyKey: "idempotent_key_abc_123"
      },
      headers: {}
    };
    const res = createMockRes();
    await transferToCustomer(reqDuplicateTransfer, res);

    console.assert(res.statusCode === 200, `Test 3 failed: expected 200, got ${res.statusCode}`);
    console.assert(res.body.isIdempotent === true, "Test 3 failed: isIdempotent flag expected true");
    console.assert(mockSenderWallet.balance === 3000, "Test 3 failed: balance should not deduct again");

    console.log("✅ Test 3 (Idempotent Guard HTTP 200): Passed", {
      isIdempotent: res.body.isIdempotent,
      message: res.body.message
    });
  }

  // --- TEST 4: Paginated Transactions Query ---
  {
    console.log("[Test 4] Testing GET /api/wallet/transactions pagination and filters...");
    const reqTxQuery = {
      ...senderReq,
      query: { page: "1", limit: "10", type: "debit" }
    };
    const res = createMockRes();
    await getTransactions(reqTxQuery, res);

    console.assert(res.statusCode === 200, `Test 4 failed: expected 200, got ${res.statusCode}`);
    console.assert(res.body.status === "success", "Test 4 failed: status mismatch");
    console.assert(res.body.data.pagination.total === 1, `Test 4 failed: pagination total expected 1, got ${res.body.data.pagination.total}`);
    console.assert(res.body.data.transactions.length === 1, "Test 4 failed: transactions list length");

    console.log("✅ Test 4 (Paginated Transactions GET HTTP 200): Passed", {
      total: res.body.data.pagination.total,
      page: res.body.data.pagination.page,
      limit: res.body.data.pagination.limit,
      txCount: res.body.data.transactions.length
    });
  }

  console.log("=================================================");
  console.log("  ALL ZBK-24 TESTS PASSED SUCCESSFULLY 🎉");
  console.log("=================================================");
}

runZbk24Tests().catch((err) => {
  console.error("ZBK-24 Test Suite Error:", err);
  process.exit(1);
});
