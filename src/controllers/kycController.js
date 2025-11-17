// import { error } from "winston";
import KYC from "../models/Kyc.js";
// import { date } from "joi";

export const submitKyc = async (req, res) => {
    try {
        const userId = req.user._id;

        // Check if user already submitted KYC 
        const existing = await KYC.findOne({ userId });
        if (existing) {
            return res.status(400).json({ message: "KYC already submitted or under review"})
        }

        // Destructure request data 
        const {
            tier, 
            name,
            dateOfBirth,
            phoneNumber,
            address,
            bvn,
            nin,
        } = req.body;

        const passportPhoto = req.files?.passportPhoto?.[0]?.location;
        const utilityBill = req.files?.utilityBill?.[0]?.location;

        // Tier-based validation (Dynamic logic)
        if (tier === "Tier 2" && !passportPhoto)
            throw new Error("Passport photo required for Tier 2");
        if  (tier === "Tier 3" && (!passportPhoto || !utilityBill))
            throw new error("Both Passport and utitlity Bill required for Tier 3");

        // Create record 
        const kyc = await KYC.create({
          user: userId,
          tier,
          name,
          dateOfBirth,
          phoneNumber,
          address,
          bvn,
          nin,
          passportPhoto,
          utilityBill,
      });
      

         // Create wallet on Xpress Wallet
    const walletPayload = {
        name,
        phone: phoneNumber,
        bvn,
        nin,
        address,
        dob: dateOfBirth,
        tier,
      };
  
      const config = {
        headers: {
          Authorization: `Bearer ${process.env.XPRESS_WALLET_API_KEY}`, // Your Xpress Wallet secret
          "Content-Type": "application/json",
        },
      };
  
      const walletResponse = await axios.post(
        "https://payment.xpress-wallet.com/api/v1/wallet/create",
        walletPayload,
        config
      );
  
      const { walletId, status } = walletResponse.data;
  
      // Store wallet info locally (you can store in both User & KYC)
      await User.findByIdAndUpdate(userId, { walletId });
      await KYC.findByIdAndUpdate(kyc._id, { walletId, walletStatus: status });
  

      // Respond
        res.status(201).json({
            message: "KYC submitted successfully. Wallet created on Xpress Wallet.",
            data: { kyc, walletId, status },
        });
    } catch (error) {
        console.error("KYC Error:", error.response?.data || error.message);
        res.status(400).json({
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
  