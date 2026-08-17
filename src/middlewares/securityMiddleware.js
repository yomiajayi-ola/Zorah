import rateLimit from "express-rate-limit";

// Auth rate limiter: Max 20 failed attempts per 15-minute window per account
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.AUTH_RATE_LIMIT_MAX ? Number(process.env.AUTH_RATE_LIMIT_MAX) : 20,
  skip: (req) => req.method === "OPTIONS" || process.env.NODE_ENV === "test", // Ignore CORS preflight & test runs
  skipSuccessfulRequests: true, // Only count failed attempts (4xx/5xx)
  keyGenerator: (req) => {
    // Key by IP + Email so one user/account's failed attempts never lock out other users
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : "";
    const rawForwarded = req.headers?.["x-forwarded-for"];
    const clientIp = (typeof rawForwarded === "string" ? rawForwarded.split(",")[0].trim() : null) || req.ip || "unknown";
    return email ? `${clientIp}_${email}` : clientIp;
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: "fail",
      message: "Too many failed attempts. Please try again after 15 minutes."
    });
  }
});

// General API rate limiter: Max 200 requests per 15-minute window for general API routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.GENERAL_RATE_LIMIT_MAX ? Number(process.env.GENERAL_RATE_LIMIT_MAX) : 200,
  skip: (req) => req.method === "OPTIONS" || process.env.NODE_ENV === "test", // Ignore CORS preflight requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: "fail",
      message: "Too many requests. Please try again later."
    });
  }
});

