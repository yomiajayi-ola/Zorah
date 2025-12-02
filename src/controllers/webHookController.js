// /controllers/webhookController.js

import { verifySignature } from '../utils/signatureUtils'; // Assuming this path is correct
// import other necessary modules (Wallet, Transaction, etc.)

export const handleWebhook = async (req, res) => {
    // A. Acknowledge Receipt Immediately
    // Essential: Return a 200 OK fast to prevent the sender from retrying the hook.
    res.status(200).send('OK'); 

    // B. Security Check (Crucial!)
    // Pass the request object (req) and the secret key to the verification function
    if (!verifySignature(req, process.env.XPRESS_WEBHOOK_SECRET)) {
        console.error("Webhook failed signature verification. Unauthorized request ignored.");
        return; // Stop processing unauthorized request
    }

    // C. Process the Event (Only if signature is valid)
    try {
        const event = req.body;
        const { eventType, data } = event; 

        if (eventType === 'transaction.success') {
            const transactionReference = data.reference; 
            const amount = data.amount;

            // TODO: Add database update logic here:
            // 1. Find the pending Transaction using the reference.
            // 2. Find the Wallet using the transaction's user ID.
            // 3. Update wallet.balance += amount and wallet.save().
            // 4. Update transaction.status = "successful" and transaction.save().

            console.log(`Received successful transaction for ref: ${transactionReference}, amount: ${amount}`);
        }
    } catch (error) {
        // Log the error but do not send an error response (you already sent 200 OK).
        console.error("Error processing webhook event:", error);
    }
};