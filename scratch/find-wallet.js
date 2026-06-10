import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });
const stagingUri = process.env.MONGO_URI;

dotenv.config({ path: '.env.production' });
const productionUri = process.env.MONGO_URI;

async function checkDbs() {
  console.log('Searching databases...');

  // Check Staging
  try {
    const connStaging = await mongoose.createConnection(stagingUri).asPromise();
    const walletsCol = connStaging.collection('wallets');
    const matched = await walletsCol.findOne({ accountNumber: '1128270737' });
    if (matched) {
      console.log('✅ Found wallet in STAGING database!');
      console.log(matched);
    } else {
      console.log('❌ Not found in STAGING database.');
    }
    await connStaging.close();
  } catch (err) {
    console.error('Staging DB Error:', err.message);
  }

  // Check Production
  try {
    const connProd = await mongoose.createConnection(productionUri).asPromise();
    const walletsCol = connProd.collection('wallets');
    const matched = await walletsCol.findOne({ accountNumber: '1128270737' });
    if (matched) {
      console.log('✅ Found wallet in PRODUCTION database!');
      console.log(matched);
    } else {
      console.log('❌ Not found in PRODUCTION database.');
    }
    await connProd.close();
  } catch (err) {
    console.error('Production DB Error:', err.message);
  }
}

checkDbs();
