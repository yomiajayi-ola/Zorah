import express from 'express';
import { getCategoriesByType, getAllCategories } from '../controllers/categoryController.js';
import { protect } from "../middlewares/auth.middleware.js";
const router = express.Router();


router.get('/', getCategoriesByType);
// router.post('/seed', seedCategories); 
router.get("/by-type", protect, getAllCategories);
export default router;