import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import { withdrawFunds } from '../controllers/walletController.js';

// Setup Mock Express Response
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('🚀 Starting Wallet Withdrawal Test Suite...');
  
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB');
    }

    const testEmail = 'test_withdrawal_suite@getzorah.com';

    // Cleanup old test data
    await User.deleteMany({ email: testEmail });
    await Wallet.deleteMany({ accountName: 'Suite Test Withdraw User' });
    
    // 1. Create Test User
    const user = await User.create({
      name: 'Suite Test Withdraw User',
      email: testEmail,
      password: 'password123',
      firstName: 'Suite',
      lastName: 'Withdraw'
    });

    // 2. Create Test Wallet
    const wallet = await Wallet.create({
      user: user._id,
      name: 'Zorah Wallet',
      xpressCustomerId: 'cust_suite_withdraw_123',
      accountNumber: '9900000007',
      accountName: 'Suite Test Withdraw User',
      balance: 15000,
      tier: 1
    });

    console.log(`Initial Balance: ₦${wallet.balance}`);

    // Mock Axios POST for successful gateway simulation
    const originalPost = axios.post;
    let lastUrlCalled = null;
    let lastPayloadCalled = null;

    axios.post = async (url, payload, config) => {
      lastUrlCalled = url;
      lastPayloadCalled = payload;
      return {
        data: {
          status: true,
          message: 'Approved',
          data: {
            reference: 'TX-TEST-WITHDRAWAL-777',
            amount: payload.amount
          }
        }
      };
    };

    // --- TEST 1: SUCCESSFUL WITHDRAWAL ---
    console.log('\n--- Running Test 1: Successful Withdrawal ---');
    const req1 = {
      user: { id: user._id },
      body: {
        amount: 2500,
        bankCode: '000013',
        accountNumber: '0167421242',
        accountName: 'Beneficiary Name',
        narration: 'Test Payout Narration'
      }
    };
    const res1 = mockResponse();
    await withdrawFunds(req1, res1);

    console.log('Response Status:', res1.statusCode || 200);
    console.log('Response Body:', res1.body);
    console.log('API URL Called:', lastUrlCalled);
    console.log('API Payload Sent:', JSON.stringify(lastPayloadCalled, null, 2));

    // Restore Axios post immediately
    axios.post = originalPost;

    // Verify expectations
    const isCorrectUrl = lastUrlCalled?.endsWith('/transfer/bank/customer');
    const hasCorrectPayload = 
      lastPayloadCalled?.amount === 2500 &&
      lastPayloadCalled?.sortCode === '000013' &&
      lastPayloadCalled?.accountNumber === '0167421242' &&
      lastPayloadCalled?.accountName === 'Beneficiary Name' &&
      lastPayloadCalled?.narration === 'Test Payout Narration' &&
      lastPayloadCalled?.customerId === 'cust_suite_withdraw_123';

    // Verify Transaction logging
    const checkTx = await Transaction.findOne({ user: user._id, reference: 'TX-TEST-WITHDRAWAL-777' });
    const isLoggedCorrectly = checkTx && checkTx.type === 'debit' && checkTx.purpose === 'withdrawal' && checkTx.amount === 2500;

    console.log(`\nVerification Results:`);
    console.log(`- Is Customer Bank Transfer Endpoint Called? ${isCorrectUrl ? '✅' : '❌'}`);
    console.log(`- Is Payload Configured Properly? ${hasCorrectPayload ? '✅' : '❌'}`);
    console.log(`- Is Transaction Record Created? ${isLoggedCorrectly ? '✅' : '❌'}`);

    if (isCorrectUrl && hasCorrectPayload && isLoggedCorrectly) {
      console.log('\n🎉 WITHDRAWAL TEST PASSED SUCCESSFULLY!');
    } else {
      console.error('\n❌ WITHDRAWAL TEST FAILED!');
    }

    // Cleanup test database entries
    console.log('\nCleaning up database entries...');
    await User.deleteMany({ email: testEmail });
    await Wallet.deleteMany({ accountName: 'Suite Test Withdraw User' });
    await Transaction.deleteMany({ user: user._id });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);

  } catch (err) {
    console.error('Test Execution Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
