import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { access } from "fs";
import { sendEmail } from "../utils/sendEmail.js";


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// @desc Register new user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
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

    User.biometricEnabled = enabled;
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
    if (!user ) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetExpires = Date.now() + 10 * 60 * 10000; // 10mins

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    // Html Reset password link 
    const resetUrl = `http://localhost:4000/reset-password/${resetToken}`;

    const message = `
    <h2>Password Reset Request</h2>
    <p>Hi ${user.name || "there"},</p>
    <p>You requested a password reset for your Zorah account.</p>
    <p>Click below to reset your password. This link expires in 10 minutes.</p>
    <a href="${resetUrl}"
    style="display:inline-block;padding:10px 15px;background:#4F46E5;color:white;text-decoration:none;border-radius:6px;">
    Reset Password
    </a>
    <p>If you didn't request this, just ignore this email.</p>`;

    await sendEmail({
      email: user.email,
      subject: "Zorah Password Reset",
      message,
    });

    // Instead of emanil for now;
    // console.log(`Reset Token (temporary): ${resetToken}`);

    // res.json({ message: "Password reset token generated (check console)" });
    res.json({ message: "Password reset email sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Reset password using token
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Find user by valid reset token expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
    return res.status(400).json({ message: "Invalid or expired reset token" });

    // Hash new password manually 
    // const  salt = await bcrypt.genSalt(10);
    user.password = newPassword;

    // clear reset fields 
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset succesful, please login" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

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