// import { required } from "joi";
import mongoose from "mongoose";

const KycSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    walletId: { type: String },
    walletStatus: { type: String, default: "pending" },


    // Tier info
    tier: {
        type: Number,
        enum: [1, 2, 3],
        default: 1
    },

    // Basic Info
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    
    //Government IDs
    bvn: { type: String },
    nin: { type: String },

    //Media Uploads
    passportPhoto: { type: String },
    utilityBill: { type: String },

    // verification statuses
    isBVNVerified: { type: Boolean, default: false },
    isNINVerified: { type: Boolean, default: false },
    isAddressVerified: { type: Boolean, default: false },

    // System-level metadata
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    rejectionReason: { type: String },

}, { timestamps: true });

export default mongoose.model("KYC", KycSchema)