import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });
const uri = process.env.MONGO_URI;

async function cleanupMockTransaction() {
  console.log('Connecting to Production Database to clean up mock transactions...');
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log('Connected!');

    const transactionsCol = conn.collection('transactions');

    // Delete any transaction with reference starting with "double_test_"
    const result = await transactionsCol.deleteMany({
      reference: { $regex: /^double_test_/ }
    });

    console.log(`🧹 Deleted ${result.deletedCount} mock transaction(s).`);

    await conn.close();
    console.log('Cleanup completed.');
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }
}

cleanupMockTransaction();
