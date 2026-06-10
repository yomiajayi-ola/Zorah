import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const XPRESS_WALLET_SECRET_KEY = process.env.XPRESS_WALLET_SECRET_KEY;
const XPRESS_BASE_URL = "https://payment.xpress-wallet.com/api/v1";

console.log("Using Secret Key (truncated):", XPRESS_WALLET_SECRET_KEY ? XPRESS_WALLET_SECRET_KEY.slice(0, 15) + "..." : "undefined");

async function testAuth() {
  try {
    const response = await axios.get(`${XPRESS_BASE_URL}/customer?perPage=1`, {
      headers: {
        Authorization: `Bearer ${XPRESS_WALLET_SECRET_KEY}`,
      },
    });
    console.log("✅ Success! Connected to Xpress Wallet Live API.");
    console.log("Response data:", response.data);
  } catch (error) {
    console.error("❌ API Call Failed.");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error Message:", error.message);
    }
  }
}

testAuth();
