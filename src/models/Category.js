import mongoose from 'mongoose';

const subcategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: false }, // optional for subcategories
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true }, // this should now be a real URL
  type: {
    type: String,
    enum: ['budget', 'expense', 'income', 'savings'],
    required: true,
  },
  subcategories: [subcategorySchema], // new field
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
