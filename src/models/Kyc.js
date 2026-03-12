// import { required } from "joi";
import mongoose from "mongoose";

// models/Kyc.js
const KycSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // Tier represents the VERIFICATION level
    tier: {
        type: Number,
        enum: [1, 2, 3],
        default: 1
    },

    fullName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    
    bvn: { type: String },
    nin: { type: String },

    passportPhoto: { type: String },
    utilityBill: { type: String },

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    rejectionReason: { type: String },

}, { timestamps: true });

export default mongoose.model("KYC", KycSchema)