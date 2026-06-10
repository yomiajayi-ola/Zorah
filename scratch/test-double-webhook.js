import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load production env to read secret and MongoDB URI
dotenv.config({ path: '.env.production' });
const secret = process.env.XPRESS_WEBHOOK_SECRET;
const mongoUri = process.env.MONGO_URI;

// User and customer details
const customerId = 'b702a3f6-bcdf-4c72-8bd4-afeeba873c63';
const reference = `double_test_${Date.now()}`;
const amount = 100;

const payload = {
  event: 'customer_wallet_credited',
  data: {
    amount: amount,
    reference: reference,
    customer_id: customerId,
    metadata: { purpose: 'deposit' },
    transaction_fee: 0
  }
};

const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

async function checkBalance() {
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  const walletsCol = conn.collection('wallets');
  const wallet = await walletsCol.findOne({ xpressCustomerId: customerId });
  await conn.close();
  return wallet ? wallet.balance : 0;
}

async function runTest() {
  console.log('--- Double Webhook Prevention Test ---');
  try {
    const initialBalance = await checkBalance();
    console.log(`Step 1: Initial balance in local DB: ₦${initialBalance}`);

    // Call 1: Sending first webhook
    console.log(`Step 2: Sending first webhook with reference: ${reference}...`);
    const res1 = await axios.post('http://13.48.253.14:4000/api/webhooks/xpress-wallet', rawBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-xpresswallet-signature': signature
      }
    });
    console.log('Response 1 Status:', res1.status, '-', res1.data);

    // Call 2: Sending second identical webhook
    console.log(`Step 3: Sending duplicate webhook with reference: ${reference}...`);
    const res2 = await axios.post('http://13.48.253.14:4000/api/webhooks/xpress-wallet', rawBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-xpresswallet-signature': signature
      }
    });
    console.log('Response 2 Status:', res2.status, '-', res2.data);

    // Verify balance
    const finalBalance = await checkBalance();
    console.log(`Step 4: Final balance in local DB: ₦${finalBalance}`);
    
    const diff = finalBalance - initialBalance;
    console.log(`Step 5: Balance Difference: ₦${diff}`);

    if (diff === amount) {
      console.log('✅ TEST PASSED: Double webhook prevention is working perfectly. The wallet was credited exactly once!');
    } else if (diff === amount * 2) {
      console.log('❌ TEST FAILED: Double-crediting occurred! The balance was incremented twice.');
    } else {
      console.log(`❌ TEST FAILED: Unexpected balance change: ₦${diff}`);
    }

  } catch (error) {
    console.error('Error during test execution:', error.response ? error.response.data : error.message);
  }
}

runTest();
