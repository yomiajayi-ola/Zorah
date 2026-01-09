import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('DB Connected'))
  .catch(err => console.error(err));

const categories = [
  {
    name: 'Income',
    type: 'income',
    subcategories: [
      { name: 'Allowance', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/allowance.png' },
      { name: 'Bonus', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/bonus.png' },
      { name: 'Investment', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/investment.png' },
      { name: 'Salary', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/salary.png' },
      { name: 'Business Profit', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Business+Profit.png' },
      { name: 'Freelance/Contract', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Freelance%3AContract.png' },
      { name: 'Side Hustle', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Side+Hustle.png' },
      { name: 'Gifts', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Gifts.png' },
      { name: 'Refunds', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Refunds.png' },
      { name: 'Rental Income', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Rental+Income.png' },
      { name: 'Sale of item', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/sale.png' }
    ]
  },
  {
    name: 'Budget',
    type: 'budget',
    subcategories: [
      { name: 'Entertainment', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/entertainment.png' },
      { name: 'Food', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/food.png' },
      { name: 'Shopping', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/shopping.png' },
      { name: 'Transport', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/transport.png' }
    ]
  },
  {
    name: 'Expense',
    type: 'expense',
    subcategories: [
      { name: 'Call', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/call.png' },
      { name: 'Food', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/food.png' },
      { name: 'POS Charges', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/pos-charges.png' },
      { name: 'Transport', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/transport.png' },
      { name: 'Restaurant', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/restaurant.png' },
      { name: 'Dining', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/dining.png' },
      { name: 'Rent/Mortgage', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/rent.png' },
      { name: 'Electricity', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Electricity.png' },
      { name: 'Water', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Water.png' },
      { name: 'Gas', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Gas.png' },
      { name: 'Repairs', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Repairs.png' },
      
      // Group: Communications & Tech
      { name: 'Internet', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Internet.png' },
      { name: 'Mobile Data', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/data.png' },
      { name: 'Airtime/Calls', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Airtime%3ACalls.png' },
      { name: 'Cable TV', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Cable+TV.png' },

      // Group: Transportation
      { name: 'Transport', group: 'Transportation', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/transport.png' },
      { name: 'Fuel', group: 'Transportation', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Fuel.png' },
      { name: 'Car Maintenance', group: 'Transportation', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Car+Maintenance.png' },
      { name: 'Parking Fees', group: 'Transportation', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Parking+Fees.png' },
      { name: 'Ride-hailing', group: 'Transportation', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Ride-hailing.png' }
    ]
  },
  {
    name: 'Savings',
    type: 'savings',
    subcategories: [
      { name: 'Car', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/car.png' },
      { name: 'Education', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/education.png' },
      { name: 'Home', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/home.png' },
      { name: 'Travel', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/travel.png' }
    ]
  }
];

const seedCategories = async () => {
  try {
    await Category.deleteMany({});
    await Category.insertMany(categories);
    console.log('Categories seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedCategories();
