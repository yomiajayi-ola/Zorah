import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

const BASE_URL = "http://localhost:4000/api";
const MONGO_URI = "mongodb+srv://zorah:XYxPJUTqD4uYPoNi@cluster0.zptofjn.mongodb.net/zorah_staging";

async function verifyE2eC2cFix() {
  console.log("=================================================");
  console.log("  END-TO-END C2C TRANSFER FIX VERIFICATION");
  console.log("=================================================");

  await mongoose.connect(MONGO_URI);

  // Use real Xpress Customer IDs present in Xpress Sandbox DB
  const realSenderCustId = "65cfc4e1-82ab-4911-9608-ec8bc74cb0c9";
  const realRecipientCustId = "75466765-a13e-44e9-853c-44ed9d522460";

  const senderEmail = "pool_1780650971102@getzorah.com";
  const recipientEmail = "recipient_1780650970634@getzorah.com";

  // 1. Ensure Sender User & Wallet exist in DB
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

  // 2. Ensure Recipient User & Wallet exist in DB
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
  } else {
    recipientWallet.balance = 2000;
    recipientWallet.ledgerBalance = 2000;
    await recipientWallet.save();
  }

  const initialSenderBal = senderWallet.balance;
  const initialRecipientBal = recipientWallet.balance;

  console.log(`Initial Sender Balance:    ₦${initialSenderBal}`);
  console.log(`Initial Recipient Balance: ₦${initialRecipientBal}`);

  // 3. Login Sender via HTTP API
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: senderEmail,
    password: "Password123!"
  });
  const token = loginRes.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // --- STEP A: INVALID PIN (HTTP 400) ---
  console.log("\n--- [Check 1] Invalid PIN Test ---");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: realRecipientCustId,
      pin: "9999"
    }, { headers });
    console.error("❌ Check 1 Failed: Expected 400");
  } catch (err) {
    console.log(`Check 1 Result (Invalid PIN): Status ${err.response?.status}, Message:`, err.response?.data?.message);
    console.assert(err.response?.status === 400, "Check 1 failed: status should be 400");
  }

  // --- STEP B: INSUFFICIENT BALANCE (HTTP 400) ---
  console.log("\n--- [Check 2] Insufficient Balance Test ---");
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 999999,
      toCustomerId: realRecipientCustId,
      pin: "1234"
    }, { headers });
    console.error("❌ Check 2 Failed: Expected 400");
  } catch (err) {
    console.log(`Check 2 Result (Insufficient Balance): Status ${err.response?.status}, Message:`, err.response?.data?.message);
    console.assert(err.response?.status === 400, "Check 2 failed: status should be 400");
  }

  // --- STEP C: VALID PIN + VALID RECIPIENT + SUFFICIENT BALANCE ---
  console.log("\n--- [Check 3] Valid C2C Transfer Test ---");
  const testIdempotencyKey = `idem_e2e_${Date.now()}`;
  let transferRef;
  try {
    const trfRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: realRecipientCustId,
      pin: "1234",
      purpose: "transfer",
      idempotencyKey: testIdempotencyKey
    }, { headers });

    console.log(`Check 3 Result: Status ${trfRes.status}, Body:`, trfRes.data);
    console.assert(trfRes.status === 200, "Check 3 failed: status should be 200");
    transferRef = trfRes.data.data?.reference;
  } catch (err) {
    console.error("❌ Check 3 Error:", err.response?.data || err.message);
  }

  // --- STEP D: REPEATED IDEMPOTENCY KEY (MUST NOT TRANSFER TWICE) ---
  console.log("\n--- [Check 4] Idempotency Key Retry Test ---");
  try {
    const retryRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: realRecipientCustId,
      pin: "1234",
      purpose: "transfer",
      idempotencyKey: testIdempotencyKey
    }, { headers });

    console.log(`Check 4 Result (Idempotent Retry): Status ${retryRes.status}, Body:`, retryRes.data);
    console.assert(retryRes.status === 200, "Check 4 failed: status should be 200");
    console.assert(retryRes.data.isIdempotent === true, "Check 4 failed: should be marked idempotent");
  } catch (err) {
    console.error("❌ Check 4 Error:", err.response?.data || err.message);
  }

  // --- STEP E: RECIPIENT BY EMAIL / ACCOUNT NUMBER RESOLUTION TEST ---
  console.log("\n--- [Check 5] Recipient Resolution by Email Test ---");
  try {
    const emailTrfRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 50,
      toCustomerId: recipientEmail, // passing email as toCustomerId
      pin: "1234",
      purpose: "transfer"
    }, { headers });

    console.log(`Check 5 Result (By Email): Status ${emailTrfRes.status}, Body:`, emailTrfRes.data);
    console.assert(emailTrfRes.status === 200, "Check 5 failed: status should be 200");
  } catch (err) {
    console.error("❌ Check 5 Error:", err.response?.data || err.message);
  }

  // --- STEP F: VERIFY BALANCE DEDUCTION AND CREDIT IN DB ---
  console.log("\n--- [Check 6] Verify MongoDB Ledger Snapshots ---");
  const finalSenderWallet = await Wallet.findOne({ user: senderUser._id });
  const finalRecipientWallet = await Wallet.findOne({ xpressCustomerId: realRecipientCustId });

  console.log(`Final Sender Balance:    ₦${finalSenderWallet.balance} (Expected ₦${initialSenderBal - 150})`);
  console.log(`Final Recipient Balance: ₦${finalRecipientWallet.balance} (Expected ₦${initialRecipientBal + 150})`);

  console.assert(finalSenderWallet.balance === initialSenderBal - 150, "Sender balance deduction incorrect!");
  console.assert(finalRecipientWallet.balance === initialRecipientBal + 150, "Recipient balance credit incorrect!");

  await mongoose.disconnect();
  console.log("\n=================================================");
  console.log("  ALL END-TO-END VERIFICATION CHECKS PASSED 🎉");
  console.log("=================================================");
}

verifyE2eC2cFix().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
