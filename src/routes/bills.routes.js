import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { addBill, getBills, updateBill } from "../controllers/billController.js";
import { markAsPaid } from "../controllers/markAsPaidController.js";
import { checkBills } from "../cron/billAlerts.js"; 

const router = express.Router();

// Standard Routes
router.post("/add-bill", protect, addBill);
router.get("/", protect, getBills);
router.patch("/:id/pay", protect, markAsPaid);
router.patch("/bills/:billId", protect, updateBill);

// ====== THE BACKDOOR ROUTE ======
// This allows you to manually trigger the "7 days before" and "Overdue" logic
router.get("/test-cron-logic", protect, async (req, res) => {
  try {
    // If you type ?hour=14 in Postman, it tests the 2 PM window
    const testHour = req.query.hour ? parseInt(req.query.hour) : new Date().getHours();
    await checkBills(testHour); 
    res.json({ message: `Execution finished for hour: ${testHour}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
export default router;