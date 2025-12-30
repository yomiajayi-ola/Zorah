
import express from "express";
import { submitKyc } from "../controllers/kycController.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.js";
import multer from "multer";

const router = express.Router();

router.post(
  "/submit", 
  protect, 
  (req, res, next) => {
    upload.fields([
      { name: "passportPhoto", maxCount: 1 },
      { name: "utilityBill", maxCount: 1 },
    ])(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading (like 'Unexpected field')
        return res.status(400).json({ status: "error", message: `Multer Error: ${err.message}` });
      } else if (err) {
        // An unknown error occurred
        return res.status(500).json({ status: "error", message: err.message });
      }
      // Everything went fine, move to the controller
      next();
    });
  },
  submitKyc
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