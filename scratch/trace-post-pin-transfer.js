import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

const BASE_URL = "http://localhost:4000/api";
const MONGO_URI = "mongodb+srv://zorah:XYxPJUTqD4uYPoNi@cluster0.zptofjn.mongodb.net/zorah_staging";

async function tracePostPinTransfer() {
  console.log("=================================================");
  console.log("  TRACE POST-PIN TRANSFER FLOW & VERIFY ENDPOINT");
  console.log("=================================================");

  await mongoose.connect(MONGO_URI);

  // 1. Setup Test Users
  const senderEmail = "trace.sender@zorah.app";
  const recipientEmail = "trace.recipient@zorah.app";

  let senderUser = await User.findOne({ email: senderEmail });
  if (!senderUser) {
    senderUser = await User.create({
      firstName: "TraceSender",
      lastName: "User",
      email: senderEmail,
      password: "Password123!",
      isPinSet: true,
      pinHash: await bcrypt.hash("1234", 10)
    });
  } else {
    senderUser.isPinSet = true;
    senderUser.pinHash = await bcrypt.hash("1234", 10);
    await senderUser.save();
  }

  let recipientUser = await User.findOne({ email: recipientEmail });
  if (!recipientUser) {
    recipientUser = await User.create({
      firstName: "TraceRecipient",
      lastName: "User",
      email: recipientEmail,
      password: "Password123!"
    });
  }

  // 2. Setup Wallets in DB
  const senderCustId = "cust_trace_sender_123";
  const recipientCustId = "cust_trace_recipient_456";

  let senderWallet = await Wallet.findOne({ user: senderUser._id });
  if (!senderWallet) {
    senderWallet = await Wallet.create({
      user: senderUser._id,
      accountName: "TraceSender User",
      accountNumber: "7771112223",
      xpressCustomerId: senderCustId,
      balance: 10000,
      ledgerBalance: 10000
    });
  } else {
    senderWallet.balance = 10000;
    senderWallet.ledgerBalance = 10000;
    await senderWallet.save();
  }

  let recipientWallet = await Wallet.findOne({ xpressCustomerId: recipientCustId });
  if (!recipientWallet) {
    recipientWallet = await Wallet.create({
      user: recipientUser._id,
      accountName: "TraceRecipient User",
      accountNumber: "7774445556",
      xpressCustomerId: recipientCustId,
      balance: 1000,
      ledgerBalance: 1000
    });
  }

  // 3. Login Sender to get token
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: senderEmail,
    password: "Password123!"
  });
  const token = loginRes.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // TEST 1: No PIN -> 400
  console.log("\n[Test 1] Transfer with NO PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId
    }, { headers });
  } catch (err) {
    console.log(`Test 1 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // TEST 2: Wrong PIN -> 400
  console.log("\n[Test 2] Transfer with WRONG PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "9999"
    }, { headers });
  } catch (err) {
    console.log(`Test 2 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // TEST 3: Correct PIN + Recipient Not In Local DB -> 404
  console.log("\n[Test 3] Transfer to non-existent recipient in DB...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: "non_existent_cust_id",
      pin: "1234"
    }, { headers });
  } catch (err) {
    console.log(`Test 3 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // TEST 4: Correct PIN + Insufficient Funds -> 400
  console.log("\n[Test 4] Transfer with Insufficient Balance (₦50,000)...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50000,
      toCustomerId: recipientCustId,
      pin: "1234"
    }, { headers });
  } catch (err) {
    console.log(`Test 4 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // TEST 5: Correct PIN + Non-existent Customer in Xpress API -> 502
  console.log("\n[Test 5] Transfer with Correct PIN + Fake Xpress Customer IDs...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "1234",
      purpose: "test post-pin transfer"
    }, { headers });
  } catch (err) {
    console.log(`Test 5 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // TEST 6: Idempotency Key Repeated Test
  console.log("\n[Test 6] Idempotency Key repeat check...");
  const testIdempotencyKey = `idem_trace_${Date.now()}`;
  try {
    // First call (will get 502 if xpress customer is missing)
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "1234",
      idempotencyKey: testIdempotencyKey
    }, { headers });
  } catch (err) {
    console.log("Test 6 Call 1 Result:", err.response?.data?.message || err.message);
  }

  await mongoose.disconnect();
  console.log("\n=================================================");
  console.log("  POST-PIN TRANSFER FLOW TRACE COMPLETED");
  console.log("=================================================");
}

tracePostPinTransfer().catch((err) => {
  console.error("Trace script error:", err);
  process.exit(1);
});
