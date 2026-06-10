import express from 'express';
import { getCategoriesByType, getAllCategories, getAllSubcategories } from '../controllers/categoryController.js';
import { protect } from "../middlewares/auth.middleware.js";
const router = express.Router();


//  for all subcategories
router.get('/subcategories', protect, getAllSubcategories);

router.get('/', protect, getAllCategories);
router.get("/by-type", protect, getCategoriesByType);

export default router;