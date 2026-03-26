import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { access } from "fs";
import { sendEmail } from "../utils/sendEmail.js";



// @desc Register new user
// @desc Register new user
export const registerUser = async (req, res) => {
  try {
    // 1. Destructure the NEW fields from req.body
    const { 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      password, 
      preferredReminderHour, 
      biometricEnabled 
    } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // 2. Pass those variables into User.create
    const user = await User.create({ 
      firstName, 
      lastName, 
      email, 
      phoneNumber,
      password, 
      preferredReminderHour,
      biometricEnabled: biometricEnabled || false 
    });

    const token = user.getSignedJwtToken(); 

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName, 
      lastName: user.lastName,
      fullName: user.fullName,   
      email: user.email,
      phoneNumber: user.phoneNumber,
      preferredReminderHour: user.preferredReminderHour, 
      biometricEnabled: user.biometricEnabled,
      token, 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Login user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (user.authProvider === "google") {
      return res.status(400).json({
        message: "Please login with Google",
      });
    }    

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // Optionally store refreshToken in DB if you want to invalidate later
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get user profile (Protected)
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

// Set or update a user's pin 
export const setUserPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length < 4)
      return res.status(400).json({ message: "PIN must be at least 4 digits" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.pin = await bcrypt.hash(pin, salt);
    await user.save();

    res.json({ message: "PIN set successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify user's pin 
export const verifyUserPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || !user.pin)
      return res.status(404).json({ message: "No PIN found for this user" });

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch)
      return res.status(401).json({ message: "Incorrect PIN" });

    res.json({ message: "PIN verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle biometric authentication
export const toggleBiometric = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean")
      return res.status(400).json({ message: "Enabled must be true or false" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.biometricEnabled = enabled;
    await user.save();

    res.json({
      message: `Biometric authentication ${enabled ? "enabled" : "disabled"} successfully`,
      biometricEnabled: user.biometricEnabled,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Reqquest Password reset 
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP via email
    const message = `
      <h2>Password Reset OTP</h2>
      <p>Hi ${user.name || "there"},</p>
      <p>Your OTP to reset your password is: <strong>${otp}</strong></p>
      <p>This OTP expires in 10 minutes.</p>
    `;

    await sendEmail({
      email: user.email,
      subject: "Zorah Password Reset OTP",
      message,
    });

    res.json({ message: "OTP sent successfully to your email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Reset password using token
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired or invalid" });
    }
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    // Update password
    // const salt = await bcrypt.genSalt(10);
    // user.password = await bcrypt.hash(newPassword, salt);
    user.password = newPassword;
    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;

    if (user.authProvider === "google") {
      return res.status(400).json({
        message: "Password reset not available for Google accounts",
      });
    }    

    await user.save();

    res.json({ message: "Password reset successful, please login" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Refresh access token 
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify refresh token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid or expired refresh token" });

      // Confirm the user still exists
      const user = await User.findById(decoded.id || decoded._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // (Optional) - Save refreshToken in DB:
      // if (user.refreshToken !== refreshToken) {
      //   return res.status(403).json({ message: "Refresh token mismatch" });
      // }

      // Generate a new access token
      const newAccessToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      res.json({
        message: "New access token generated successfully",
        accessToken: newAccessToken,
      });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//  GET User Profile (Includes Usage Flags)
export const updateOnboardingProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { step, data } = req.body; 

    if (!step) {
      return res.status(400).json({ status: "failed", message: "Step identifier is required." });
    }

    const updateObject = {};
    
    switch (step) {
      case "goals":
        // Step 1 requires data
        if (!data?.financialGoals) return res.status(400).json({ message: "Goals data required" });
        updateObject["onboarding.financialGoals"] = data.financialGoals;
        break;

      case "income":
        // Step 2 requires data
        if (!data?.incomeSource) return res.status(400).json({ message: "Income data required" });
        updateObject["onboarding.incomeSource"] = data.incomeSource;
        break;

      case "kyc":
        // Step 3 is SYNC ONLY (Data handled by Xpress Wallet API)
        updateObject["onboarding.kycCompleted"] = true; 
        break;

      case "integration":
        // Step 4 is SYNC ONLY (Data handled by Bank API)
        updateObject["onboarding.accountIntegrated"] = true;
        break;

      default:
        return res.status(400).json({ status: "failed", message: "Invalid onboarding step." });
    }

    // 2. Persist data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: updateObject,
        $addToSet: { "onboarding.stepsCompleted": step }, 
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ status: "failed", message: "User not found" });
    }

    // 3. New 4-Step Flow Logic
    const flow = ["goals", "income", "kyc", "integration"]; // Removed biometrics
    const completed = updatedUser.onboarding.stepsCompleted;
    
    // Find the next available step in the 4-step sequence
    const nextStep = flow.find(s => !completed.includes(s)) || "completed";
    
    if (nextStep === "completed") {
        updatedUser.onboarding.hasCompletedOnboarding = true;
        updatedUser.onboarding.currentStep = "completed";
        // Also update the top-level flag if you have one
        updatedUser.hasCompletedOnboarding = true; 
    } else {
        updatedUser.onboarding.currentStep = nextStep;
        updatedUser.onboarding.hasCompletedOnboarding = false; 
    }

    await updatedUser.save();

    return res.status(200).json({
      status: "success",
      message: `Progress saved for step: ${step}`,
      data: {
          stepsCompleted: updatedUser.onboarding.stepsCompleted,
          currentStep: updatedUser.onboarding.currentStep,
          hasCompletedOnboarding: updatedUser.onboarding.hasCompletedOnboarding,
          nextStep: nextStep === "completed" ? null : nextStep
      }
    });

  } catch (error) {
    console.error("[ONBOARDING_UPDATE_ERROR]:", error);
    return res.status(500).json({ status: "error", message: error.message });
  } 
};


// @desc    Update user profile details
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, phoneNumber } = req.body;

    // 1. Handle Name Splitting (Full Name -> First & Last)
    if (name) {
      const nameParts = name.trim().split(" ");
      user.firstName = nameParts[0] || user.firstName;
      // Join remaining parts as lastName (e.g., "Akeem Oluwasey Mudash" -> "Oluwasey Mudash")
      user.lastName = nameParts.slice(1).join(" ") || user.lastName;
    }

    // 2. Handle Email Change (Check for duplicates)
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }

    // 3. Update Phone Number
    if (phoneNumber) {
      user.phoneNumber = phoneNumber;
    }

    const updatedUser = await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        isUsageRestricted: updatedUser.onboarding?.isUsageRestricted ?? true
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};