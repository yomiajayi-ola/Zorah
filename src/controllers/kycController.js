import https from 'https';
import KYC from "../models/Kyc.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import axios from "axios";
const XPRESS_BASE_URL = process.env.XPRESS_WALLET_API_URL || "https://payment.xpress-wallet.com/api/v1";

// ✅ submit KYC with multer support
export const submitKyc = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch the existing User data from the database
    const userRecord = await User.findById(userId);
    if (!userRecord) return res.status(404).json({ message: "User not found" });

    // 2. Check if KYC already exists
    const existingKyc = await KYC.findOne({ user: userId });
    if (existingKyc) {
      return res.status(400).json({ message: "Wallet already created for this user" });
    }

    // 3. Get ONLY the extra info from the request body (NIN, BVN, etc.)
    const { tier, dateOfBirth, phoneNumber, address, bvn, nin } = req.body;

    // Check if another user already has the same BVN or NIN locally
    if (bvn) {
      const bvnExists = await KYC.findOne({ bvn });
      if (bvnExists && bvnExists.user.toString() !== userId.toString()) {
        return res.status(400).json({ message: "This BVN is already registered with another account." });
      }
    }
    if (nin) {
      const ninExists = await KYC.findOne({ nin });
      if (ninExists && ninExists.user.toString() !== userId.toString()) {
        return res.status(400).json({ message: "This NIN is already registered with another account." });
      }
    }

    // 4. Construct the Xpress Payload using DB values for Names and Email
    const walletPayload = {
      firstName: userRecord.firstName, // 👈 Picked from Signup data
      lastName: userRecord.lastName,   // 👈 Picked from Signup data
      email: userRecord.email,         // 👈 Picked from Signup data
      phoneNumber: phoneNumber || userRecord.phoneNumber, 
      bvn,
      address,
      dateOfBirth,
      accountPrefix: "11",
      metadata: {
        nin: nin,
        userId: userId
      }
    };

    // 5. Call Xpress API with Recovery Fallback
    let xpressWallet;
    let xpressCustomer;

    try {
      const walletResponse = await axios.post(
        `${XPRESS_BASE_URL}/wallet`,
        walletPayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      xpressWallet = walletResponse.data.wallet;
      xpressCustomer = walletResponse.data.customer;
    } catch (apiError) {
      const errorMessage = apiError.response?.data?.message || apiError.message;
      
      if (errorMessage === "Customer already exist.") {
        console.log(`[KYC Recovery] Customer already exists on Xpress Wallet. Attempting recovery for user email: ${userRecord.email}`);
        
        // Fetch all customers from Xpress Wallet to locate the existing one
        const customersResponse = await axios.get(
          `${XPRESS_BASE_URL}/customer?perPage=1000`,
          {
            headers: {
              Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
            },
          }
        );
        
        const targetEmail = userRecord.email.toLowerCase();
        const targetPhone = phoneNumber || userRecord.phoneNumber;
        
        const matchedCustomer = customersResponse.data.customers?.find(
          (c) => c.email && c.email.toLowerCase() === targetEmail
        );
        
        if (matchedCustomer) {
          console.log(`[KYC Recovery] Match found on Xpress Wallet: ID=${matchedCustomer.id}, Acct=${matchedCustomer.accountNumber}`);
          
          // Prevent linking the same Xpress Customer Wallet to a different Zorah user
          const alreadyLinked = await Wallet.findOne({ xpressCustomerId: matchedCustomer.id });
          if (alreadyLinked && alreadyLinked.user.toString() !== userId.toString()) {
            console.error(`[KYC Recovery] Customer ${matchedCustomer.id} is already linked to Zorah user ${alreadyLinked.user}`);
            return res.status(400).json({ 
              message: "This identity/BVN is already registered with another Zorah account. Please log into your existing account or contact support." 
            });
          }

          xpressCustomer = {
            id: matchedCustomer.id
          };
          xpressWallet = {
            id: matchedCustomer.walletId,
            accountNumber: matchedCustomer.accountNumber,
            accountName: matchedCustomer.accountName || `${matchedCustomer.firstName} ${matchedCustomer.lastName}`,
            customerId: matchedCustomer.id
          };
        } else {
          console.error(`[KYC Recovery] Customer already exists error returned but could not find a matching record in Xpress Wallet list for email: ${userRecord.email}`);
          throw apiError;
        }
      } else {
        throw apiError;
      }
    } 

    // 6. Save KYC record
    const kyc = await KYC.create({
      user: userId,
      tier: Number(tier),
      fullName: `${userRecord.firstName} ${userRecord.lastName}`,
      dateOfBirth,
      phoneNumber,
      address,
      bvn,
      nin,
      status: "approved" 
    });
    
    console.log("--- ATTEMPTING WALLET CREATION ---");
    console.log("User ID:", userId);
    console.log("Customer ID:", xpressCustomer?.id);
    console.log("Account Number:", xpressWallet?.accountNumber);

    // 2. Create Wallet record
    const wallet = await Wallet.create({
      user: userId,
      name: "Zorah Wallet",
      accountType: "bank",
      xpressCustomerId: xpressCustomer?.id || xpressWallet?.customerId, 
      xpressWalletId: xpressWallet?.id,
      accountNumber: xpressWallet?.accountNumber,
      accountName: xpressWallet?.accountName,
      balance: 0, // Ensure balance starts at 0
      tier: Number(tier),
      isDefault: true
    });
    
    // 3. Update User for global reference
    await User.findByIdAndUpdate(userId, { 
        walletId: xpressWallet.accountNumber,
        KycStatus: "verified" 
    });

    return res.status(201).json({
      message: "Wallet created successfully using profile data!",
      accountNumber: xpressWallet.accountNumber
    });

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    return res.status(400).json({ message: errorMessage });
  }
};
  
export const upgradeKYC = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tier } = req.body;
    const requestedTier = Number(tier);

    // 1. Validate Tier Input
    if (![2, 3].includes(requestedTier)) {
      return res.status(400).json({ message: "Invalid tier. Choose 2 or 3." });
    }

    // 2. Fetch both records to get the Xpress Customer ID
    const [kyc, wallet] = await Promise.all([
      KYC.findOne({ user: userId }),
      Wallet.findOne({ user: userId })
    ]);

    if (!kyc || !wallet) {
      return res.status(404).json({ message: "KYC or Wallet record missing." });
    }

    // Prevent re-submitting current tier or downgrading
    if (requestedTier <= kyc.tier) {
      return res.status(400).json({ 
        message: `You are already at Tier ${kyc.tier}. Please select a higher tier to upgrade.` 
      });
    }

    // 3. Handle File Uploads (Using the location from your multer-s3 setup)
    const passportPhoto = req.files?.['passportPhoto']?.[0]?.location;
    const utilityBill = req.files?.['utilityBill']?.[0]?.location;

    // 1. Tier 2 Requirement: Passport Photo
    if (requestedTier === 2) {
        if (!passportPhoto) {
            return res.status(400).json({ message: "Passport photo is required for Tier 2 upgrade." });
        }
    }

    // 2. Tier 3 Requirement: Utility Bill ONLY
    if (requestedTier === 3) {
        if (!utilityBill) {
            return res.status(400).json({ message: "Utility bill is required for Tier 3 (Address Verification)." });
        }
    }

    const tierString = `TIER_${requestedTier}`;
    
    await axios.put(
      `${XPRESS_BASE_URL}/customer/${wallet.xpressCustomerId}`,
      {
        tier: tierString,
        metadata: {
          passportUrl: passportPhoto,
          billUrl: utilityBill
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`
        }
      }
    );

    // 5. Update our Internal Database (Keep everything in sync)
    kyc.tier = requestedTier;
    kyc.passportPhoto = passportPhoto;
    kyc.utilityBill = utilityBill;
    kyc.status = "pending"; // Usually goes to pending for manual review
    await kyc.save();

    wallet.tier = requestedTier;
    await wallet.save();

    

    // 6. Update User verification status
    await User.findByIdAndUpdate(userId, { KycStatus: "pending" });

    return res.status(200).json({
      message: `Upgrade to Tier ${requestedTier} submitted successfully.`,
      kyc
    });

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error("Upgrade Error:", errorMessage);
    return res.status(error.response?.status || 500).json({ message: errorMessage });
  }
};


  export const getKYCStatus = async (req, res) => {
    try {
      const userId = req.user._id;
      const kyc = await KYC.findOne({ user: userId });
  
      if (!kyc) {
        return res.status(404).json({ message: "No KYC record found" });
      }
  
      res.status(200).json({ kyc });
    } catch (error) {
      res.status(500).json({ message: "Error fetching KYC status", error: error.message });
    }
  };
  