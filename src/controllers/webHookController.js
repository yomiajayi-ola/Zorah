import crypto from 'crypto';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';

export const xpressWebhook = async (req, res) => {
  try {
    console.log("📥 Step 1: Webhook reached controller");

    if (!req.rawBody) {
      throw new Error("req.rawBody is undefined. Check your middleware order in app.js.");
    }

    const signature = req.headers['x-xpress-signature'] || req.headers['X-XPRESS-SIGNATURE'];
    const secret = process.env.XPRESS_WEBHOOK_SECRET;

    const hmac = crypto.createHmac('sha512', secret);
    const expectedSignature = hmac.update(req.rawBody).digest('hex');

    if (signature !== expectedSignature) {
      console.error("❌ Step 2: Signature Mismatch");
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(req.rawBody.toString());
    const { event, data } = payload;
    console.log(`🔔 Step 3: Verified Event - ${event}`);

    if (event === 'transaction.successful') {
      const { reference, amount, customer_id, type } = data;

      // Check if wallet exists first
      const wallet = await Wallet.findOne({ xpressCustomerId: customer_id });
      if (!wallet) {
        console.error(`❌ Step 4: Wallet NOT found for ID: ${customer_id}`);
        return res.status(404).send('Wallet not found');
      }

      console.log(`✅ Step 5: Wallet found for ${wallet.accountName}`);

      // Simplified Transaction creation to avoid validation errors
      let transaction = await Transaction.findOne({ reference });
      if (!transaction) {
        transaction = new Transaction({
          user: wallet.user, 
          type: type, // This will be 'credit' or 'debit' from Xpress data
          amount: Number(amount),
          purpose: type === 'credit' ? 'deposit' : 'withdrawal', // Map to purpose
          reference: reference,
          status: 'successful'
        });
        await transaction.save();
        console.log(`📝 Transaction record created for ${wallet.accountName}`);
      }

      // Update Balance
      if (type === 'credit') {
        wallet.balance += Number(amount);
      } else {
        wallet.balance -= Number(amount);
      }
      await wallet.save();
      console.log(`💰 Step 6: Balance Updated! New Balance: ${wallet.balance}`);
    }

    res.status(200).send('Webhook Processed');

  } catch (error) {
    // THIS LOG IS THE MOST IMPORTANT
    console.error('🔥 SERVER CRASHED AT:', error.message);
    console.error(error.stack); 
    res.status(500).send('Internal Processing Failure');
  }
};