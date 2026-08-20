import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import { transferToCustomer } from "../src/controllers/walletController.js";

async function testPinBehavior() {
  console.log("=== PIN Flow & matchPin Audit Test ===");

  // Test 1: User with pin set via authController setUserPin (user.pinHash set, user.pin undefined)
  const user1 = new User({
    firstName: "Test",
    lastName: "User1",
    email: "user1@test.com",
    isPinSet: true,
    pinHash: await bcrypt.hash("1234", 10)
  });

  console.log("User 1 pinHash:", user1.pinHash);
  console.log("User 1 pin:", user1.pin);
  console.log("User 1 matchPin('1234'):", await user1.matchPin("1234"));
  console.log("User 1 matchPin('9999'):", await user1.matchPin("9999"));

  // Test 2: User with pin set via schema pre-save (user.pin set, user.pinHash null/undefined)
  const salt = await bcrypt.genSalt(10);
  const user2 = new User({
    firstName: "Test",
    lastName: "User2",
    email: "user2@test.com",
    isPinSet: true,
    pin: await bcrypt.hash("1234", salt)
  });

  console.log("\nUser 2 pinHash:", user2.pinHash);
  console.log("User 2 pin:", user2.pin);
  console.log("User 2 matchPin('1234'):", await user2.matchPin("1234"));

  // Test 3: User with isPinSet = true, but pinHash and pin are both undefined/null
  const user3 = new User({
    firstName: "Test",
    lastName: "User3",
    email: "user3@test.com",
    isPinSet: true,
    pinHash: null,
    pin: undefined
  });

  console.log("\nUser 3 pinHash:", user3.pinHash);
  console.log("User 3 pin:", user3.pin);
  try {
    const res3 = await user3.matchPin("1234");
    console.log("User 3 matchPin('1234'):", res3);
  } catch (err) {
    console.error("User 3 matchPin Error:", err);
  }

  // Test 4: Check bcrypt.compare directly with undefined
  try {
    console.log("\nDirect bcrypt.compare('1234', undefined):");
    await bcrypt.compare("1234", undefined);
  } catch (err) {
    console.error("Direct bcrypt.compare caught error:", err.message);
    console.error("Stack:", err.stack);
  }

  // Test 5: Check bcrypt.compare directly with user.pinHash when user.pinHash is undefined
  try {
    const rawObj = { isPinSet: true }; // e.g. plain object or doc where pinHash wasn't selected
    console.log("\nTesting bcrypt.compare('1234', rawObj.pinHash):");
    await bcrypt.compare("1234", rawObj.pinHash);
  } catch (err) {
    console.error("bcrypt.compare with rawObj.pinHash caught error:", err.message);
  }
}

testPinBehavior().catch(console.error);
