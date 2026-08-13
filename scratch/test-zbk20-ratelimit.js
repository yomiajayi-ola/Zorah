import express from "express";
import { authLimiter, generalLimiter } from "../src/middlewares/securityMiddleware.js";

async function runTests() {
  console.log("--- START ZBK-20 RATE LIMITER TESTS ---");

  const app = express();
  app.use(express.json());

  app.use("/api", generalLimiter);
  app.use("/api/auth", authLimiter);

  app.options("/api/auth/fail-test", (req, res) => {
    res.sendStatus(204);
  });

  app.post("/api/auth/fail-test", (req, res) => {
    res.status(400).json({ status: "fail", message: "Invalid credentials" });
  });

  app.post("/api/auth/success-test", (req, res) => {
    res.status(200).json({ status: "success", message: "Allowed" });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const failUrl = `http://localhost:${port}/api/auth/fail-test`;
  const successUrl = `http://localhost:${port}/api/auth/success-test`;

  try {
    // 1. Test OPTIONS preflight skipping
    for (let i = 1; i <= 20; i++) {
      const res = await fetch(failUrl, { method: "OPTIONS" });
      console.assert(res.status === 204, "OPTIONS request should succeed with 204");
    }
    console.log("OPTIONS preflight requests successfully bypassed rate limit.");

    // 2. Test Successful requests skipping
    for (let i = 1; i <= 15; i++) {
      const res = await fetch(successUrl, { method: "POST" });
      const data = await res.json();
      console.assert(res.status === 200, `Successful Request ${i} should succeed (200)`);
    }
    console.log("Successful (200 OK) requests successfully bypassed failed attempt count.");

    // 3. Test Failed requests limiting (Max 10 failed attempts allowed)
    for (let i = 1; i <= 10; i++) {
      const res = await fetch(failUrl, { method: "POST" });
      console.assert(res.status === 400, `Failed request ${i} should return 400`);
    }

    // 11th failed attempt should be blocked by authLimiter with 429
    const resBlocked = await fetch(failUrl, { method: "POST" });
    const dataBlocked = await resBlocked.json();
    console.assert(resBlocked.status === 429, "11th failed request should return 429");
    console.assert(dataBlocked.status === "fail", "Response status should be 'fail'");
    console.assert(dataBlocked.message === "Too many failed attempts. Please try again after 15 minutes.", "Response message mismatch");
    console.log("11th Failed Request correctly blocked by Rate Limiter: Status 429", dataBlocked);

    console.log("--- ALL ZBK-20 TESTS PASSED ---");
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
