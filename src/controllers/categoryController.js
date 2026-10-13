import Category from "../models/Category.js";

// GET categories by type (e.g. ?type=income or ?type=expense)
export const getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) return res.status(400).json({ success: false, message: 'Category type is required' });

    // Use find (not findOne) so multiple category docs per type are returned if they exist
    const categories = await Category.find({ type });
    if (!categories || categories.length === 0) {
      return res.status(404).json({ success: false, message: `No category found for type: ${type}` });
    }

    // Flatten all subcategories from matching documents into a single list
    const subcategories = categories.flatMap(cat => cat.subcategories);

    res.status(200).json({
      success: true,
      type,
      count: subcategories.length,
      data: subcategories,
    });
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

// GET all subcategories across all types (optionally filtered by ?type=)
export const getAllSubcategories = async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};
    const categories = await Category.find(query);

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