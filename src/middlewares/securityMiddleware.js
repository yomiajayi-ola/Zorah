import rateLimit from "express-rate-limit";

// Auth rate limiter: Max 5 requests per 15-minute window for auth/sensitive routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: "fail",
      message: "Too many failed attempts. Please try again after 15 minutes."
    });
  }
});

// General API rate limiter: Max 100 requests per 15-minute window for general API routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: "fail",
      message: "Too many requests. Please try again later."
    });
  }
});
