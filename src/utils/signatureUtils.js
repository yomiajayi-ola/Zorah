// /utils/signatureUtil.js
import crypto from 'crypto';

export const verifySignature = (req, secret) => {
    const signature = req.headers['x-xpress-signature'] || req.headers['X-XPRESS-SIGNATURE']; 
    const rawBody = req.rawBody;

    if (!signature || !rawBody) {
        console.error("Missing signature header or raw body");
        return false;
    }

    const hash = crypto
        .createHmac('sha512', secret) 
        .update(rawBody) 
        .digest('hex');

    // Use a timing-safe comparison
    const isVerified = crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(signature)
    );

    if (!isVerified) {
        console.error("Signature Mismatch!");
    }
    
    return isVerified;
};