import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
  // Split name into First and Last for a more personalized experience
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  
  email: { type: String, unique: true, required: true, lowercase: true },
  
  // Added phoneNumber for WhatsApp/SMS notifications
  phoneNumber: { type: String, unique: true, sparse: true }, 
  
  password: { type: String },
  pin: { type: String },
  biometricEnabled: { type: Boolean, default: false },
  
  // Existing fields for OTP and KYC
  otp: { type: String },
  otpExpires: { type: Date },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  KycStatus: {
    type: String,
    enum: ["unverified", "pending", "verified", "rejected"],
    default: "unverified",
  },

  preferredReminderHour: { 
    type: Number, 
    default: 8, 
    min: 0, 
    max: 23 
  },

  googleId: { type: String },
  refreshToken: { type: String },
  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },

  // FCM Tokens for the push notifications we set up earlier
  fcmTokens: [{ type: String }], 

}, { timestamps: true });

// Virtual for getting the full name easily
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre("save", async function(next) {
  if (this.authProvider !== "local") return next();
  if (!this.isModified("password") || !this.password) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Added a helper for the PIN as well
userSchema.pre("save", async function(next) {
  if (!this.isModified("pin") || !this.pin) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });
};

export default mongoose.model("User", userSchema);