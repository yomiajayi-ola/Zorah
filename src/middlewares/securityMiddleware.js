import rateLimit from "express-rate-limit";

// Auth rate limiter: Max 10 failed attempts per 15-minute window for auth/sensitive routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: (req) => req.method === "OPTIONS", // Ignore CORS preflight requests from mobile
  skipSuccessfulRequests: true, // Only count failed attempts (4xx/5xx), so successful logins/PIN updates don't lock user out
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
  skip: (req) => req.method === "OPTIONS", // Ignore CORS preflight requests from mobile
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: "fail",
      message: "Too many requests. Please try again later."
    });
  }
});
