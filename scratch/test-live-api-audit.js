import axios from "axios";

const BASE_URL = "http://localhost:4000/api";

async function verifyLiveApi() {
  console.log("=================================================");
  console.log("  LIVE STAGING API SUITE AUDIT & VERIFICATION");
  console.log("=================================================");

  // 1. Register Sender
  const senderEmail = `audit.sender.${Date.now()}@zorah.app`;
  const senderPassword = "Password123!";
  console.log(`[1] Registering Sender: ${senderEmail}`);

  let senderToken;
  try {
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: senderEmail,
      password: senderPassword,
      firstName: "AuditSender",
      lastName: "Tester",
      phoneNumber: `080${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    senderToken = regRes.data.token || regRes.data.data?.token;
  } catch (err) {
    console.error("Sender Reg Error:", err.response?.data || err.message);
    process.exit(1);
  }

  const senderHeaders = { Authorization: `Bearer ${senderToken}` };

  // 2. Set PIN for Sender (1234)
  console.log("[2] Setting PIN (1234) for Sender...");
  await axios.post(`${BASE_URL}/auth/set-pin`, { pin: "1234" }, { headers: senderHeaders });

  // 3. Register Recipient & Provision Virtual Account
  const recEmail = `audit.rec.${Date.now()}@zorah.app`;
  console.log(`[3] Registering Recipient: ${recEmail}`);
  const recReg = await axios.post(`${BASE_URL}/auth/register`, {
    email: recEmail,
    password: senderPassword,
    firstName: "AuditRec",
    lastName: "Tester",
    phoneNumber: `080${Math.floor(10000000 + Math.random() * 90000000)}`
  });
  const recToken = recReg.data.token || recReg.data.data?.token;
  const recHeaders = { Authorization: `Bearer ${recToken}` };

  // Provision virtual account for recipient to get xpressCustomerId
  const vaRec = await axios.post(`${BASE_URL}/wallet/virtual-account`, { dateOfBirth: "1995-05-15" }, { headers: recHeaders });
  const recipientCustomerId = vaRec.data.data?.xpressCustomerId;
  console.log(`[3b] Recipient Customer ID: ${recipientCustomerId}`);

  // Provision virtual account for sender
  await axios.post(`${BASE_URL}/wallet/virtual-account`, { dateOfBirth: "1995-05-15" }, { headers: senderHeaders });

  // 4. Deposit ₦1000 into Sender's wallet
  console.log("[4] Depositing ₦1000 into Sender's wallet...");
  const depRes = await axios.post(`${BASE_URL}/wallet/deposit`, { amount: 1000 }, { headers: senderHeaders });
  console.log(`Deposit response: status=${depRes.status}, balance=${depRes.data.data?.balance}`);

  // --- TEST C2C TRANSFER ---
  console.log("\n--- TESTING POST /api/wallet/transfer ---");

  // Case A: No PIN
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustomerId
    }, { headers: senderHeaders });
    console.error("❌ Transfer Case A (No PIN) failed: unexpected 200");
  } catch (err) {
    console.log(`Transfer Case A (No PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // Case B: Empty PIN
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustomerId,
      pin: ""
    }, { headers: senderHeaders });
    console.error("❌ Transfer Case B (Empty PIN) failed: unexpected 200");
  } catch (err) {
    console.log(`Transfer Case B (Empty PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // Case C: Incorrect PIN
  try {
    await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustomerId,
      pin: "9999"
    }, { headers: senderHeaders });
    console.error("❌ Transfer Case C (Wrong PIN) failed: unexpected 200");
  } catch (err) {
    console.log(`Transfer Case C (Wrong PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // Case D: Correct PIN
  try {
    const trfRes = await axios.post(`${BASE_URL}/wallet/transfer`, {
      amount: 100,
      toCustomerId: recipientCustomerId,
      pin: "1234",
      purpose: "audit test transfer"
    }, { headers: senderHeaders });
    console.log(`Transfer Case D (Correct PIN): Status ${trfRes.status}, Body:`, trfRes.data);
  } catch (err) {
    console.error("❌ Transfer Case D (Correct PIN) error:", err.response?.data || err.message);
  }

  // --- TESTING POST /api/wallet/withdraw ---
  console.log("\n--- TESTING POST /api/wallet/withdraw ---");

  // Withdraw Case A: No PIN
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789"
    }, { headers: senderHeaders });
  } catch (err) {
    console.log(`Withdraw Case A (No PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // Withdraw Case B: Empty PIN
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: ""
    }, { headers: senderHeaders });
  } catch (err) {
    console.log(`Withdraw Case B (Empty PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // Withdraw Case C: Incorrect PIN
  try {
    await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: "9999"
    }, { headers: senderHeaders });
  } catch (err) {
    console.log(`Withdraw Case C (Wrong PIN): Status ${err.response?.status}, Body:`, err.response?.data);
  }

  // Withdraw Case D: Correct PIN
  try {
    const wdwRes = await axios.post(`${BASE_URL}/wallet/withdraw`, {
      amount: 50,
      bankCode: "058",
      accountNumber: "0123456789",
      pin: "1234"
    }, { headers: senderHeaders });
    console.log(`Withdraw Case D (Correct PIN): Status ${wdwRes.status}, Body:`, wdwRes.data);
  } catch (err) {
    console.log(`Withdraw Case D Result: Status ${err.response?.status}, Body:`, err.response?.data || err.message);
  }

  console.log("\n=================================================");
  console.log("  LIVE API VERIFICATION COMPLETE 🎉");
  console.log("=================================================");
}

verifyLiveApi().catch((err) => {
  console.error("Unhandled Error in Live API test:", err.message);
});
