import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

const XPRESS_BASE_URL = process.env.XPRESS_WALLET_API_URL || "https://payment.xpress-wallet.com/api/v1";
const xpressCustomerId = 'b702a3f6-bcdf-4c72-8bd4-afeeba873c63';

axios.get(`${XPRESS_BASE_URL}/customer/${xpressCustomerId}`, {
  headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` }
})
.then(res => console.log(JSON.stringify(res.data, null, 2)))
.catch(err => console.error(err.response ? err.response.data : err.message));
