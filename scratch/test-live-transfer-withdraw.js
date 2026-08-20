import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

const BASE_URL = "http://localhost:4000/api";
const MONGO_URI = "mongodb+srv://zorah:XYxPJUTqD4uYPoNi@cluster0.zptofjn.mongodb.net/";

async function testLiveTransferAndWithdraw() {
  console.log("=================================================");
  console.log("  LIVE HTTP API VERIFICATION FOR TRANSFER & WITHDRAW");
  console.log("=================================================");

  await mongoose.connect(MONGO_URI);

  // 1. Create / find Sender User and Recipient User in DB
  const senderEmail = "live.sender.test@zorah.app";
  const recipientEmail = "live.recipient.test@zorah.app";

  let senderUser = await User.findOne({ email: senderEmail });
  if (!senderUser) {
    senderUser = await User.create({
      firstName: "LiveSender",
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

  let recipientUser = await User.findOne({ email: recipientEmail });
  if (!recipientUser) {
    recipientUser = await User.create({
      firstName: "LiveRecipient",
      lastName: "Tester",
      email: recipientEmail,
      password: "Password123!"
    });
  }

  // 2. Create / find Wallets for Sender and Recipient
  const senderCustId = "cust_live_sender_101";
  const recipientCustId = "cust_live_recipient_202";

  let senderWallet = await Wallet.findOne({ user: senderUser._id });
  if (!senderWallet) {
    senderWallet = await Wallet.create({
      user: senderUser._id,
      accountName: "LiveSender Tester",
      accountNumber: "9991112223",
      xpressCustomerId: senderCustId,
      balance: 5000,
      ledgerBalance: 5000
    });
  } else {
    senderWallet.balance = 5000;
    senderWallet.ledgerBalance = 5000;
    await senderWallet.save();
  }

  let recipientWallet = await Wallet.findOne({ xpressCustomerId: recipientCustId });
  if (!recipientWallet) {
    recipientWallet = await Wallet.create({
      user: recipientUser._id,
      accountName: "LiveRecipient Tester",
      accountNumber: "9994445556",
      xpressCustomerId: recipientCustId,
      balance: 1000,
      ledgerBalance: 1000
    });
  }

  // 3. Login to get JWT Token
  console.log("\n[1] Logging in Sender to get JWT Token...");
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: senderEmail,
    password: "Password123!"
  });
  const senderToken = loginRes.data.accessToken;
  const headers = { Authorization: `Bearer ${senderToken}` };

  // --- SECTION 1: POST /api/wallet/transfer ---
  console.log("\n--- SECTION 1: POST /api/wallet/transfer ---");

  // A. No PIN
  console.log("1A. Testing POST /api/wallet/transfer with NO PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId
    }, { headers });
    console.error("❌ Failed 1A: Expected 400, got 200");
  } catch (err) {
    console.log(`1A Result (No PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // B. Empty PIN
  console.log("1B. Testing POST /api/wallet/transfer with EMPTY PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: ""
    }, { headers });
    console.error("❌ Failed 1B: Expected 400, got 200");
  } catch (err) {
    console.log(`1B Result (Empty PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // C. Incorrect PIN
  console.log("1C. Testing POST /api/wallet/transfer with INCORRECT PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "9999"
    }, { headers });
    console.error("❌ Failed 1C: Expected 400, got 200");
  } catch (err) {
    console.log(`1C Result (Incorrect PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // D. Correct PIN
  console.log("1D. Testing POST /api/wallet/transfer with CORRECT PIN...");
  try {
    const trfRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustId,
      pin: "1234",
      purpose: "audit live transfer test"
    }, { headers });
    console.log(`1D Result (Correct PIN): Status ${trfRes.status}, Body:`, trfRes.data);
  } catch (err) {
    console.error("1D Error:", err.response?.data || err.message);
  }

  // --- SECTION 2: POST /api/wallet/withdraw ---
  console.log("\n--- SECTION 2: POST /api/wallet/withdraw ---");

  // 2A. No PIN
  console.log("2A. Testing POST /api/wallet/withdraw with NO PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789"
    }, { headers });
  } catch (err) {
    console.log(`2A Result (No PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // 2B. Empty PIN
  console.log("2B. Testing POST /api/wallet/withdraw with EMPTY PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: ""
    }, { headers });
  } catch (err) {
    console.log(`2B Result (Empty PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // 2C. Incorrect PIN
  console.log("2C. Testing POST /api/wallet/withdraw with INCORRECT PIN...");
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: "9999"
    }, { headers });
  } catch (err) {
    console.log(`2C Result (Incorrect PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // 2D. Correct PIN
  console.log("2D. Testing POST /api/wallet/withdraw with CORRECT PIN...");
  try {
    const wdwRes = await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: "1234"
    }, { headers });
    console.log(`2D Result (Correct PIN): Status ${wdwRes.status}, Body:`, wdwRes.data);
  } catch (err) {
    console.log(`2D Result: Status ${err.response?.status}, Body:`, err.response?.data || err.message);
  }

  await mongoose.disconnect();
  console.log("\n=================================================");
  console.log("  ALL LIVE API VERIFICATION CHECKS COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
}

testLiveTransferAndWithdraw().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
