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
      { name: 'Allowance', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Allowance.png' },
      { name: 'Bonus', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Bonus%3ATips.png' },
      { name: 'Salary', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Salary.png' },
      { name: 'Business Profit', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Business+Profit.png' },
      { name: 'Freelance/Contract', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Freelance%3AContract.png' },
      { name: 'Gifts', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Gifts.png' },
      { name: 'Refunds', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Refunds.png' },
      { name: 'Rental Income', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Rental+Income.png' },
      { name: 'Sale of item', group: 'Income', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/income/Sale+of+item.png' }
    ]
  },
  {
    name: 'Budget',
    type: 'budget',
    subcategories: [
      { name: 'Entertainment', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/Entertainment.png' },
      { name: 'Food', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/Food.png' },
      { name: 'Shopping', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/budget/Shopping.png' },
      { name: 'Transport', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Car%3AVehicle.png' }
    ]
  },
  {
    name: 'Expense',
    type: 'expense',
    subcategories: [
      { name: 'Call', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Airtime%3ACalls.png' },
      { name: 'Food', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Food.png' },
      { name: 'POS Charges', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/POS.png' },
      { name: 'Restaurant', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Restaurant.png' },
      { name: 'Dining', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Dining.png' },
      { name: 'Rent/Mortgage', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Rent%3AMortgage.png' },
      { name: 'Electricity', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Electricity.png' },
      { name: 'Water', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/water.png' },
      { name: 'Gas', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Gas.png' },
      { name: 'Repairs', group: 'Daily Living & Utilities', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Repairs.png' },
      
      // Group: Communications & Tech
      { name: 'Internet', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Internet.png' },
      { name: 'Mobile Data', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Mobile+Data.png' },
      { name: 'Airtime/Calls', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Airtime%3ACalls.png' },
      { name: 'Cable TV', group: 'Communications & Tech', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Cable+TV.png' },

      // Group: Transportation
      { name: 'Transport', group: 'Transportation', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/expense/Transport.png' },
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
      { name: 'Car', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Car%3AVehicle.png' },
      { name: 'Education', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Education.pngg' },
      { name: 'Home', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Home%3AReal+Estate.png' },
      { name: 'Wedding/Marriage', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Wedding%3AMarriage.png' },
      { name: 'Debt Payoff Goal', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Debt+Payoff+Goal.png' },
      { name: 'Gadget', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Gadget.png' },
      { name: 'Retirement', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Retirement.png' },
      { name: 'Travel', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Travel%3AVacation.png' },
      { name: 'Investment', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Investment+Capital.png' },
      { name: 'Emergency Fund', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Emergency+Fund.png' },
      { name: 'Furniture', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Furniture.png' },
      { name: 'Baby:Children', image: 'https://zorah-category-images.s3.eu-north-1.amazonaws.com/savings/Baby%3AChildren.png' }
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
