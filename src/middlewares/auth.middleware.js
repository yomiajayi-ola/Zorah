import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id || decoded._id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          status: "fail",
          message: "Not authorized, user account not found or deactivated"
        });
      }

      return next();
    } catch (error) {
      return res.status(401).json({
        status: "fail",
        message: "Not authorized, token failed"
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      status: "fail",
      message: "Not authorized, no token provided"
    });
  }
};
