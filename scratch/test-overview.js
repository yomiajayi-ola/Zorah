import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Wallet from '../src/models/Wallet.js';
import User from '../src/models/User.js';
import KYC from '../src/models/Kyc.js';
import Transaction from '../src/models/Transaction.js';

dotenv.config({ path: '.env.production' });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const userId = '6a215b0a88cd215da95afbd2';
    const [user, wallet, kyc, recentTransactions] = await Promise.all([
      User.findById(userId).select("name email biometricEnabled KycStatus"),
      Wallet.findOne({ user: userId }),
      KYC.findOne({ user: userId }),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    const result = {
      account: {
        balance: wallet.balance,
        currency: wallet.currency || "NGN",
        accountNumber: wallet.accountNumber,
        accountName: wallet.accountName,
        tier: kyc?.tier || 1,
        xpressCustomerId: wallet.xpressCustomerId,
        xpressWalletId: wallet.xpressWalletId
      },
      kyc: {
        status: kyc?.walletStatus || "pending",
        currentTier: kyc?.tier || 1
      },
      recentTransactions
    };
    
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => console.error(err));
