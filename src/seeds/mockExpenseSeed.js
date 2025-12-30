import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Expense from '../models/Expense.js';
import User from '../models/User.js';

dotenv.config();

const seedMockExpenses = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB Connected for Mock Seeding...');

    // 1. Get a valid user ID (replace with your test user ID if needed)
    const user = await User.findOne();
    if (!user) {
        console.error("No user found. Register a user first.");
        process.exit(1);
    }

    // 2. Clear existing active expenses to avoid duplicates
    await Expense.deleteMany({ user: user._id, status: "active" });

    const categories = ["Food", "Transport", "Housing", "Health", "Entertainment", "Others"];
    const methods = ["Cash", "Card", "Transfer", "Wallet"];
    const mockExpenses = [];

    // 3. Generate data for the last 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i); // Go back i days

      // Create 1-3 expenses per day for realistic charts
      const dailyCount = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < dailyCount; j++) {
        mockExpenses.push({
          user: user._id,
          amount: Math.floor(Math.random() * 5000) + 500, // Random amount 500-5500
          category: categories[Math.floor(Math.random() * categories.length)],
          description: "Mock spending for chart testing",
          paymentMethod: methods[Math.floor(Math.random() * methods.length)],
          date: date,
          status: "active"
        });
      }
    }

    await Expense.insertMany(mockExpenses);
    console.log(`Successfully seeded ${mockExpenses.length} mock expenses!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedMockExpenses();