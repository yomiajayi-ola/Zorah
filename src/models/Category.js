import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true }, 
  type: {
    type: String,
    enum: ['budget', 'expense', 'income', 'savings'],
    required: true,
  },
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
