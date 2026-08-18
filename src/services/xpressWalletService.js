import axios from "axios";
import https from "https";

const XPRESS_BASE_URL = process.env.XPRESS_WALLET_API_URL || "https://payment.xpress-wallet.com/api/v1";

// Create isolated Axios instance with 15-second timeout and default headers
const xpressClient = axios.create({
  baseURL: XPRESS_BASE_URL,
  timeout: 15000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

// Interceptor to dynamically attach Authorization header for each request
xpressClient.interceptors.request.use((config) => {
  const secretKey = process.env.XPRESS_WALLET_SECRET_KEY;
  if (secretKey) {
    config.headers.Authorization = `Bearer ${secretKey}`;
  }
  config.headers["Content-Type"] = "application/json";
  return config;
});

/**
 * Provisions a customer on Xpress Wallet.
 * Gracefully handles duplicate customer error ("Customer already exist.") via GET /customer recovery.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} [params.phoneNumber]
 * @param {string} [params.address]
 * @param {string} [params.dateOfBirth]
 * @param {string} [params.bvn]
 * @param {string} [params.nin]
 * @param {string} [params.userId]
 * @returns {Promise<{ success: boolean, customerId: string, customer: Object, wallet?: Object, isRecovered?: boolean }>}
 */
export const createCustomer = async ({
  email,
  firstName,
  lastName,
  phoneNumber,
  address,
  dateOfBirth,
  bvn,
  nin,
  userId
}) => {
  if (!email || !firstName || !lastName) {
    throw new Error("Missing required customer provisioning fields: email, firstName, lastName are required.");
  }

  const payload = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
    bvn: bvn ? bvn.trim() : undefined,
    address: address ? address.trim() : undefined,
    dateOfBirth: dateOfBirth ? dateOfBirth.trim() : undefined,
    accountPrefix: "11",
    metadata: {
      nin: nin ? nin.trim() : undefined,
      userId: userId ? userId.toString() : undefined
    }
  };

  try {
    const response = await xpressClient.post("/wallet", payload);
    const customerData = response.data?.customer;
    const walletData = response.data?.wallet;

    const customerId = customerData?.id || customerData?.customerId;

    return {
      success: true,
      customerId,
      customer: customerData,
      wallet: walletData,
      isRecovered: false
    };
  } catch (apiError) {
    const errorMessage = apiError.response?.data?.message || apiError.message;

    if (errorMessage === "Customer already exist.") {
      console.log(`[XpressWalletService] Customer already exists. Attempting recovery for email: ${email}`);

      try {
        const customersResponse = await xpressClient.get("/customer?perPage=1000");
        const targetEmail = email.trim().toLowerCase();

        const matchedCustomer = customersResponse.data?.customers?.find(
          (c) => c.email && c.email.toLowerCase() === targetEmail
        );

        if (matchedCustomer) {
          console.log(`[XpressWalletService] Match recovered for ${email}: Customer ID=${matchedCustomer.id}`);
          return {
            success: true,
            customerId: matchedCustomer.id,
            customer: {
              id: matchedCustomer.id,
              firstName: matchedCustomer.firstName,
              lastName: matchedCustomer.lastName,
              email: matchedCustomer.email,
              phoneNumber: matchedCustomer.phoneNumber
            },
            wallet: {
              id: matchedCustomer.walletId,
              accountNumber: matchedCustomer.accountNumber,
              accountName: matchedCustomer.accountName || `${matchedCustomer.firstName} ${matchedCustomer.lastName}`,
              customerId: matchedCustomer.id
            },
            isRecovered: true
          };
        } else {
          console.error(`[XpressWalletService] Customer exists error returned, but no matching record found for email: ${email}`);
          throw new Error(`Customer already exists on Xpress Wallet, but record recovery failed for email ${email}.`);
        }
      } catch (recoveryError) {
        throw new Error(recoveryError.response?.data?.message || recoveryError.message);
      }
    }

    throw new Error(errorMessage || "Xpress Wallet customer provisioning failed.");
  }
};

export const createVirtualAccount = async ({
  customerId,
  email,
  firstName,
  lastName,
  phoneNumber,
  address,
  dateOfBirth,
  bvn,
  nin,
  userId
}) => {
  // Fallback for test / offline environments when XPRESS_WALLET_SECRET_KEY is not configured
  if (!process.env.XPRESS_WALLET_SECRET_KEY && process.env.NODE_ENV !== "production") {
    console.warn("⚠️ [xpressWalletService] XPRESS_WALLET_SECRET_KEY missing. Using offline mock virtual account.");
    return {
      success: true,
      accountNumber: "1177214654",
      accountName: `${firstName} ${lastName}`.trim(),
      bankName: "Providus Bank",
      xpressWalletId: "wall_mock_999",
      xpressCustomerId: customerId || "cust_mock_123",
      isRecovered: false
    };
  }

  // 1. If customerId is provided or needs provisioning, invoke createCustomer
  const provisionResult = await createCustomer({
    email,
    firstName,
    lastName,
    phoneNumber,
    address,
    dateOfBirth,
    bvn,
    nin,
    userId
  });

  const walletData = provisionResult.wallet || {};
  const customerData = provisionResult.customer || {};

  const activeCustomerId = customerId || provisionResult.customerId || customerData.id;
  const accountNumber = walletData.accountNumber || "";
  const accountName = walletData.accountName || `${firstName} ${lastName}`.trim();
  const xpressWalletId = walletData.id || walletData.walletId || "";
  const bankName = walletData.bankName || "Providus Bank";

  return {
    success: true,
    accountNumber,
    accountName,
    bankName,
    xpressWalletId,
    xpressCustomerId: activeCustomerId,
    isRecovered: provisionResult.isRecovered || false
  };
};

export default {
  createCustomer,
  createVirtualAccount
};
