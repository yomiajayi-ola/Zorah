import axios from "axios";
import https from "https";

const XPRESS_BASE_URL = process.env.XPRESS_WALLET_API_URL || "https://payment.xpress-wallet.com/api/v1";
const SECRET_KEY = process.env.XPRESS_WALLET_SECRET_KEY || "sk_sandbox_qOWv1SvoBGVo9QRGUT1LLjcZGZ83PNhUaCo9z5VbiCx844ha";

async function checkXpressCustomers() {
  console.log("=== Checking Xpress Sandbox Registered Customers ===");
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get(`${XPRESS_BASE_URL}/customer?perPage=50`, {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
      httpsAgent: agent
    });
    console.log("Xpress API GET /customer status:", res.status);
    console.log("Customers count:", res.data?.customers?.length);
    if (res.data?.customers?.length > 0) {
      console.log("First 3 customers:", res.data.customers.slice(0, 3).map(c => ({
        id: c.id,
        email: c.email,
        name: `${c.firstName} ${c.lastName}`,
        walletId: c.walletId,
        accountNumber: c.accountNumber
      })));
    }
  } catch (err) {
    console.error("Xpress API GET /customer Error:", err.response?.data || err.message);
  }
}

checkXpressCustomers();
