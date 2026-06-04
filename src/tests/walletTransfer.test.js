import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import { transferToCustomer } from '../controllers/walletController.js';

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
  console.log('🚀 Starting Wallet Transaction Test Suite...');
  
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB Atlas');
    }

    const senderEmail = 'test_sender_suite@getzorah.com';
    const receiverEmail = 'test_receiver_suite@getzorah.com';

    // Cleanup old test data
    await User.deleteMany({ email: { $in: [senderEmail, receiverEmail] } });
    await Wallet.deleteMany({ accountName: { $in: ['Suite Test Sender', 'Suite Test Receiver'] } });
    
    // 1. Create Test Users
    const sender = await User.create({
      name: 'Suite Test Sender',
      email: senderEmail,
      password: 'password123',
      firstName: 'Suite',
      lastName: 'Sender'
    });

    const receiver = await User.create({
      name: 'Suite Test Receiver',
      email: receiverEmail,
      password: 'password123',
      firstName: 'Suite',
      lastName: 'Receiver'
    });

    // 2. Create Test Wallets
    const senderWallet = await Wallet.create({
      user: sender._id,
      name: 'Zorah Wallet',
      xpressCustomerId: 'cust_suite_sender_123',
      accountNumber: '9900000005',
      accountName: 'Suite Test Sender',
      balance: 10000,
      tier: 1
    });

    const receiverWallet = await Wallet.create({
      user: receiver._id,
      name: 'Zorah Wallet',
      xpressCustomerId: 'cust_suite_receiver_456',
      accountNumber: '9900000006',
      accountName: 'Suite Test Receiver',
      balance: 2000,
      tier: 1
    });

    console.log(`\nInitial Balances:`);
    console.log(`- Sender: ₦${senderWallet.balance}`);
    console.log(`- Receiver: ₦${receiverWallet.balance}`);

    // Mock Axios POST for successful gateway simulation
    const originalPost = axios.post;
    axios.post = async () => {
      return {
        data: {
          status: true,
          message: 'Approved',
          data: {
            reference: 'TX-TEST-SUITE-SUCCESS-888',
            amount: 1500
          }
        }
      };
    };

    // --- TEST 1: SUCCESSFUL TRANSFER ---
    console.log('\n--- Running Test 1: Successful Transfer ---');
    const req1 = {
      user: { id: sender._id },
      body: {
        amount: 1500,
        toCustomerId: 'cust_suite_receiver_456',
        purpose: 'transfer'
      }
    };
    const res1 = mockResponse();
    await transferToCustomer(req1, res1);

    console.log('Response Status:', res1.statusCode || 200);
    console.log('Response Body:', res1.body);

    let checkSender = await Wallet.findById(senderWallet._id);
    let checkReceiver = await Wallet.findById(receiverWallet._id);
    console.log(`After Success Balances - Sender: ₦${checkSender.balance}, Receiver: ₦${checkReceiver.balance}`);
    
    const successLogsCount = await Transaction.countDocuments({ user: { $in: [sender._id, receiver._id] } });
    console.log(`Transaction Logs created: ${successLogsCount} (Expected: 2)`);

    // Reset balances for Test 2
    checkSender.balance = 10000;
    await checkSender.save();
    checkReceiver.balance = 2000;
    await checkReceiver.save();
    await Transaction.deleteMany({ user: { $in: [sender._id, receiver._id] } });

    // --- TEST 2: SIMULATED DB CRASH & ROLLBACK ---
    console.log('\n--- Running Test 2: Simulated DB Crash & Rollback ---');
    
    // Override Transaction.create to crash
    const originalCreate = Transaction.create;
    Transaction.create = async function() {
      throw new Error('Simulated Database crash during write transaction!');
    };

    const req2 = {
      user: { id: sender._id },
      body: {
        amount: 1500,
        toCustomerId: 'cust_suite_receiver_456',
        purpose: 'transfer'
      }
    };
    const res2 = mockResponse();
    await transferToCustomer(req2, res2);

    console.log('Response Status:', res2.statusCode || 200);
    console.log('Response Body:', res2.body);

    // Restore functions
    axios.post = originalPost;
    Transaction.create = originalCreate;

    checkSender = await Wallet.findById(senderWallet._id);
    checkReceiver = await Wallet.findById(receiverWallet._id);
    console.log(`After Crash Balances - Sender: ₦${checkSender.balance}, Receiver: ₦${checkReceiver.balance}`);
    console.log(`Expected Balances - Sender: ₦10000, Receiver: ₦2000 (DB Rollback succeeded)`);

    const crashLogsCount = await Transaction.countDocuments({ user: { $in: [sender._id, receiver._id] } });
    console.log(`Transaction Logs after crash: ${crashLogsCount} (Expected: 0)`);

    if (checkSender.balance === 10000 && checkReceiver.balance === 2000 && crashLogsCount === 0) {
      console.log('\n✅ TEST RUN PASSED SUCCESSFULLY!');
    } else {
      console.error('\n❌ TEST RUN FAILED!');
    }

    // Cleanup test database entries
    console.log('\nCleaning up database entries...');
    await User.deleteMany({ email: { $in: [senderEmail, receiverEmail] } });
    await Wallet.deleteMany({ accountName: { $in: ['Suite Test Sender', 'Suite Test Receiver'] } });
    await Transaction.deleteMany({ user: { $in: [sender._id, receiver._id] } });

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
