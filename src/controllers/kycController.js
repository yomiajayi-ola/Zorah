import KYC from "../models/Kyc.js";
import User from "../models/User.js";
import axios from "axios";

// ✅ submit KYC with multer support
export const submitKyc = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if KYC already exists
    const existing = await KYC.findOne({ user: userId });
    if (existing) {
      return res
        .status(400)
        .json({ message: "KYC already submitted or under review" });
    }

    // Multer populates req.body and req.files
    const {
      tier,
      fullName,
      dateOfBirth,
      phoneNumber,
      address,
      bvn,
      nin,
    } = req.body;

    if (!tier) return res.status(400).json({ message: "Tier is required" });
    if (!fullName || !dateOfBirth || !phoneNumber || !address)
      return res.status(400).json({ message: "Missing required fields" });

    // Handle file uploads
    const passportPhoto = req.files?.passportPhoto?.[0]?.buffer; // or .path/.location if S3
    const utilityBill = req.files?.utilityBill?.[0]?.buffer;

    // Tier validation
    if (Number(tier) === 2 && !passportPhoto) {
      return res
        .status(400)
        .json({ message: "Passport photo required for Tier 2" });
    }
    if (Number(tier) === 3 && (!passportPhoto || !utilityBill)) {
      return res.status(400).json({
        message: "Both Passport and Utility Bill required for Tier 3",
      });
    }

    // Create KYC record
    const kyc = await KYC.create({
      user: userId,
      tier: Number(tier),
      fullName,
      dateOfBirth,
      phoneNumber,
      address,
      bvn,
      nin,
      passportPhoto,
      utilityBill,
    });
    
    // Prepare wallet payload
    const walletPayload = {
      name: fullName,
      phone: phoneNumber,
      bvn,
      nin,
      address,
      dob: dateOfBirth,
      tier: Number(tier),
    };
    
    // Correct Xpress Wallet endpoint
    const walletResponse = await axios.post(
      "https://api.xpresswallet.io/api/v1/wallets",
      walletPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.XPRESS_WALLET_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    // Extract wallet data
    const walletId = walletResponse.data?.data?.walletId;
    const status = walletResponse.data?.data?.status;
    
    // Save wallet info
    await User.findByIdAndUpdate(userId, { walletId });
    await KYC.findByIdAndUpdate(kyc._id, { walletId, walletStatus: status });
    
    return res.status(201).json({
      message: `KYC submitted successfully for Tier ${tier}. Wallet created.`,
      data: { kyc, walletId, status },
    });
  } catch (error) {
    console.error("KYC Error:", error.response?.data || error.message);
    return res.status(400).json({
      message: error.response?.data?.message || error.message,
    });
  }
};



export const upgradeKYC = async (req, res) => {
    try {
      const userId = req.user._id;
      const { tier } = req.body;
  
      if (![2, 3].includes(Number(tier))) {
        return res.status(400).json({ message: "Invalid tier selected" });
      }
  
      const kyc = await KYC.findOne({ user: userId });
      if (!kyc) return res.status(404).json({ message: "KYC record not found" });
  
      // Handle uploads (passport, utility bill)
      if (req.files?.passportPhoto) {
        kyc.passportPhoto = req.files.passportPhoto[0].path;
      }
  
      if (req.files?.utilityBill) {
        kyc.utilityBill = req.files.utilityBill[0].path;
      }
  
      kyc.tier = tier;
      await kyc.save();
  
      res.status(200).json({ message: `Upgraded to Tier ${tier}`, kyc });
    } catch (error) {
      res.status(500).json({ message: "Error upgrading KYC", error: error.message });
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
  