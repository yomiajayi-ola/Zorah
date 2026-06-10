import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });
const uri = process.env.MONGO_URI;

async function cleanup() {
  console.log('Connecting to Production Database to clean up...');
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log('Connected!');

    const usersCol = conn.collection('users');
    const walletsCol = conn.collection('wallets');
    const kycsCol = conn.collection('kycs');

    // User ID of production_test@getzorah.com
    const userId = new mongoose.Types.ObjectId('6a215b0a88cd215da95afbd2');

    // 1. Delete duplicate wallet
    const deleteWalletResult = await walletsCol.deleteOne({ user: userId });
    console.log('Deleted duplicate wallets count:', deleteWalletResult.deletedCount);

    // 2. Delete duplicate KYC
    const deleteKycResult = await kycsCol.deleteOne({ user: userId });
    console.log('Deleted duplicate KYCs count:', deleteKycResult.deletedCount);

    // 3. Reset user status
    const updateUserResult = await usersCol.updateOne(
      { _id: userId },
      { $set: { KycStatus: 'unverified' }, $unset: { walletId: "" } }
    );
    console.log('Reset user status matched/modified:', updateUserResult.matchedCount, '/', updateUserResult.modifiedCount);

    await conn.close();
    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }
}

cleanup();
