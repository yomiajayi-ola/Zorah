import Category from "../models/Category.js";

// GET categories by type (e.g., /api/categories?type=budget)
export const getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Category type is required'
      });
    }

    // Fetch main category + subcategories
    const category = await Category.findOne({ type });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: `No category found for type: ${type}`
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET all categories (optional, if you want to return everything)
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
