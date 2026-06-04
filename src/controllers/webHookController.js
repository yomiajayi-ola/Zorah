import crypto from 'crypto';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';

export const xpressWebhook = async (req, res) => {
  try {
    console.log("📥 Step 1: Webhook reached controller");

    if (!req.rawBody) {
      throw new Error("req.rawBody is undefined. Check your middleware order in app.js.");
    }

    const signature = req.headers['x-xpresswallet-signature'] || req.headers['X-XPRESSWALLET-SIGNATURE'];
    const secret = process.env.XPRESS_WEBHOOK_SECRET;

    const hmac256 = crypto.createHmac('sha256', secret);
    const expected256 = hmac256.update(req.rawBody).digest('hex');

    const hmac512 = crypto.createHmac('sha512', secret);
    const expected512 = hmac512.update(req.rawBody).digest('hex');

    console.log("=== Webhook Verification Debug ===");
    console.log("Headers received:", JSON.stringify(req.headers));
    console.log("Signature received:", signature);
    console.log("Expected SHA256:", expected256);
    console.log("Expected SHA512:", expected512);
    console.log("Secret key used (truncated):", secret ? secret.slice(0, 15) + "..." : "undefined");
    console.log("Raw body string:", req.rawBody.toString());
    console.log("==================================");

    if (signature !== expected256 && signature !== expected512) {
      console.error("❌ Step 2: Signature Mismatch");
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(req.rawBody.toString());
    const { event, data } = payload;
    console.log(`🔔 Step 3: Verified Event - ${event}`);

    if (event === 'account_funded' || event === 'customer_wallet_credited') {
      const isAccountFunded = event === 'account_funded';
      const reference = data.reference;
      const amount = Number(data.amount);
      const customerId = isAccountFunded ? data.userId : data.customer_id;

      // Check if wallet exists first
      const wallet = await Wallet.findOne({ xpressCustomerId: customerId });
      if (!wallet) {
        console.error(`❌ Step 4: Wallet NOT found for ID: ${customerId}`);
        return res.status(404).send('Wallet not found');
      }

      console.log(`✅ Step 5: Wallet found for ${wallet.accountName}`);

      // Simplified Transaction creation to avoid validation errors
      let transaction = await Transaction.findOne({ reference });
      if (!transaction) {
        transaction = new Transaction({
          user: wallet.user, 
          type: 'credit',
          amount: amount,
          purpose: 'deposit',
          reference: reference,
          status: 'successful'
        });
        await transaction.save();
        console.log(`📝 Transaction record created for ${wallet.accountName}`);
        
        // Update Balance
        wallet.balance += amount;
        await wallet.save();
        console.log(`💰 Step 6: Balance Updated! New Balance: ${wallet.balance}`);
      } else {
        console.log(`🔄 Transaction ${reference} already processed`);
      }
    }

    res.status(200).send('Webhook Processed');

  } catch (error) {
    // THIS LOG IS THE MOST IMPORTANT
    console.error('🔥 SERVER CRASHED AT:', error.message);
    console.error(error.stack); 
    res.status(500).send('Internal Processing Failure');
  }
};