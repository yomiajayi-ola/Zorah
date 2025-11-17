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
      { name: 'Salary', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/salary.png' }
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
      { name: 'Transport', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/transport.png' }
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
