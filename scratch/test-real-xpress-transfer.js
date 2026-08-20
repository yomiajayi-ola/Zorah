import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

const BASE_URL = "http://localhost:4000/api";
const MONGO_URI = "mongodb+srv://zorah:XYxPJUTqD4uYPoNi@cluster0.zptofjn.mongodb.net/zorah_staging";

async function testRealXpressTransfer() {
  console.log("=================================================");
  console.log("  TEST C2C TRANSFER WITH REAL XPRESS CUSTOMER IDs");
  console.log("=================================================");

  await mongoose.connect(MONGO_URI);

  // 1. Real Xpress Customer IDs from Sandbox DB
  const realSenderCustId = "65cfc4e1-82ab-4911-9608-ec8bc74cb0c9";
  const realRecipientCustId = "75466765-a13e-44e9-853c-44ed9d522460";

  // 2. Setup / Link Sender User & Wallet in MongoDB
  const senderEmail = "pool_1780650971102@getzorah.com";
  let senderUser = await User.findOne({ email: senderEmail });
  if (!senderUser) {
    senderUser = await User.create({
      firstName: "Pool",
      lastName: "Staging",
      email: senderEmail,
      password: "Password123!",
      isPinSet: true,
      pinHash: await bcrypt.hash("1234", 10),
      xpressCustomerId: realSenderCustId
    });
  } else {
    senderUser.isPinSet = true;
    senderUser.pinHash = await bcrypt.hash("1234", 10);
    senderUser.xpressCustomerId = realSenderCustId;
    await senderUser.save();
  }

  let senderWallet = await Wallet.findOne({ user: senderUser._id });
  if (!senderWallet) {
    senderWallet = await Wallet.create({
      user: senderUser._id,
      accountName: "Pool Staging",
      accountNumber: "1174810912",
      xpressCustomerId: realSenderCustId,
      balance: 10000,
      ledgerBalance: 10000
    });
  } else {
    senderWallet.xpressCustomerId = realSenderCustId;
    senderWallet.balance = 10000;
    senderWallet.ledgerBalance = 10000;
    await senderWallet.save();
  }

  // 3. Setup / Link Recipient User & Wallet in MongoDB
  const recipientEmail = "recipient_1780650970634@getzorah.com";
  let recipientUser = await User.findOne({ email: recipientEmail });
  if (!recipientUser) {
    recipientUser = await User.create({
      firstName: "Recipient",
      lastName: "Staging",
      email: recipientEmail,
      password: "Password123!",
      xpressCustomerId: realRecipientCustId
    });
  }

  let recipientWallet = await Wallet.findOne({ xpressCustomerId: realRecipientCustId });
  if (!recipientWallet) {
    recipientWallet = await Wallet.create({
      user: recipientUser._id,
      accountName: "Recipient Staging",
      accountNumber: "1137257794",
      xpressCustomerId: realRecipientCustId,
      balance: 2000,
      ledgerBalance: 2000
    });
  }

  // 4. Authenticate Sender via HTTP API to acquire JWT
  console.log("\nLogging in Sender to get JWT Token...");
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: senderEmail,
    password: "Password123!"
  });
  const token = loginRes.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // --- REQUIREMENT CHECKS ---
  console.log("\n--- TEST 1: No PIN -> 400 ---");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50,
      toCustomerId: realRecipientCustId
    }, { headers });
    console.error("❌ Test 1 Failed");
  } catch (err) {
    console.log(`Test 1 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  console.log("\n--- TEST 2: Wrong PIN -> 400 ---");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50,
      toCustomerId: realRecipientCustId,
      pin: "9999"
    }, { headers });
    console.error("❌ Test 2 Failed");
  } catch (err) {
    console.log(`Test 2 Result: Status ${err.response?.status}, Body:`, err.response?.data);
  }

  console.log("\n--- TEST 3: Correct PIN + Valid Recipient + Sufficient Balance -> Successful Transfer ---");
  let firstTxRef;
  const testIdempotencyKey = `idem_real_${Date.now()}`;
  try {
    const trfRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50,
      toCustomerId: realRecipientCustId,
      pin: "1234",
      purpose: "transfer",
      idempotencyKey: testIdempotencyKey
    }, { headers });
    console.log(`Test 3 Result: Status ${trfRes.status}, Body:`, trfRes.data);
    firstTxRef = trfRes.data.data?.reference;
  } catch (err) {
    console.error("❌ Test 3 Error:", err.response?.data || err.message);
  }

  console.log("\n--- TEST 4: Same Idempotency Key Repeated -> Must not transfer twice ---");
  try {
    const repeatRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50,
      toCustomerId: realRecipientCustId,
      pin: "1234",
      purpose: "transfer",
      idempotencyKey: testIdempotencyKey
    }, { headers });
    console.log(`Test 4 Result (Idempotent Retry): Status ${repeatRes.status}, Body:`, repeatRes.data);
  } catch (err) {
    console.error("❌ Test 4 Error:", err.response?.data || err.message);
  }

  console.log("\n--- TEST 5: Insufficient Balance -> 400 ---");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 9999999,
      toCustomerId: realRecipientCustId,
      pin: "1234"
    }, { headers });
    console.error("❌ Test 5 Failed");
  } catch (err) {
    console.log(`Test 5 Result (Insufficient Funds): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  await mongoose.disconnect();
  console.log("\n=================================================");
  console.log("  REAL XPRESS C2C TRANSFER TESTS COMPLETED 🎉");
  console.log("=================================================");
}

testRealXpressTransfer().catch((err) => {
  console.error("Real transfer test error:", err);
  process.exit(1);
});
