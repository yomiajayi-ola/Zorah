import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String },
  pin: { type: String },
  biometricEnabled: { type: Boolean, default: false },
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
    default: 8, // This ensures your static 8 AM system stays the default
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

}, { timestamps: true });

userSchema.pre("save", async function(next) {
  // 1. New Check: If the user's authentication provider is NOT "local", skip password hashing entirely.
  if (this.authProvider !== "local") return next();

  // 2. Existing Checks: Only hash if the password field was modified AND it's not null/empty.
  if (!this.isModified("password") || !this.password) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
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
    expiresIn: '30d'
  });
};

export default mongoose.model("User", userSchema);
