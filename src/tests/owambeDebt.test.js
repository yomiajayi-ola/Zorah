import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import EventBudget from '../models/EventBudget.js';
import Debt from '../models/Debt.js';
import {
  createEventBudget,
  getEventBudgets,
  addOrUpdateEventExpense,
} from '../controllers/owambeController.js';
import {
  createDebt,
  getDebts,
  settleDebt,
  triggerNudge,
  formatNigerianPhone,
} from '../controllers/debtController.js';

// Helper for Mocking Express Response
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

async function runOwambeDebtTests() {
  console.log('🚀 Starting Owambe Mode & Debt Tracker Test Suite...\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zorah_test');
      console.log('✅ Connected to MongoDB');
    }

    const testUserEmail = 'owambe_debt_test@getzorah.com';

    // Cleanup old test data
    await User.deleteMany({ email: testUserEmail });
    const user = await User.create({
      name: 'Owambe Test User',
      firstName: 'Owambe',
      lastName: 'Tester',
      email: testUserEmail,
      password: 'password123',
    });

    await EventBudget.deleteMany({ user: user._id });
    await Debt.deleteMany({ user: user._id });

    // =========================================================================
    // SECTION 1: OWAMBE MODE (EVENT BUDGET & EXPENSES)
    // =========================================================================
    console.log('--- TEST 1: Create Owambe Event Budget ---');
    const reqCreateEvent = {
      user: { _id: user._id },
      body: {
        title: 'Lagos Wedding Owambe 2026',
        targetBudget: 500000,
        categoryTags: ['aso ebi', 'transport', 'gift money'],
      },
    };
    const resCreateEvent = mockResponse();
    await createEventBudget(reqCreateEvent, resCreateEvent);

    console.log('Response Status:', resCreateEvent.statusCode);
    console.log('Event Title:', resCreateEvent.body.data.title);
    console.log('Initial totalSpent:', resCreateEvent.body.data.totalSpent, '(Expected: 0)');

    const eventId = resCreateEvent.body.data._id;

    console.log('\n--- TEST 2: Add Itemized Expense to Event Budget ---');
    const reqAddExpense1 = {
      user: { _id: user._id },
      params: { id: eventId },
      body: {
        name: 'Aso Ebi Fabric',
        estimatedCost: 80000,
        actualCost: 75000,
        paid: true,
      },
    };
    const resAddExpense1 = mockResponse();
    await addOrUpdateEventExpense(reqAddExpense1, resAddExpense1);

    console.log('Response Status:', resAddExpense1.statusCode);
    console.log('Updated totalSpent:', resAddExpense1.body.data.totalSpent, '(Expected: 75000)');

    console.log('\n--- TEST 3: Add Second Expense with actualCost: 0 & paid: true ---');
    const reqAddExpense2 = {
      user: { _id: user._id },
      params: { id: eventId },
      body: {
        name: 'Free Transport Shuttle',
        estimatedCost: 20000,
        actualCost: 0,
        paid: true,
      },
    };
    const resAddExpense2 = mockResponse();
    await addOrUpdateEventExpense(reqAddExpense2, resAddExpense2);

    console.log('Response Status:', resAddExpense2.statusCode);
    console.log(
      'Updated totalSpent (actualCost: 0 preserved):',
      resAddExpense2.body.data.totalSpent,
      '(Expected: 75000)'
    );

    // Verify in database
    const savedEvent = await EventBudget.findById(eventId);
    if (savedEvent.totalSpent === 75000) {
      console.log('✅ EventBudget totalSpent dynamic calculation verified successfully!');
    } else {
      throw new Error(`Expected totalSpent to be 75000 but got ${savedEvent.totalSpent}`);
    }

    // =========================================================================
    // SECTION 2: DEBT TRACKER & NUDGE ENGINE
    // =========================================================================
    console.log('\n--- TEST 4: Create Debt Records (owe_me & i_owe) ---');
    // 1. Debt someone owes me
    const reqCreateDebt1 = {
      user: { _id: user._id },
      body: {
        debtorName: 'Tunde Afolayan',
        phoneNumber: '08031234567',
        amount: 35000,
        type: 'owe_me',
        dueDate: '2026-10-15',
        notes: 'Aso ebi contribution refund',
      },
    };
    const resCreateDebt1 = mockResponse();
    await createDebt(reqCreateDebt1, resCreateDebt1);
    console.log('Debt 1 Created (owe_me):', resCreateDebt1.body.data.debtorName, '₦' + resCreateDebt1.body.data.amount);

    const debtOweMeId = resCreateDebt1.body.data._id;

    // 2. Debt I owe someone else
    const reqCreateDebt2 = {
      user: { _id: user._id },
      body: {
        debtorName: 'Bisi Catering',
        phoneNumber: '07098765432',
        amount: 15000,
        type: 'i_owe',
        dueDate: '2026-09-30',
        notes: 'Deposit for drinks',
      },
    };
    const resCreateDebt2 = mockResponse();
    await createDebt(reqCreateDebt2, resCreateDebt2);
    console.log('Debt 2 Created (i_owe):', resCreateDebt2.body.data.debtorName, '₦' + resCreateDebt2.body.data.amount);

    const debtIOweId = resCreateDebt2.body.data._id;

    console.log('\n--- TEST 5: Get Debts & Debtor Summary Calculation ---');
    const reqGetDebts = {
      user: { _id: user._id },
      query: {},
    };
    const resGetDebts = mockResponse();
    await getDebts(reqGetDebts, resGetDebts);

    console.log('Summary:', resGetDebts.body.summary);
    if (
      resGetDebts.body.summary.totalOwedToMe === 35000 &&
      resGetDebts.body.summary.totalIOwe === 15000 &&
      resGetDebts.body.summary.netBalance === 20000
    ) {
      console.log('✅ Debtor Balance Summary calculation verified!');
    } else {
      throw new Error('Debtor balance summary calculation mismatch');
    }

    console.log('\n--- TEST 6: Phone Number Formatter Check ---');
    const formattedPhone = formatNigerianPhone('08031234567');
    console.log('Original: 08031234567 -> Formatted:', formattedPhone);
    if (formattedPhone === '2348031234567') {
      console.log('✅ Phone number formatting verified!');
    } else {
      throw new Error(`Phone formatting failed, got ${formattedPhone}`);
    }

    console.log('\n--- TEST 7: WhatsApp Nudge Trigger for owe_me Debt ---');
    const reqNudge = {
      user: { _id: user._id },
      params: { id: debtOweMeId },
    };
    const resNudge = mockResponse();
    await triggerNudge(reqNudge, resNudge);

    console.log('Nudge Status Code:', resNudge.statusCode);
    console.log('Nudge URL:', resNudge.body.nudgeUrl);
    console.log('Reminders Sent Count:', resNudge.body.remindersSentCount, '(Expected: 1)');

    if (
      resNudge.body.nudgeUrl.includes('wa.me/2348031234567') &&
      resNudge.body.nudgeUrl.includes('Tunde%20Afolayan')
    ) {
      console.log('✅ WhatsApp Nudge deep link URL generated successfully!');
    } else {
      throw new Error('Nudge URL generation failed');
    }

    console.log('\n--- TEST 8: Safeguard Check - Nudge for i_owe Debt ---');
    const reqNudgeIOwe = {
      user: { _id: user._id },
      params: { id: debtIOweId },
    };
    const resNudgeIOwe = mockResponse();
    await triggerNudge(reqNudgeIOwe, resNudgeIOwe);

    console.log('Safeguard Status Code:', resNudgeIOwe.statusCode, '(Expected: 400)');
    console.log('Safeguard Message:', resNudgeIOwe.body.message);
    if (resNudgeIOwe.statusCode === 400) {
      console.log('✅ Safeguard check for i_owe debt nudge verified!');
    } else {
      throw new Error('Safeguard check failed');
    }

    console.log('\n--- TEST 9: Settle Debt ---');
    const reqSettle = {
      user: { _id: user._id },
      params: { id: debtOweMeId },
    };
    const resSettle = mockResponse();
    await settleDebt(reqSettle, resSettle);

    console.log('Settle Status Code:', resSettle.statusCode);
    console.log('Is Settled:', resSettle.body.data.isSettled, '(Expected: true)');

    // Cleanup
    console.log('\nCleaning up test data...');
    await User.deleteMany({ email: testUserEmail });
    await EventBudget.deleteMany({ user: user._id });
    await Debt.deleteMany({ user: user._id });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test Suite Failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runOwambeDebtTests();
