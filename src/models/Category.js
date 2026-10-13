import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },

  group: { type: String, default: 'General' } 
}, { _id: true });

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },       // e.g., "Budget"
  type: {
    type: String,
    enum: ['budget', 'expense', 'income', 'savings', 'bonus'],
    required: true
  },
  image: { type: String, default: '' },       
  subcategories: [subCategorySchema]           
}, { timestamps: true });

// Enforce one category document per type
categorySchema.index({ type: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
