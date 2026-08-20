import axios from "axios";

const BASE_URL = "http://localhost:4000/api";

async function runLiveStagingVerification() {
  console.log("=================================================");
  console.log("  LIVE STAGING API VERIFICATION (http://localhost:4000/api)");
  console.log("=================================================");

  // 1. Authenticate or Login User
  console.log("\n[Step 1] Logging in test user to acquire JWT Token...");
  let token;
  let userId;
  
  const loginEmail = `live.test.${Date.now()}@zorah.app`;
  const loginPassword = "Password123!";

  try {
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: loginEmail,
      password: loginPassword,
      firstName: "LiveTest",
      lastName: "User",
      phoneNumber: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
      dateOfBirth: "1995-05-15"
    });
    token = registerRes.data.data?.token || registerRes.data.token;
  } catch (err) {
    console.error("Register Error:", err.response?.data || err.message);
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Set PIN for test user
  console.log("[Step 2] Setting 4-digit transaction PIN (1234)...");
  try {
    await axios.post(`${BASE_URL}/auth/set-pin`, { pin: "1234" }, { headers: authHeaders });
  } catch (pinErr) {
    console.error("Set PIN Error:", pinErr.response?.data || pinErr.message);
  }

  // 3. Provision Virtual Account to initialize wallet
  console.log("[Step 3] Provisioning virtual account to initialize wallet...");
  try {
    const vaRes = await axios.post(`${BASE_URL}/wallet/virtual-account`, { dateOfBirth: "1995-05-15" }, { headers: authHeaders });
    console.log("Virtual Account Provisioned:", vaRes.data?.data?.accountNumber);
  } catch (vErr) {
    console.warn("Virtual Account Provision Warning:", vErr.response?.data?.message || vErr.message);
  }

  // Also create a recipient user for C2C transfer
  console.log("[Step 4] Provisioning recipient user for C2C transfer...");
  let recipientCustomerId;
  try {
    const recEmail = `recipient.test.${Date.now()}@zorah.app`;
    const recRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: recEmail,
      password: loginPassword,
      firstName: "Recipient",
      lastName: "User",
      phoneNumber: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
      dateOfBirth: "1995-05-15"
    });
    const recToken = recRes.data.data?.token || recRes.data.token;
    const recVa = await axios.post(`${BASE_URL}/wallet/virtual-account`, { dateOfBirth: "1995-05-15" }, { headers: { Authorization: `Bearer ${recToken}` } });
    recipientCustomerId = recVa.data.data?.xpressCustomerId;
  } catch (recErr) {
    console.warn("Recipient Setup Warning:", recErr.response?.data?.message || recErr.message);
  }

  // --- SECTION A: DEPOSIT -> OVERVIEW -> C2C TRANSFER ---
  console.log("\n--- SECTION A: DEPOSIT -> OVERVIEW -> C2C TRANSFER ---");
  
  // A1. Deposit ₦500
  console.log("A1. Calling POST /api/wallet/deposit (₦500)...");
  const depRes = await axios.post(`${BASE_URL}/wallet/deposit`, { amount: 500 }, { headers: authHeaders });
  console.log("Deposit Response:", depRes.status, depRes.data);

  // A2. Immediately call getOverview and getWalletBalance
  console.log("A2. Calling GET /api/wallet/overview and GET /api/wallet/balance...");
  const ovRes = await axios.get(`${BASE_URL}/wallet/overview`, { headers: authHeaders });
  const balRes = await axios.get(`${BASE_URL}/wallet/balance`, { headers: authHeaders });
  console.log("Overview Balance:", ovRes.data.account?.balance);
  console.log("GetBalance Endpoint Result:", balRes.data.balance);

  // A3. Immediately perform C2C Transfer of ₦50
  console.log("A3. Immediately calling POST /api/wallet/transfer (₦50)...");
  let transferSuccess = false;
  try {
    const trfRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50,
      toCustomerId: recipientCustomerId || "cust_mock_recipient",
      pin: "1234",
      purpose: "transfer"
    }, { headers: authHeaders });
    
    console.log("C2C Transfer Response:", trfRes.status, trfRes.data);
    transferSuccess = trfRes.data?.status === "success" || trfRes.data?.success === true;
  } catch (trfErr) {
    console.error("❌ C2C Transfer Failed:", trfErr.response?.data || trfErr.message);
  }

  // --- SECTION B: WITHDRAWAL PIN ENFORCEMENT ---
  console.log("\n--- SECTION B: WITHDRAWAL PIN ENFORCEMENT ---");

  // B1. No PIN
  console.log("B1. Calling POST /api/wallet/withdraw with NO PIN...");
  let noPinPassed = false;
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 100,
      bankCode: "058",
      accountNumber: "0123456789"
    }, { headers: authHeaders });
    console.error("❌ ERROR: Withdrawal with NO PIN succeeded!");
  } catch (err) {
    console.log("B1 Response (No PIN):", err.response?.status, err.response?.data);
    noPinPassed = err.response?.status === 400 && err.response?.data?.status === "fail";
  }

  // B2. Empty PIN
  console.log("B2. Calling POST /api/wallet/withdraw with EMPTY PIN...");
  let emptyPinPassed = false;
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 100,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: ""
    }, { headers: authHeaders });
    console.error("❌ ERROR: Withdrawal with EMPTY PIN succeeded!");
  } catch (err) {
    console.log("B2 Response (Empty PIN):", err.response?.status, err.response?.data);
    emptyPinPassed = err.response?.status === 400 && err.response?.data?.status === "fail";
  }

  // B3. Incorrect PIN
  console.log("B3. Calling POST /api/wallet/withdraw with INCORRECT PIN...");
  let wrongPinPassed = false;
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 100,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: "9999"
    }, { headers: authHeaders });
    console.error("❌ ERROR: Withdrawal with WRONG PIN succeeded!");
  } catch (err) {
    console.log("B3 Response (Wrong PIN):", err.response?.status, err.response?.data);
    wrongPinPassed = err.response?.status === 400 && err.response?.data?.status === "fail";
  }

  // B4. Correct PIN
  console.log("B4. Calling POST /api/wallet/withdraw with CORRECT PIN...");
  let correctPinPassed = false;
  try {
    const wdwRes = await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 100,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: "1234"
    }, { headers: authHeaders });
    console.log("B4 Response (Correct PIN):", wdwRes.status, wdwRes.data);
    correctPinPassed = wdwRes.status === 200 && wdwRes.data?.status === "success";
  } catch (err) {
    console.error("B4 Response Error:", err.response?.data || err.message);
  }

  console.log("\n=================================================");
  console.log("  LIVE VERIFICATION SUMMARY");
  console.log("=================================================");
  console.log(`Deposit -> C2C Transfer: ${transferSuccess ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`Withdraw No PIN (400): ${noPinPassed ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`Withdraw Empty PIN (400): ${emptyPinPassed ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`Withdraw Wrong PIN (400): ${wrongPinPassed ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`Withdraw Correct PIN (200): ${correctPinPassed ? "PASS ✅" : "FAIL ❌"}`);
}

runLiveStagingVerification().catch((err) => {
  console.error("Live Verification Unhandled Error:", err.message);
});
