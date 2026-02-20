import axios from 'axios';
import crypto from 'crypto';

// Use your XPRESS_WEBHOOK_SECRET from your .env
const secret = "sk_sandbox_qOWv1SvoBGVo9QRGUT1LLjcZGZ83PNhUaCo9z5VbiCx844ha"; 
const url = "https://flashily-unintegrable-holden.ngrok-free.dev/api/webhooks/xpress";

const payload = JSON.stringify({
  event: "transaction.successful",
  data: {
    reference: "test-ref-" + Date.now(),
    amount: 1000,
    customer_id: "83aa2f04-f96c-436e-8941-e94d435134c4", // Emmanuel's ID
    type: "credit"
  }
});

// Generate the HMAC signature
const signature = crypto.createHmac('sha512', secret).update(payload).digest('hex');

axios.post(url, payload, {
  headers: {
    'Content-Type': 'application/json',
    'x-xpress-signature': signature // This is what was missing
  }
})
.then(res => console.log("Response:", res.data))
.catch(err => console.error("Error:", err.response?.data || err.message));