import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });
const uri = process.env.MONGO_URI;

async function checkProductionRecords() {
  console.log('Connecting to Production Database:', uri);
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log('Connected!');

    const usersCol = conn.collection('users');
    const walletsCol = conn.collection('wallets');
    const kycsCol = conn.collection('kycs');

    // Find the user "Melody Samuel"
    const users = await usersCol.find({
      $or: [
        { email: /melody/i },
        { firstName: /melody/i },
        { lastName: /samuel/i }
      ]
    }).toArray();

    console.log(`\nFound ${users.length} matching user(s) in Production:`);
    for (const user of users) {
      console.log('--- User ---');
      console.log('ID:', user._id);
      console.log('Name:', user.firstName, user.lastName);
      console.log('Email:', user.email);
      console.log('Wallet ID:', user.walletId);
      console.log('KYC Status:', user.KycStatus);
      console.log('isVerified:', user.isVerified);

      // Find the associated Wallet record
      const wallet = await walletsCol.findOne({ user: user._id });
      if (wallet) {
        console.log('--- Associated Wallet ---');
        console.log('Wallet ID:', wallet._id);
        console.log('Account Number:', wallet.accountNumber);
        console.log('Account Name:', wallet.accountName);
        console.log('Xpress Customer ID:', wallet.xpressCustomerId);
        console.log('Xpress Wallet ID:', wallet.xpressWalletId);
      } else {
        console.log('❌ No Wallet record found for this user.');
      }

      // Find the associated KYC record
      const kyc = await kycsCol.findOne({ user: user._id });
      if (kyc) {
        console.log('--- Associated KYC ---');
        console.log('KYC ID:', kyc._id);
        console.log('Full Name:', kyc.fullName);
        console.log('BVN:', kyc.bvn);
        console.log('Phone Number:', kyc.phoneNumber);
        console.log('Tier:', kyc.tier);
      } else {
        console.log('❌ No KYC record found for this user.');
      }
    }

    await conn.close();
  } catch (err) {
    console.error('Database Error:', err.message);
  }
}

checkProductionRecords();
