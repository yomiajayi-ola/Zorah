import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.XPRESS_WEBHOOK_SECRET;

const payload = {
  event: 'account_funded',
  data: {
    reference: 'mock_test_123',
    amount: '150.00',
    userId: 'mock_user_id',
    type: 'STATIC'
  }
};

const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

axios.post('http://13.48.253.14:4000/api/webhooks/xpress-wallet', rawBody, {
  headers: {
    'Content-Type': 'application/json',
    'x-xpresswallet-signature': signature
  }
}).then(res => {
  console.log('Success:', res.data);
}).catch(err => {
  console.error('Error:', err.response ? err.response.data : err.message);
});
