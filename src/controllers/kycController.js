import KYC from "../models/Kyc.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { createCustomer } from "../services/xpressWalletService.js";

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

    // 4. Provision Customer on Xpress Wallet via isolated service
    const provisionResult = await createCustomer({
      email: userRecord.email,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      phoneNumber: phoneNumber || userRecord.phoneNumber,
      address,
      dateOfBirth,
      bvn,
      nin,
      userId
    });

    const xpressCustomer = provisionResult.customer;
    const xpressWallet = provisionResult.wallet;

    // Prevent linking the same Xpress Customer Wallet to a different Zorah user if recovered
    if (provisionResult.isRecovered && xpressCustomer?.id) {
      const alreadyLinked = await Wallet.findOne({ xpressCustomerId: xpressCustomer.id });
      if (alreadyLinked && alreadyLinked.user.toString() !== userId.toString()) {
        console.error(`[KYC Recovery] Customer ${xpressCustomer.id} is already linked to Zorah user ${alreadyLinked.user}`);
        return res.status(400).json({ 
          message: "This identity/BVN is already registered with another Zorah account. Please log into your existing account or contact support." 
        });
      }
    }

    // 5. Save KYC record
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
    console.log("Customer ID:", provisionResult.customerId);
    console.log("Account Number:", xpressWallet?.accountNumber);

    // 6. Create Wallet record
    const wallet = await Wallet.create({
      user: userId,
      name: "Zorah Wallet",
      accountType: "bank",
      xpressCustomerId: provisionResult.customerId, 
      xpressWalletId: xpressWallet?.id,
      accountNumber: xpressWallet?.accountNumber,
      accountName: xpressWallet?.accountName,
      balance: 0, // Ensure balance starts at 0
      tier: Number(tier),
      isDefault: true
    });
    
    // 7. Update User for global reference
    await User.findByIdAndUpdate(userId, { 
        walletId: xpressWallet?.accountNumber,
        xpressCustomerId: provisionResult.customerId,
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
  