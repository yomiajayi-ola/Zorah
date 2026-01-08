import cron from "node-cron";
import Bill from "../models/Bills.js";
import { createNotification } from "../services/notificationService.js";

import { sendBillEmail } from "../utils/emailService.js"; 

export const checkBills = async () => {
  console.log("--- Starting Bill Check Logic ---");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAway = new Date();
    sevenDaysAway.setDate(today.getDate() + 7);
    sevenDaysAway.setHours(0, 0, 0, 0);

    const almostDue = await Bill.find({ 
      dueDate: sevenDaysAway, 
      status: "unpaid", 
      reminderEnabled: true 
    }).populate("user");

    const overdue = await Bill.find({ 
      dueDate: { $lt: today }, 
      status: { $ne: "paid" } 
    }).populate("user");

    // Process Almost Due
    for (const bill of almostDue) {
      await createNotification({
        userId: bill.user._id,
        type: "bill_reminder",
        title: "Bill Almost Due",
        message: `Your ${bill.name} of ₦${bill.amount} is due in 7 days.`
      });
      
      // 2. TRIGGER THE EMAIL
      await sendBillEmail(bill.user, bill, "bill_reminder"); 
      console.log(`Email and Notification sent for: ${bill.name}`);
    }

    // Process Overdue
    for (const bill of overdue) {
      if (bill.status !== "overdue") {
        bill.status = "overdue";
        await bill.save();
      }
      
      await createNotification({
        userId: bill.user._id,
        type: "bill_alert",
        title: "Bill Overdue! 🚨",
        message: `Your ${bill.name} was due on ${bill.dueDate.toDateString()}.`
      });

      // 3. TRIGGER THE OVERDUE EMAIL
      await sendBillEmail(bill.user, bill, "bill_overdue");
      console.log(`Status updated and email sent for: ${bill.name}`);
    }
    
    return { almostDueCount: almostDue.length, overdueCount: overdue.length };
  } catch (error) {
    console.error("Error in checkBills function:", error);
    throw error;
  }
};