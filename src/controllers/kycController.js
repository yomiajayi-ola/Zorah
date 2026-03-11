import https from 'https';
import KYC from "../models/Kyc.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import axios from "axios";

// ✅ submit KYC with multer support
export const submitKyc = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Initial Check
    const existing = await KYC.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ message: "KYC already submitted or under review" });
    }

    const { tier, fullName, dateOfBirth, phoneNumber, address, bvn, nin } = req.body;
    // ... validation logic (tier, missing fields, etc.) ...

    // 2. Prepare Data (But don't save to DB yet!)
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];
    const tierString = `TIER_${Number(tier)}`;

    const walletPayload = {
      firstName,
      lastName,
      phoneNumber,
      bvn,
      nin,
      address,
      dateOfBirth,
      tier: tierString,
    };

    // 3. Call External API FIRST
    // If this fails, the 'catch' block will handle it and NO records will be created in your DB
    const walletResponse = await axios.post(
      "https://payment.xpress-wallet.com/api/v1/wallet",
      walletPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const xpressWalletData = walletResponse.data.wallet;
    const walletId = xpressWalletData?.accountNumber;
    const status = xpressWalletData?.status;

    // 4. SAVE TO DATABASE ONLY AFTER SUCCESS
    // Since we are here, the API call succeeded. Now we persist the data.
    const kyc = await KYC.create({
      user: userId,
      tier: Number(tier),
      fullName,
      dateOfBirth,
      phoneNumber,
      address,
      bvn,
      nin,
      passportPhoto: req.files?.['passportPhoto'] ? req.files['passportPhoto'][0].location : null,
      utilityBill: req.files?.['utilityBill'] ? req.files['utilityBill'][0].buffer : null,
      walletId,
      walletStatus: status
    });

    await User.findByIdAndUpdate(userId, { walletId });

    await Wallet.create({
      user: userId,
      name: "Zorah Wallet",
      accountType: "bank",
      xpressCustomerId: walletResponse.data.customer.id,
      xpressWalletId: xpressWalletData.id,
      accountNumber: walletId,
      accountName: xpressWalletData.accountName,
      tier: Number(tier),
      status: "active"
    });

    return res.status(201).json({
      message: `KYC submitted successfully for Tier ${tier}. Wallet created.`,
      data: { kyc, walletId, status },
    });
  } catch (error) {
    // 5. Handle "Customer Already Exists"
    const errorMessage = error.response?.data?.message || error.message;
    console.error("KYC Error:", errorMessage);

    // If Xpress says they exist, but you don't have a record, 
    // you might want to handle that specifically here.
    return res.status(400).json({
      message: errorMessage,
    });
  }
};



// export const upgradeKYC = async (req, res) => {
//     try {
//       const userId = req.user._id;
//       const { tier } = req.body;
  
//       if (![2, 3].includes(Number(tier))) {
//         return res.status(400).json({ message: "Invalid tier selected" });
//       }
  
//       const kyc = await KYC.findOne({ user: userId });
//       if (!kyc) return res.status(404).json({ message: "KYC record not found" });
  
//       // Handle uploads (passport, utility bill)
//       if (req.files?.passportPhoto) {
//         kyc.passportPhoto = req.files.passportPhoto[0].path;
//       }
  
//       if (req.files?.utilityBill) {
//         kyc.utilityBill = req.files.utilityBill[0].path;
//       }
  
//       kyc.tier = tier;
//       await kyc.save();
  
//       res.status(200).json({ message: `Upgraded to Tier ${tier}`, kyc });
//     } catch (error) {
//       res.status(500).json({ message: "Error upgrading KYC", error: error.message });
//     }
//   };
  
export const upgradeKYC = async (req, res) => {
  try {
    const { customerId } = req.params;
    const userId = req.user._id;
    const { tier } = req.body;

    const requestedTier = Number(tier);

    if (![2, 3].includes(requestedTier)) {
      return res.status(400).json({
        message: "Invalid tier selected. Choose 2 or 3."
      });
    }

    const [kyc, wallet] = await Promise.all([
      KYC.findOne({ user: userId }),
      Wallet.findOne({ user: userId })
    ]);

    if (!kyc || !wallet) {
      return res.status(404).json({
        message: "KYC or Wallet record missing."
      });
    }

    // Optional: prevent downgrade
    if (requestedTier <= kyc.tier) {
      return res.status(400).json({
        message: "Invalid tier upgrade."
      });
    }

    // Handle file uploads
    const passportPhoto =
      req.files?.['passportPhoto']?.[0]?.location ||
      req.files?.['passportPhoto']?.[0]?.path;

    const utilityBill =
      req.files?.['utilityBill']?.[0]?.location ||
      req.files?.['utilityBill']?.[0]?.path;

    if (passportPhoto) kyc.passportPhoto = passportPhoto;
    if (utilityBill) kyc.utilityBill = utilityBill;

    // Update external wallet
    const tierString = `TIER_${requestedTier}`;

    await axios.put(
      `https://payment.xpress-wallet.com/api/v1/customer/${customerId}`,
      {
        tier: tierString,
        metadata: {
          passportPhoto: kyc.passportPhoto,
          utilityBill: kyc.utilityBill
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}`
        }
      }
    );

    // Update KYC
    kyc.tier = requestedTier;
    kyc.walletStatus = "active";
    await kyc.save();

    // Update Wallet
    wallet.tier = requestedTier;
    wallet.status = "active";
    wallet.updatedAt = new Date();
    await wallet.save();

    // Update User
    await User.findByIdAndUpdate(userId, {
      KycStatus: "verified"
    });

    return res.status(200).json({
      message: `Successfully upgraded to Tier ${requestedTier}`,
      kyc,
      wallet
    });

  } catch (error) {
    console.error("Upgrade Error:", error);
    return res.status(500).json({
      message: "Internal Error",
      error: error.message
    });
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
  