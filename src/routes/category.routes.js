import express from 'express';
import { getCategoriesByType, seedCategories } from '../controllers/categoryController.js';
const router = express.Router();


router.get('/', getCategoriesByType);
router.post('/seed', seedCategories); 

export default router;