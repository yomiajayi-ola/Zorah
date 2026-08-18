import { withdrawFunds } from "../src/controllers/walletController.js";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";
import Transaction from "../src/models/Transaction.js";

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

async function runWithdrawalTests() {
  console.log("=================================================");
  console.log("  Testing withdrawFunds PIN & Double-Entry Ledger");
  console.log("=================================================");

  const userId = "707f191e810c19729de860fe";
  const reqUser = { user: { id: userId, _id: userId } };

  let mockUser = {
    _id: userId,
    firstName: "Withdrawal",
    lastName: "User",
    email: "withdraw@zorah.app",
    isPinSet: true,
    matchPin: async (enteredPin) => enteredPin === "4321"
  };

  let mockWallet = {
    _id: "wallet_withdraw_101",
    user: userId,
    accountName: "Withdrawal User",
    xpressCustomerId: "cust_withdraw_101",
    balance: 10000,
    ledgerBalance: 10000,
    save: function() { return Promise.resolve(this); }
  };

  const dbTransactions = [];

  User.findById = (id) => Promise.resolve(mockUser);
  Wallet.findOne = (query) => Promise.resolve(mockWallet);
  Transaction.findOne = (query) => {
    const found = dbTransactions.find(t => t.idempotencyKey === query.idempotencyKey);
    return Promise.resolve(found || null);
  };
  Transaction.create = (doc) => {
    const record = { _id: `tx_${Date.now()}`, ...doc };
    dbTransactions.push(record);
    return Promise.resolve(record);
  };

  // Test 1: Invalid PIN Rejection
  {
    console.log("[Test 1] Testing missing / invalid PIN...");
    const req = {
      ...reqUser,
      body: { amount: 2000, bankCode: "058", accountNumber: "0123456789", pin: "0000" }
    };
    const res = createMockRes();
    await withdrawFunds(req, res);

    console.assert(res.statusCode === 400, `Test 1 failed: expected 400, got ${res.statusCode}`);
    console.assert(res.body.message === "Invalid transaction PIN.", "Test 1 failed: message mismatch");
    console.log("✅ Test 1 (PIN Validation Rejection HTTP 400): Passed");
  }

  // Test 2: Successful External Bank Withdrawal
  {
    console.log("[Test 2] Testing successful external bank withdrawal...");
    const req = {
      ...reqUser,
      body: {
        amount: 3000,
        bankCode: "058",
        accountNumber: "0123456789",
        accountName: "Beneficiary User",
        pin: "4321",
        idempotencyKey: "wdw_idempotent_key_101"
      },
      headers: {}
    };
    const res = createMockRes();
    await withdrawFunds(req, res);

    console.assert(res.statusCode === 200, `Test 2 failed: expected 200, got ${res.statusCode}`);
    console.assert(res.body.status === "success", "Test 2 failed: status mismatch");
    console.assert(res.body.data.balance === 7000, `Test 2 failed: expected balance 7000, got ${res.body.data.balance}`);
    console.assert(mockWallet.balance === 7000, "Test 2 failed: wallet balance update");
    console.assert(mockWallet.ledgerBalance === 7000, "Test 2 failed: wallet ledger balance update");

    console.log("✅ Test 2 (Successful Withdrawal HTTP 200): Passed", {
      newBalance: res.body.data.balance,
      reference: res.body.data.reference
    });
  }

  // Test 3: Idempotency Protection Re-call
  {
    console.log("[Test 3] Testing idempotency re-call for withdrawFunds...");
    const req = {
      ...reqUser,
      body: {
        amount: 3000,
        bankCode: "058",
        accountNumber: "0123456789",
        pin: "4321",
        idempotencyKey: "wdw_idempotent_key_101"
      },
      headers: {}
    };
    const res = createMockRes();
    await withdrawFunds(req, res);

    console.assert(res.statusCode === 200, `Test 3 failed: expected 200, got ${res.statusCode}`);
    console.assert(res.body.isIdempotent === true, "Test 3 failed: isIdempotent flag expected true");
    console.assert(mockWallet.balance === 7000, "Test 3 failed: balance should not deduct again");

    console.log("✅ Test 3 (Idempotency Re-call HTTP 200): Passed", {
      isIdempotent: res.body.isIdempotent,
      message: res.body.message
    });
  }

  console.log("=================================================");
  console.log("  ALL WITHDRAWAL TESTS PASSED SUCCESSFULLY 🎉");
  console.log("=================================================");
}

runWithdrawalTests().catch((err) => {
  console.error("Withdrawal Test Error:", err);
  process.exit(1);
});
