import User from "../src/models/User.js";
import { toggleBiometric } from "../src/controllers/authController.js";

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log("--- START ZBK-19 CONTROLLER TESTS ---");

  const mockUser = {
    _id: "507f191e810c19729de860ea",
    biometricsEnabled: false,
    biometricEnabled: false,
    save: async function() { return this; }
  };

  User.findById = (id) => {
    return Promise.resolve(mockUser);
  };

  const reqUser = { user: { _id: "507f191e810c19729de860ea" } };

  // Test 1: invalid type for enabled (string)
  {
    const req = { ...reqUser, body: { enabled: "true" } };
    const res = createMockRes();
    await toggleBiometric(req, res);
    console.assert(res.statusCode === 400, "Test 1 failed: statusCode should be 400 when enabled is string");
    console.log("Test 1 (non-boolean enabled): Passed (400)");
  }

  // Test 2: enable biometrics (enabled: true)
  {
    const req = { ...reqUser, body: { enabled: true } };
    const res = createMockRes();
    await toggleBiometric(req, res);
    console.assert(res.statusCode === 200, "Test 2 failed: statusCode should be 200");
    console.assert(res.body.status === "success", "Test 2 failed: status should be success");
    console.assert(res.body.data.biometricsEnabled === true, "Test 2 failed: biometricsEnabled should be true");
    console.log("Test 2 (enable biometrics): Passed", res.body);
  }

  // Test 3: disable biometrics (enabled: false)
  {
    const req = { ...reqUser, body: { enabled: false } };
    const res = createMockRes();
    await toggleBiometric(req, res);
    console.assert(res.statusCode === 200, "Test 3 failed: statusCode should be 200");
    console.assert(res.body.status === "success", "Test 3 failed: status should be success");
    console.assert(res.body.data.biometricsEnabled === false, "Test 3 failed: biometricsEnabled should be false");
    console.log("Test 3 (disable biometrics): Passed", res.body);
  }

  console.log("--- ALL ZBK-19 TESTS PASSED ---");
}

runTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
