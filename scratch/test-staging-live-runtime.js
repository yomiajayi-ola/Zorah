import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

const BASE_URL = "http://localhost:4000/api";
const MONGO_URI = "mongodb+srv://zorah:XYxPJUTqD4uYPoNi@cluster0.zptofjn.mongodb.net/zorah_staging";

async function runStagingRuntimeVerification() {
  console.log("=================================================");
  console.log("  STAGING RUNTIME VERIFICATION (zorah_staging)");
  console.log("=================================================");

  await mongoose.connect(MONGO_URI);

  // 1. Create/verify test users in zorah_staging DB
  const senderEmail = "staging.sender.audit@zorah.app";
  const recipientEmail = "staging.recipient.audit@zorah.app";

  let senderUser = await User.findOne({ email: senderEmail });
  if (!senderUser) {
    senderUser = await User.create({
      firstName: "StagingSender",
      lastName: "Tester",
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

  // Inspect the actual sender user document in DB
  const queriedSenderDoc = await User.findById(senderUser._id).select("+pinHash +pin");
  console.log("\n[STEP 4 — User Document Trace]");
  console.log(`User ID: ${queriedSenderDoc._id}`);
  console.log(`isPinSet: ${queriedSenderDoc.isPinSet}`);
  console.log(`hasPinHash: ${!!queriedSenderDoc.pinHash} (starts with ${queriedSenderDoc.pinHash?.substring(0, 7)})`);
  console.log(`hasPinField: ${!!queriedSenderDoc.pin}`);

  let recipientUser = await User.findOne({ email: recipientEmail });
  if (!recipientUser) {
    recipientUser = await User.create({
      firstName: "StagingRecipient",
      lastName: "Tester",
      email: recipientEmail,
      password: "Password123!"
    });
  }

  // 2. Wallets setup in staging DB
  const senderCustId = "cust_staging_sender_555";
  const recipientCustId = "cust_staging_recipient_777";

  let senderWallet = await Wallet.findOne({ user: senderUser._id });
  if (!senderWallet) {
    senderWallet = await Wallet.create({
      user: senderUser._id,
      accountName: "StagingSender Tester",
      accountNumber: "8881112223",
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
      accountName: "StagingRecipient Tester",
      accountNumber: "8884445556",
      xpressCustomerId: recipientCustId,
      balance: 2000,
      ledgerBalance: 2000
    });
  }

  // 3. Login Sender via HTTP API to acquire JWT Token
  console.log("\n[STEP 5 — HTTP API Verification]");
  console.log("Logging in Sender to get JWT Token...");
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: senderEmail,
    password: "Password123!"
  });
  const token = loginRes.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  const results = {};

  // Case 1: No PIN
  console.log("\n--- Case 1: No PIN ---");
  try {
    const res = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId
    }, { headers });
    results.noPin = { status: res.status, body: res.data };
  } catch (err) {
    results.noPin = { status: err.response?.status, body: err.response?.data };
  }
  console.log("No PIN Result:", results.noPin);

  // Case 2: Empty PIN
  console.log("\n--- Case 2: Empty PIN ---");
  try {
    const res = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: ""
    }, { headers });
    results.emptyPin = { status: res.status, body: res.data };
  } catch (err) {
    results.emptyPin = { status: err.response?.status, body: err.response?.data };
  }
  console.log("Empty PIN Result:", results.emptyPin);

  // Case 3: Wrong PIN
  console.log("\n--- Case 3: Wrong PIN ---");
  try {
    const res = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "9999"
    }, { headers });
    results.wrongPin = { status: res.status, body: res.data };
  } catch (err) {
    results.wrongPin = { status: err.response?.status, body: err.response?.data };
  }
  console.log("Wrong PIN Result:", results.wrongPin);

  // Case 4: Correct PIN
  console.log("\n--- Case 4: Correct PIN ---");
  try {
    const res = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "1234",
      purpose: "staging runtime verification"
    }, { headers });
    results.correctPin = { status: res.status, body: res.data };
  } catch (err) {
    results.correctPin = { status: err.response?.status, body: err.response?.data };
  }
  console.log("Correct PIN Result:", results.correctPin);

  await mongoose.disconnect();

  console.log("\n=================================================");
  console.log("  SUMMARY OF LIVE TEST RESULTS");
  console.log("=================================================");
  console.log("No PIN:     ", results.noPin.status, results.noPin.body?.message);
  console.log("Empty PIN:  ", results.emptyPin.status, results.emptyPin.body?.message);
  console.log("Wrong PIN:  ", results.wrongPin.status, results.wrongPin.body?.message);
  console.log("Correct PIN:", results.correctPin.status, results.correctPin.body?.message || results.correctPin.body?.status);
}

runStagingRuntimeVerification().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
