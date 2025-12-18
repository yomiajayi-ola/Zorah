import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google ID token required" });
    }

    // 1️⃣ Verify Google token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name } = payload;

    // 2️⃣ Find existing user
    let user = await User.findOne({ email });

    // 3️⃣ Create user if not exists
    if (!user) {
      user = await User.create({
        name,
        email,
        googleId: sub,
        authProvider: "google",
      });
    }

    // 4️⃣ Issue Zorah tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save(); 

    res.status(200).json({
      message: "Google login successful",
      user,
      accessToken,
      refreshToken,
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ message: "Invalid Google token" });
  }
};
