import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bills.js';
import User from '../models/User.js';

dotenv.config();

const seedBills = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB Connected for Bill Seeding...');

    const user = await User.findOne(); // Get your test user
    if (!user) {
      console.error("No user found. Register a user first.");
      process.exit(1);
    }

    // Clear existing bills to start fresh
    await Bill.deleteMany({ user: user._id });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysTime = new Date();
    sevenDaysTime.setDate(today.getDate() + 7);
    sevenDaysTime.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const mockBills = [
      {
        user: user._id,
        name: "Electricity Bill",
        amount: 18000,
        dueDate: sevenDaysTime,
        category: "Expense - Food", // household utility mapped to expense bucket
        frequency: "Monthly",
        status: "unpaid",
        reminderEnabled: true
      },
      {
        user: user._id,
        name: "Internet Subscription",
        amount: 12500,
        dueDate: yesterday, // overdue
        category: "Expense - Call",
        frequency: "Monthly",
        status: "overdue",
        reminderEnabled: true
      },
      {
        user: user._id,
        name: "Water Bill",
        amount: 3500,
        dueDate: today,
        category: "Expense - Food",
        frequency: "Monthly",
        status: "unpaid",
        reminderEnabled: true
      },
      {
        user: user._id,
        name: "Mobile Data Plan",
        amount: 6000,
        dueDate: today,
        category: "Expense - Call",
        frequency: "Monthly",
        status: "paid",
        paymentMethod: "Bank Transfer",
        reminderEnabled: false
      },
      {
        user: user._id,
        name: "Transportation Card",
        amount: 15000,
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        category: "Budget - Transport",
        frequency: "Monthly",
        status: "unpaid",
        reminderEnabled: true
      },
      {
        user: user._id,
        name: "POS Charges",
        amount: 2200,
        dueDate: yesterday,
        category: "Expense - POS Charges",
        frequency: "Monthly",
        status: "overdue",
        reminderEnabled: true
      },
      {
        user: user._id,
        name: "Netflix Subscription",
        amount: 4400,
        dueDate: sevenDaysTime,
        category: "Budget - Entertainment",
        frequency: "Monthly",
        status: "unpaid",
        reminderEnabled: true
      }
    ];    

    await Bill.insertMany(mockBills);
    console.log(`Successfully seeded ${mockBills.length} Bills with different states!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedBills();