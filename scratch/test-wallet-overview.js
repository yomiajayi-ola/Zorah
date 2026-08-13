import { getOverview, resolveKycStatus } from "../src/controllers/walletController.js";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";
import KYC from "../src/models/Kyc.js";
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

async function runOverviewTests() {
  console.log("--- START GET OVERVIEW BACKEND TESTS ---");

  // Test resolveKycStatus unit function
  {
    console.assert(resolveKycStatus(null, null) === "unverified", "Status Unit Test 1 Failed");
    console.assert(resolveKycStatus({ status: "approved" }, null) === "verified", "Status Unit Test 2 Failed");
    console.assert(resolveKycStatus({ status: "pending" }, null) === "pending", "Status Unit Test 3 Failed");
    console.assert(resolveKycStatus({ status: "rejected" }, null) === "unverified", "Status Unit Test 4 Failed");
    console.assert(resolveKycStatus(null, { KycStatus: "verified" }) === "verified", "Status Unit Test 5 Failed");
    console.assert(resolveKycStatus(null, { KycStatus: "pending" }) === "pending", "Status Unit Test 6 Failed");
    console.log("✅ Unit Test (resolveKycStatus): Passed");
  }

  const userId = "507f191e810c19729de860ea";
  const reqUser = { user: { id: userId, _id: userId } };

  // Helper to mock DB calls for a test scenario
  const setupDbMocks = ({ userDoc, walletDoc, kycDoc, transactions = [] }) => {
    User.findById = (id) => ({
      select: (fields) => Promise.resolve(userDoc)
    });
    Wallet.findOne = (query) => Promise.resolve(walletDoc);
    KYC.findOne = (query) => Promise.resolve(kycDoc);
    Transaction.find = (query) => ({
      sort: () => ({
        limit: () => Promise.resolve(transactions)
      })
    });
  };

  // Scenario 1: New user — no KYC, no Wallet
  {
    setupDbMocks({
      userDoc: { _id: userId, name: "New User", email: "new@test.com", KycStatus: "unverified", biometricEnabled: false },
      walletDoc: null,
      kycDoc: null
    });

    const res = createMockRes();
    await getOverview(reqUser, res);
    const body = res.body;

    console.assert(res.statusCode === 200, "Scenario 1 failed: status code 200");
    console.assert(body.success === true, "Scenario 1 failed: success");
    console.assert(body.hasWallet === false, "Scenario 1 failed: hasWallet === false");
    console.assert(body.kyc.status === "unverified", "Scenario 1 failed: kyc.status === unverified");
    console.assert(body.kyc.currentTier === 0, "Scenario 1 failed: kyc.currentTier === 0");
    console.assert(typeof body.account === "object" && body.account !== null, "Scenario 1 failed: account is non-null object");
    console.assert(body.account.accountName === "", "Scenario 1 failed: accountName is empty string");
    console.assert(Array.isArray(body.recentTransactions), "Scenario 1 failed: recentTransactions is array");
    console.assert(Array.isArray(body.chartData), "Scenario 1 failed: chartData is array");
    console.assert(typeof body.userSettings === "object", "Scenario 1 failed: userSettings is object");

    console.log("✅ Scenario 1 (New User - no KYC, no Wallet): Passed", {
      hasWallet: body.hasWallet,
      kycStatus: body.kyc.status,
      accountName: body.account.accountName
    });
  }

  // Scenario 2: KYC pending (No Wallet yet)
  {
    setupDbMocks({
      userDoc: { _id: userId, name: "Pending User", email: "pending@test.com", KycStatus: "pending", biometricEnabled: false },
      walletDoc: null,
      kycDoc: { status: "pending", tier: 1 }
    });

    const res = createMockRes();
    await getOverview(reqUser, res);
    const body = res.body;

    console.assert(body.hasWallet === false, "Scenario 2 failed: hasWallet === false");
    console.assert(body.kyc.status === "pending", "Scenario 2 failed: kyc.status === pending");
    console.assert(body.kyc.currentTier === 1, "Scenario 2 failed: kyc.currentTier === 1");
    console.assert(typeof body.account === "object" && body.account !== null, "Scenario 2 failed: account is non-null object");

    console.log("✅ Scenario 2 (KYC Pending, no Wallet): Passed", {
      hasWallet: body.hasWallet,
      kycStatus: body.kyc.status
    });
  }

  // Scenario 3: KYC approved + Wallet exists
  {
    setupDbMocks({
      userDoc: { _id: userId, name: "Verified User", email: "verified@test.com", KycStatus: "verified", biometricEnabled: true },
      walletDoc: { balance: 5000, accountNumber: "1234567890", accountName: "Verified User", tier: 1, xpressCustomerId: "cust_1", xpressWalletId: "wall_1" },
      kycDoc: { status: "approved", tier: 1 }
    });

    const res = createMockRes();
    await getOverview(reqUser, res);
    const body = res.body;

    console.assert(body.hasWallet === true, "Scenario 3 failed: hasWallet === true");
    console.assert(body.kyc.status === "verified", "Scenario 3 failed: kyc.status === verified");
    console.assert(body.account.balance === 5000, "Scenario 3 failed: balance");
    console.assert(body.account.accountNumber === "1234567890", "Scenario 3 failed: accountNumber");
    console.assert(body.userSettings.biometricEnabled === true, "Scenario 3 failed: biometricEnabled");

    console.log("✅ Scenario 3 (KYC Approved + Active Wallet): Passed", {
      hasWallet: body.hasWallet,
      kycStatus: body.kyc.status,
      accountNumber: body.account.accountNumber
    });
  }

  // Scenario 4: KYC rejected
  {
    setupDbMocks({
      userDoc: { _id: userId, name: "Rejected User", email: "rejected@test.com", KycStatus: "rejected", biometricEnabled: false },
      walletDoc: null,
      kycDoc: { status: "rejected", tier: 1 }
    });

    const res = createMockRes();
    await getOverview(reqUser, res);
    const body = res.body;

    console.assert(body.hasWallet === false, "Scenario 4 failed: hasWallet === false");
    console.assert(body.kyc.status === "unverified", "Scenario 4 failed: kyc.status === unverified");

    console.log("✅ Scenario 4 (KYC Rejected): Passed", {
      hasWallet: body.hasWallet,
      kycStatus: body.kyc.status
    });
  }

  // Scenario 5: Existing wallet + Tier upgrade pending
  {
    setupDbMocks({
      userDoc: { _id: userId, name: "Upgrading User", email: "upgrading@test.com", KycStatus: "pending", biometricEnabled: false },
      walletDoc: { balance: 2500, accountNumber: "0987654321", accountName: "Upgrading User", tier: 1, xpressCustomerId: "cust_2", xpressWalletId: "wall_2" },
      kycDoc: { status: "pending", tier: 2 }
    });

    const res = createMockRes();
    await getOverview(reqUser, res);
    const body = res.body;

    console.assert(body.hasWallet === true, "Scenario 5 failed: hasWallet === true");
    console.assert(body.kyc.status === "pending", "Scenario 5 failed: kyc.status === pending");
    console.assert(body.kyc.currentTier === 2, "Scenario 5 failed: kyc.currentTier === 2");
    console.assert(body.account.accountNumber === "0987654321", "Scenario 5 failed: accountNumber");

    console.log("✅ Scenario 5 (Existing Wallet + Tier Upgrade Pending): Passed", {
      hasWallet: body.hasWallet,
      kycStatus: body.kyc.status,
      currentTier: body.kyc.currentTier
    });
  }

  // Scenario 6: Missing KYC document but User.KycStatus exists
  {
    setupDbMocks({
      userDoc: { _id: userId, name: "Legacy User", email: "legacy@test.com", KycStatus: "verified", biometricEnabled: false },
      walletDoc: { balance: 1000, accountNumber: "1122334455", accountName: "Legacy User", tier: 1 },
      kycDoc: null
    });

    const res = createMockRes();
    await getOverview(reqUser, res);
    const body = res.body;

    console.assert(body.hasWallet === true, "Scenario 6 failed: hasWallet === true");
    console.assert(body.kyc.status === "verified", "Scenario 6 failed: kyc.status === verified");

    console.log("✅ Scenario 6 (Missing KYC document, User.KycStatus fallback): Passed", {
      hasWallet: body.hasWallet,
      kycStatus: body.kyc.status
    });
  }

  console.log("--- ALL GET OVERVIEW BACKEND TESTS PASSED ---");
}

runOverviewTests().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
