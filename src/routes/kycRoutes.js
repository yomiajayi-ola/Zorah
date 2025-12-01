
import express from "express";
import { submitKyc } from "../controllers/kycController.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.post(
  "/submit", 
  protect, 

  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "utilityBill", maxCount: 1 },
  ]),
  submitKyc // 
);

// router.post(
//   "/upgrade",
//   protect,
//   upload.fields([
//     { name: "passportPhoto", maxCount: 1 },
//     { name: "utilityBill", maxCount: 1 },
//   ]),
//   upgradeKYC
// );
// router.get("/status", protect, getKYCStatus);

export default router;