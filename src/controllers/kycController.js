import https from 'https';
import KYC from "../models/Kyc.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
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
    const passportPhoto = req.files?.['passportPhoto'] ? req.files['passportPhoto'][0].location : null;
    const utilityBill = req.files?.['utilityBill'] ? req.files['utilityBill'][0].buffer : null;   

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

    // 1. Split Full Name
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0]; // Use first name if no last name is found
    
    // 2. Format Tier String
    const tierString = `TIER_${Number(tier)}`;
    
    // 3. Prepare Correct Wallet Payload
    const walletPayload = {
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber, // Match required field name exactly
      bvn: bvn,
      nin: nin,
      address: address,
      dateOfBirth: dateOfBirth, // Match required field name exactly
      tier: tierString, // Use the TIER_N string format
      // You may also need to add 'email' if it's required by Xpress Wallet
    };
    
    // Prepare wallet payload
    // const walletPayload = {
    //   name: fullName,
    //   phone: phoneNumber,
    //   bvn,
    //   nin,
    //   address,
    //   dob: dateOfBirth,
    //   tier: Number(tier),
    // };
    
    // Correct Xpress Wallet endpoint
    console.log(process.env.XPRESS_WALLET_SECRET_KEY);
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

    // Log the raw response data to see the true structure
    // Extract wallet data from the 'wallet' object in the response
    const xpressWalletData = walletResponse.data.wallet;
    
    // The unique ID for the user's wallet is the 'accountNumber'
    const walletId = xpressWalletData?.accountNumber;
    
    // The status is available under the 'status' key
    const status = xpressWalletData?.status; 
    
    // Save wallet info
    await User.findByIdAndUpdate(userId, { walletId });
    await KYC.findByIdAndUpdate(kyc._id, { walletId, walletStatus: status }); // Assuming this is correct

    // const data = response.data;

    await Wallet.create({
      user: req.user.id,
      xpressCustomerId: walletResponse.data.customer.id,
      xpressWalletId: walletResponse.data.wallet.walletId,
      accountNumber: walletResponse.data.wallet.accountNumber,
      accountName: walletResponse.data.wallet.accountName
    });
    


    // REFRESH THE KYC OBJECT (Use findById if you need the entire updated doc)
    const updatedKyc = await KYC.findById(kyc._id);
    // OR manually update the original 'kyc' object for a simpler fix:
    kyc.walletId = walletId;
    kyc.walletStatus = status; // Assuming 'walletStatus' is the right field name
    // kyc.status = status; // Use this line if you want to update the main 'status' field

    return res.status(201).json({
      message: `KYC submitted successfully for Tier ${tier}. Wallet created.`,
      data: { kyc, walletId, status }, // Now 'kyc' object will show the correct status
    });
  } catch (error) {
    console.error("KYC Error:", error.response?.data || error.message);
    return res.status(400).json({
      message: error.response?.data?.message || error.message,
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

    // 1. Validate Tier Input
    if (![2, 3].includes(Number(tier))) {
      return res.status(400).json({ message: "Invalid tier selected. Choose 2 or 3." });
    }

    // 2. Fetch Records
    const [kyc, wallet] = await Promise.all([
      KYC.findOne({ user: userId }),
      Wallet.findOne({ user: userId })
    ]);

    if (!kyc) return res.status(404).json({ message: "KYC record not found. Please complete Tier 1 first." });
    if (!wallet) return res.status(404).json({ message: "Wallet not found. Ensure Tier 1 was fully processed." });

    // 3. File Handling & Validation
    const passportPhoto = req.files?.['passportPhoto']?.[0]?.location || req.files?.['passportPhoto']?.[0]?.path;
    const utilityBill = req.files?.['utilityBill']?.[0]?.location || req.files?.['utilityBill']?.[0]?.path;

    if (Number(tier) >= 2 && !passportPhoto && !kyc.passportPhoto) {
      return res.status(400).json({ message: "Passport photo is required for Tier 2 upgrade." });
    }
    if (Number(tier) === 3 && !utilityBill && !kyc.utilityBill) {
      return res.status(400).json({ message: "Utility bill is required for Tier 3 upgrade." });
    }

    if (passportPhoto) kyc.passportPhoto = passportPhoto;
    if (utilityBill) kyc.utilityBill = utilityBill;

    // 4. Update Xpress Wallet (External Source of Truth)
    const tierString = `TIER_${Number(tier)}`;

    console.log("Upgrading Xpress Wallet for Customer:", wallet.xpressWalletId);
    
    try {
      // Create an agent to handle the SSL handshake correctly
      const agent = new https.Agent({  
        rejectUnauthorized: false, // Prevents the SSL alert from crashing the request
        servername: 'api.xpresswallet.com' // Explicitly sends the correct SNI header
      });

      await axios.put(
        `https://payment.xpress-wallet.com/api/v1/customer/${wallet.xpressCustomerId}`,
        { 
          tier: tierString,
          metadata: {
            passportPhoto: kyc.passportPhoto,
            utilityBill: kyc.utilityBill
          }
        },
        { 
          headers: { Authorization: `Bearer ${process.env.XPRESS_WALLET_SECRET_KEY}` },
          httpsAgent: agent // Attach the agent here
        }
      );
    } catch (apiErr) {
      console.error("Xpress API Error:", apiErr.response?.data || apiErr.message);
      return res.status(400).json({ 
        message: "Xpress Wallet rejected the upgrade.", 
        details: apiErr.response?.data?.message || apiErr.message 
      });
    }

    // 5. Finalize Local Database
    kyc.tier = Number(tier);
    kyc.walletStatus = "active"; 
    await kyc.save();

    await User.findByIdAndUpdate(userId, { KycStatus: "verified" });

    res.status(200).json({ 
      message: `Successfully upgraded to Tier ${tier}`, 
      kyc 
    });

  } catch (error) {
    console.error("Internal Upgrade Error:", error);
    res.status(500).json({ message: "Server error during upgrade", error: error.message });
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
  