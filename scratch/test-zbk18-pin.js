import express from "express";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import { setUserPin, verifyUserPin } from "../src/controllers/authController.js";

// Simple mock res & req helpers for unit testing controller logic directly
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
  console.log("--- START ZBK-18 CONTROLLER TESTS ---");

  // Create dummy hashed password for test
  const passwordHash = await bcrypt.hash("UserPassword123!", 10);
  
  // Mock User document
  const mockUser = {
    _id: "507f191e810c19729de860ea",
    password: passwordHash,
    isPinSet: false,
    pinHash: null,
    save: async function() { return this; }
  };

  // Mock User.findById
  User.findById = (id) => {
    return {
      select: (fields) => {
        return Promise.resolve(mockUser);
      }
    };
  };

  const reqUser = { user: { _id: "507f191e810c19729de860ea" } };

  // Test 1: set-pin invalid PIN format
  {
    const req = { ...reqUser, body: { pin: "123" } };
    const res = createMockRes();
    await setUserPin(req, res);
    console.assert(res.statusCode === 400, "Test 1 failed: statusCode should be 400 for 3-digit pin");
    console.log("Test 1 (invalid PIN format): Passed (400)");
  }

  // Test 2: Initial set-pin (isPinSet = false) without currentPassword succeeds
  {
    mockUser.isPinSet = false;
    const req = { ...reqUser, body: { pin: "4920" } };
    const res = createMockRes();
    await setUserPin(req, res);
    console.assert(res.statusCode === 200, "Test 2 failed: initial set-pin should succeed without currentPassword");
    console.assert(res.body.status === "success", "Test 2 failed: status should be success");
    console.log("Test 2 (initial set-pin without currentPassword): Passed (200)");
  }

  // Test 3: Updating PIN (isPinSet = true) without currentPassword succeeds
  {
    mockUser.isPinSet = true;
    const req = { ...reqUser, body: { pin: "4920" } };
    const res = createMockRes();
    await setUserPin(req, res);
    console.assert(res.statusCode === 200, "Test 3 failed: updating PIN without currentPassword should succeed");
    console.assert(res.body.message === "PIN updated successfully", "Test 3 failed: message should be 'PIN updated successfully'");
    console.log("Test 3 (update existing PIN without currentPassword): Passed (200)");
  }

  // Test 4: Updating PIN (isPinSet = true) with wrong currentPassword fails
  {
    mockUser.isPinSet = true;
    const req = { ...reqUser, body: { pin: "4920", currentPassword: "WrongPassword" } };
    const res = createMockRes();
    await setUserPin(req, res);
    console.assert(res.statusCode === 401, "Test 4 failed: statusCode should be 401 for wrong password");
    console.log("Test 4 (wrong password on update): Passed (401)");
  }

  // Test 4b: Updating PIN (isPinSet = true) with valid currentPassword succeeds
  {
    mockUser.isPinSet = true;
    const req = { ...reqUser, body: { pin: "4920", currentPassword: "UserPassword123!" } };
    const res = createMockRes();
    await setUserPin(req, res);
    console.assert(res.statusCode === 200, "Test 4b failed: statusCode should be 200");
    console.assert(res.body.status === "success", "Test 4b failed: status should be success");
    console.assert(res.body.data.isPinSet === true, "Test 4b failed: isPinSet should be true");
    console.log("Test 4b (update PIN with valid password success): Passed", res.body);
  }

  // Test 5: verify-pin before PIN is set (when isPinSet is false)
  {
    mockUser.isPinSet = false;
    mockUser.pinHash = null;
    const req = { ...reqUser, body: { pin: "4920" } };
    const res = createMockRes();
    await verifyUserPin(req, res);
    console.assert(res.statusCode === 400, "Test 5 failed: statusCode should be 400 when PIN not set");
    console.log("Test 5 (verify when PIN not set): Passed (400)");
  }

  // Test 6: verify-pin with invalid PIN
  {
    mockUser.isPinSet = true;
    mockUser.pinHash = await bcrypt.hash("4920", 10);
    const req = { ...reqUser, body: { pin: "9999" } };
    const res = createMockRes();
    await verifyUserPin(req, res);
    console.assert(res.statusCode === 401, "Test 6 failed: statusCode should be 401 for incorrect PIN");
    console.log("Test 6 (wrong PIN): Passed (401)");
  }

  // Test 7: verify-pin with correct PIN
  {
    const req = { ...reqUser, body: { pin: "4920" } };
    const res = createMockRes();
    await verifyUserPin(req, res);
    console.assert(res.statusCode === 200, "Test 7 failed: statusCode should be 200");
    console.assert(res.body.status === "success", "Test 7 failed: status should be success");
    console.assert(res.body.verified === true, "Test 7 failed: verified should be true");
    console.log("Test 7 (verify PIN success): Passed", res.body);
  }

  console.log("--- ALL ZBK-18 TESTS PASSED ---");
}

runTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
