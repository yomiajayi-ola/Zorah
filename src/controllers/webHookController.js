// /controllers/webhookController.js
import Transaction from "../models/Transaction.js";
import { verifySignature } from '../utils/signatureUtils.js';


export const handleWebhook = async (req, res) => {
  // 1. Tell Xpress Wallet you received the data

  console.log("--- WEBHOOK HEADERS RECEIVED ---");
  console.log(JSON.stringify(req.headers, null, 2));
  
  res.status(200).send('OK');

  try {
      const { eventType, data } = req.body;

      // 2. Filter for successful transactions
      if (eventType === 'transaction.success') {
          const reference = data.reference;

          // 3. Update the specific transaction record
          const transaction = await Transaction.findOneAndUpdate(
              { reference: reference, status: "pending" },
              { $set: { status: "successful", updatedAt: new Date() } },
              { new: true }
          );

          if (transaction) {
              console.log(`✅ Funding History updated for ref: ${reference}`);
          }
      }
  } catch (error) {
      console.error("Webhook processing error:", error);
  }
};