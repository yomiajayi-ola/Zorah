// /utils/signatureUtil.js

import crypto from 'crypto';

export const verifySignature = (req, secret) => {
    // 1. Get their signature from the request header (Verify the exact header name!)
    const signature = req.headers['x-xpress-signature'] || req.headers['X-XPRESS-SIGNATURE']; 
    if (!signature) {
        console.error("Signature header missing.");
        return false;
    }

    // 2. Get the raw body buffer saved by the middleware.
    // Ensure your Express middleware is saving this as 'req.rawBody'
    const rawBodyBuffer = req.rawBody;
    if (!rawBodyBuffer) {
        console.error("Raw body missing for signature calculation.");
        return false;
    }
    
    // 3. Compute your own hash (Assuming HMAC-SHA512, verify algorithm with Xpress Wallet)
    const hash = crypto
        .createHmac('sha512', secret) 
        .update(rawBodyBuffer) // Use the raw buffer
        .digest('hex');

    // 4. Compare your hash with theirs using constant-time comparison
    // We check if the computed hash string matches the signature string
    const isVerified = (hash === signature); 

    // Note: While `crypto.timingSafeEqual` is better for security, 
    // a simple string comparison often works if you ensure the string encoding/case matches.
    // For critical security: use `crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))`

    if (!isVerified) {
        console.error(`Signature mismatch! Computed: ${hash}, Received: ${signature}`);
    }
    
    return isVerified;
};