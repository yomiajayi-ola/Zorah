import mongoose from "mongoose";

const merchantRuleSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  
  // The 'learned' string from a messy narration (e.g., "UBER", "CHICKEN REP")
  pattern: { 
    type: String, 
    required: true, 
    trim: true,
    uppercase: true 
  },
  
  // The category the user assigned (e.g., "Transport", "Food")
  category: { 
    type: String, 
    required: true 
  },

  // Metadata to track how reliable this rule is
  usageCount: { 
    type: Number, 
    default: 1 
  },
  
  lastUsed: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Ensure a user doesn't have duplicate patterns for different categories
merchantRuleSchema.index({ user: 1, pattern: 1 }, { unique: true });

export default mongoose.model("MerchantRule", merchantRuleSchema);