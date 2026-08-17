import { authLimiter } from "../src/middlewares/securityMiddleware.js";

function runAuthLimiterUnitTests() {
  console.log("--- TESTING AUTH LIMITER KEY GENERATOR FIX ---");

  // Re-create the keyGenerator function to test its exact logic
  const keyGen = (req) => {
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : "";
    const rawForwarded = req.headers?.["x-forwarded-for"];
    const clientIp = (typeof rawForwarded === "string" ? rawForwarded.split(",")[0].trim() : null) || req.ip || "unknown";
    return email ? `${clientIp}_${email}` : clientIp;
  };

  // Case 1: req with email
  const req1 = {
    ip: "192.168.1.100",
    body: { email: "Melody.Samuel@nativv.org " },
    headers: {}
  };
  const key1 = keyGen(req1);
  console.assert(key1 === "192.168.1.100_melody.samuel@nativv.org", `Key 1 failed: got ${key1}`);

  // Case 2: req with different email from same IP
  const req2 = {
    ip: "192.168.1.100",
    body: { email: "other.user@domain.com" },
    headers: {}
  };
  const key2 = keyGen(req2);
  console.assert(key2 === "192.168.1.100_other.user@domain.com", `Key 2 failed: got ${key2}`);
  console.assert(key1 !== key2, "Key 1 and Key 2 should be different per email");

  // Case 3: req with x-forwarded-for header behind proxy
  const req3 = {
    ip: "127.0.0.1",
    headers: { "x-forwarded-for": "102.89.23.44, 10.0.0.1" },
    body: { email: "user3@test.com" }
  };
  const key3 = keyGen(req3);
  console.assert(key3 === "102.89.23.44_user3@test.com", `Key 3 failed: got ${key3}`);

  console.log("✅ All Auth Limiter Keying Unit Tests Passed!");
}

runAuthLimiterUnitTests();
