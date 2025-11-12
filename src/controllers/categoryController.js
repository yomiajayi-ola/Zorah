import Category from "../models/Category.js";

// GET categories by type (e.g., /api/categories?type=budget)
export const getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ success: false, message: 'Category type is required' });
    }

    const categories = await Category.find({ type });
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed default categories (for your initial setup)
export const seedCategories = async (req, res) => {
  try {
    const sampleCategories = [
      { name: 'Allowance', image: '💵', type: 'income' },
      { name: 'Bonus', image: '🎁', type: 'income' },
      { name: 'Call', image: '📞', type: 'expense' },
      { name: 'Car', image: '🚗', type: 'expense' },
      { name: 'Education', image: '🎓', type: 'expense' },
      { name: 'Entertainment', image: '🎬', type: 'expense' },
      { name: 'Food', image: '🍔', type: 'expense' },
      { name: 'Home', image: '🏠', type: 'budget' },
      { name: 'Investment', image: '📈', type: 'income' },
      { name: 'POS Charges', image: '🏧', type: 'expense' },
      { name: 'Salary', image: '💰', type: 'income' },
      { name: 'Shopping', image: '🛍️', type: 'expense' },
      { name: 'Transport', image: '🚌', type: 'expense' },
      { name: 'Travel', image: '✈️', type: 'expense' },
      { name: 'Rent', image: '🏠', type: 'budget' },
      { name: 'Savings Goal', image: '🎯', type: 'savings' },
    ];

    await Category.deleteMany({});
    const inserted = await Category.insertMany(sampleCategories);
    res.status(201).json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};