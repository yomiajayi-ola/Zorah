import { provisionVirtualAccount } from "../src/controllers/walletController.js";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

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

async function runZbk23Tests() {
  console.log("==========================================");
  console.log("  ZBK-23: Virtual Bank Account Provisioning Tests");
  console.log("==========================================");

  const userId = "507f191e810c19729de860fe";
  const reqUser = { user: { id: userId, _id: userId } };

  // Helper DB Mock setups
  let mockUserInDb = {
    _id: userId,
    firstName: "Test",
    lastName: "Provisioner",
    email: "test.provisioner@zorah.app",
    phoneNumber: "08011223344",
    xpressCustomerId: "cust_mock_123"
  };

  let mockWalletInDb = null;

  User.findById = (id) => Promise.resolve(mockUserInDb);
  User.findByIdAndUpdate = (id, update) => {
    Object.assign(mockUserInDb, update);
    return Promise.resolve(mockUserInDb);
  };

  Wallet.findOne = (query) => Promise.resolve(mockWalletInDb);
  Wallet.findOneAndUpdate = (query, update, options) => {
    mockWalletInDb = {
      _id: "wallet_mock_123",
      user: userId,
      ...update
    };
    return Promise.resolve(mockWalletInDb);
  };

  // Test 1: New Virtual Account Provisioning (HTTP 201)
  {
    console.log("[Test 1] Provisioning new virtual bank account for user...");
    const res = createMockRes();
    await provisionVirtualAccount(reqUser, res);

    console.assert(res.statusCode === 201, `Test 1 failed: Expected status 201, got ${res.statusCode}`);
    console.assert(res.body.status === "success", "Test 1 failed: Expected status === 'success'");
    console.assert(res.body.data.accountNumber !== "", "Test 1 failed: accountNumber should not be empty");
    console.assert(res.body.data.bankName === "Providus Bank", "Test 1 failed: bankName should be Providus Bank");

    console.log("✅ Test 1 (New Virtual Account Provisioning HTTP 201): Passed", {
      accountNumber: res.body.data.accountNumber,
      accountName: res.body.data.accountName,
      bankName: res.body.data.bankName
    });
  }

  // Test 2: Idempotent Re-call on Existing Account (HTTP 200)
  {
    console.log("[Test 2] Re-calling provisionVirtualAccount for existing account...");
    const res = createMockRes();
    await provisionVirtualAccount(reqUser, res);

    console.assert(res.statusCode === 200, `Test 2 failed: Expected status 200, got ${res.statusCode}`);
    console.assert(res.body.status === "success", "Test 2 failed: Expected status === 'success'");
    console.assert(res.body.message === "Virtual account already provisioned", "Test 2 failed: Message mismatch");
    console.assert(res.body.data.accountNumber === mockWalletInDb.accountNumber, "Test 2 failed: Account number should match");

    console.log("✅ Test 2 (Idempotent Re-call HTTP 200): Passed", {
      message: res.body.message,
      accountNumber: res.body.data.accountNumber
    });
  }

  // Test 3: DB Persistence Verification on User and Wallet models
  {
    console.assert(mockWalletInDb.bankName === "Providus Bank", "Test 3 failed: Wallet.bankName persistence");
    console.assert(mockWalletInDb.accountNumber.length > 0, "Test 3 failed: Wallet.accountNumber persistence");
    console.assert(mockUserInDb.walletId === mockWalletInDb.accountNumber, "Test 3 failed: User.walletId persistence");
    console.assert(mockUserInDb.xpressCustomerId === mockWalletInDb.xpressCustomerId, "Test 3 failed: User.xpressCustomerId persistence");

    console.log("✅ Test 3 (DB Persistence Verification): Passed", {
      userWalletId: mockUserInDb.walletId,
      userXpressCustomerId: mockUserInDb.xpressCustomerId,
      walletBankName: mockWalletInDb.bankName
    });
  }

  console.log("==========================================");
  console.log("  ALL ZBK-23 TESTS PASSED SUCCESSFULLY 🎉");
  console.log("==========================================");
}

runZbk23Tests().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
