import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true }
}, { _id: true }); // Each subcategory gets its own _id

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },       // e.g., "Budget"
  type: {
    type: String,
    enum: ['budget', 'expense', 'income', 'savings', 'bonus'],
    required: true
  },
  image: { type: String, default: '' },         // optional main image for parent
  subcategories: [subCategorySchema]           // array of subcategories
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
