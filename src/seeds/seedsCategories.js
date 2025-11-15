import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('DB Connected'))
  .catch(err => console.error(err));

const basePath = path.join(process.cwd(), 'public/images/categories');

const categoryTypes = ['budget', 'expense', 'income', 'savings'];

const seedCategories = async () => {
  try {
    await Category.deleteMany({});

    const categories = categoryTypes.map(type => {
      const subDir = path.join(basePath, type);
      const files = fs.readdirSync(subDir);

      const subcategories = files.map(file => {
        const name = path.parse(file).name; // filename without extension
        const image = `http://13.48.253.14:4000/images/categories/${type}/${file}`;
        return { name, image };
      });

      return {
        name: type.charAt(0).toUpperCase() + type.slice(1), // main category name
        type,
        image: '', // optional main image
        subcategories
      };
    });

    await Category.insertMany(categories);
    console.log('Categories seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedCategories();
