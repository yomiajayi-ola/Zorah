import Category from "../models/Category.js";

// GET categories by type
export const getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) return res.status(400).json({ success: false, message: 'Category type is required' });

    const category = await Category.findOne({ type });
    if (!category) return res.status(404).json({ success: false, message: `No category found for type: ${type}` });

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET all subcategories across all types
export const getAllSubcategories = async (req, res) => {
  try {
    // Aggregation to extract only subcategories
    const categories = await Category.find({});
    
    // Flatten all subcategory arrays into one single list
    const allSubcategories = categories.reduce((acc, cat) => {
      const subsWithType = cat.subcategories.map(sub => ({
        ...sub.toObject(),
        parentType: cat.type, 
        parentName: cat.name
      }));
      return acc.concat(subsWithType);
    }, []);

    res.status(200).json({ 
      success: true, 
      count: allSubcategories.length,
      data: allSubcategories 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};