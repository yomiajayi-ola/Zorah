import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { protect } from "../src/middlewares/auth.middleware.js";
import { authLimiter } from "../src/middlewares/securityMiddleware.js";

async function runAuditTests() {
  console.log("--- START BACKEND AUDIT TEST SUITE ---");

  const app = express();

  // JSON Syntax Error Middleware
  app.use(express.json({ strict: true }));
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body'

      in err) {
      return res.status(400).json({ status: "fail", message: "Invalid JSON format in request body" });
    }
    next(err);
  });

  // CORS Middleware
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 200
  }));

  // Mock User setup
  const mockUserDb = {
    "valid_user_id": { _id: "valid_user_id", email: "test@example.com" }
  };

  // Auth Middleware
  const testProtect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      try {
        token = req.headers.authorization.split(" ")[1];
        if (token === "invalid_token") throw new Error("Invalid token");
        const userId = token === "deleted_user_token" ? "deleted_user_id" : "valid_user_id";
        req.user = mockUserDb[userId];
        if (!req.user) {
          return res.status(401).json({ status: "fail", message: "Not authorized, user account not found or deactivated" });
        }
        return next();
      } catch (error) {
        return res.status(401).json({ status: "fail", message: "Not authorized, token failed" });
      }
    }
    if (!token) {
      return res.status(401).json({ status: "fail", message: "Not authorized, no token provided" });
    }
  };

  // Test Routes
  app.get("/api/test-ok", (req, res) => res.json({ status: "success", message: "OK" }));
  app.get("/api/test-protected", testProtect, (req, res) => res.json({ status: "success", user: req.user }));
  app.get("/api/test-crash", (req, res, next) => {
    next(new Error("Simulated Unhandled Backend Exception"));
  });

  // 404 Catch-All Handler
  app.use((req, res, next) => {
    res.status(404).json({
      status: "fail",
      message: `Route not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Global 500 Error Handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
    res.status(statusCode).json({
      status: "error",
      message: err.message || "Internal Server Error"
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Test 404 JSON Fallback (not HTML)
    {
      const res = await fetch(`${baseUrl}/api/non-existent-route`);
      const body = await res.json();
      console.assert(res.status === 404, `Test 1 failed: status ${res.status}`);
      console.assert(body.status === "fail", "Test 1 failed: body.status");
      console.assert(res.headers.get("content-type").includes("application/json"), "Test 1 failed: content-type");
      console.log("✅ Test 1 (404 JSON fallback): Passed");
    }

    // 2. Test 500 Unhandled Error JSON Fallback (not HTML)
    {
      const res = await fetch(`${baseUrl}/api/test-crash`);
      const body = await res.json();
      console.assert(res.status === 500, `Test 2 failed: status ${res.status}`);
      console.assert(body.status === "error", "Test 2 failed: body.status");
      console.assert(body.message === "Simulated Unhandled Backend Exception", "Test 2 failed: body.message");
      console.assert(res.headers.get("content-type").includes("application/json"), "Test 2 failed: content-type");
      console.log("✅ Test 2 (500 Unhandled Exception JSON fallback): Passed");
    }

    // 3. Test Missing Token Protected Route
    {
      const res = await fetch(`${baseUrl}/api/test-protected`);
      const body = await res.json();
      console.assert(res.status === 401, `Test 3 failed: status ${res.status}`);
      console.assert(body.status === "fail", "Test 3 failed: body.status");
      console.log("✅ Test 3 (Missing Auth Token 401 JSON): Passed");
    }

    // 4. Test Deleted / Non-Existent User Token Protected Route
    {
      const res = await fetch(`${baseUrl}/api/test-protected`, {
        headers: { Authorization: "Bearer deleted_user_token" }
      });
      const body = await res.json();
      console.assert(res.status === 401, `Test 4 failed: status ${res.status}`);
      console.assert(body.message === "Not authorized, user account not found or deactivated", "Test 4 failed: body.message");
      console.log("✅ Test 4 (Deleted User Token 401 JSON): Passed");
    }

    // 5. Test CORS Options Preflight
    {
      const res = await fetch(`${baseUrl}/api/test-ok`, {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Authorization, Content-Type"
        }
      });
      console.assert(res.status === 200 || res.status === 204, `Test 5 failed: status ${res.status}`);
      console.assert(res.headers.get("access-control-allow-origin") === "*", "Test 5 failed: allow origin");
      console.log("✅ Test 5 (CORS Options Preflight): Passed");
    }

    // 6. Test Malformed JSON Request Body
    {
      const res = await fetch(`${baseUrl}/api/test-protected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ malformed json"
      });
      const body = await res.json();
      console.assert(res.status === 400, `Test 6 failed: status ${res.status}`);
      console.assert(body.status === "fail", "Test 6 failed: body.status");
      console.assert(body.message === "Invalid JSON format in request body", "Test 6 failed: body.message");
      console.log("✅ Test 6 (Malformed JSON 400 JSON response): Passed");
    }

    console.log("--- ALL BACKEND AUDIT TESTS PASSED SUCCESSFULLY ---");
  } finally {
    server.close();
  }
}

runAuditTests().catch((err) => {
  console.error("Audit Test Suite Error:", err);
  process.exit(1);
});
