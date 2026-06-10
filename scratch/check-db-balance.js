import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Wallet from '../src/models/Wallet.js';

dotenv.config({ path: '.env.production' });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const wallets = await Wallet.find({ xpressCustomerId: 'b702a3f6-bcdf-4c72-8bd4-afeeba873c63' });
    console.log(wallets);
    process.exit(0);
  })
  .catch(err => console.error(err));
