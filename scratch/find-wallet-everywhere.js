import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
const uri = process.env.MONGO_URI || 'mongodb+srv://zorah:XYxPJUTqD4uYPoNi@cluster0.zptofjn.mongodb.net/';

async function findEverywhere() {
  console.log('Connecting to cluster root...');
  const client = await mongoose.createConnection(uri).asPromise();
  console.log('Connected!');

  // List all databases
  const adminDb = client.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('Databases found in cluster:', dbs.databases.map(d => d.name));

  for (const dbInfo of dbs.databases) {
    const dbName = dbInfo.name;
    const dbConn = client.useDb(dbName);
    try {
      const walletsCol = dbConn.collection('wallets');
      const matched = await walletsCol.findOne({ accountNumber: '1128270737' });
      if (matched) {
        console.log(`🎉 FOUND WALLET IN DB: "${dbName}"!`);
        console.log(matched);
        
        // Also check if user exists in this DB
        const usersCol = dbConn.collection('users');
        const user = await usersCol.findOne({ _id: matched.user });
        console.log('Associated User in DB:', user);
      }
    } catch (err) {
      console.log(`Error checking DB ${dbName}:`, err.message);
    }
  }

  await client.close();
}

findEverywhere();
