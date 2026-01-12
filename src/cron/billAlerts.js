import cron from "node-cron";
import Bill from "../models/Bills.js";
import { createNotification } from "../services/notificationService.js";
import { sendBillEmail } from "../utils/emailService.js";

console.log("🚀 Bill Cron Service: Initializing Hourly Heartbeat...");

/**
 * checkBills
 * @param {Number} targetHour - The hour to check (0-23)
 */
export const checkBills = async (targetHour) => {
  console.log(`\n--- [WINDOW START] Checking Bills for ${targetHour}:00 ---`);
  
  try {
    // 1. Normalize Dates for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAway = new Date(today);
    sevenDaysAway.setDate(today.getDate() + 7);

    // console.log(`DEBUG: Target Due Date for 7-day reminder: ${sevenDaysAway.toDateString()}`);

    // 2. Fetch bills that are NOT paid.
    // We populate 'user' ONLY if their preferredReminderHour matches targetHour.
    const bills = await Bill.find({ 
      status: { $ne: "paid" }, 
      reminderEnabled: true 
    }).populate({
      path: 'user',
      match: { preferredReminderHour: targetHour } 
    });

    // console.log(`DEBUG: Found ${bills.length} total potential unpaid/overdue bills in DB.`);

    for (const bill of bills) {
      // 3. Check if user matched the hour
      // If the user's preferredHour !== targetHour, Mongoose sets bill.user to null.
      const userMatchedHour = !!bill.user;
      // console.log(`DEBUG: Checking bill "${bill.name}" -> User Match: ${userMatchedHour}`);

      if (!userMatchedHour) continue; 

      const billDate = new Date(bill.dueDate);
      billDate.setHours(0, 0, 0, 0);

      // 4. Logic for "Almost Due" (Exactly 7 days away)
      if (billDate.getTime() === sevenDaysAway.getTime() && bill.status === "unpaid") {
        console.log(`✅ MATCH FOUND: Sending 7-day reminder for ${bill.name} to ${bill.user.email}`);
        
        await createNotification({
          userId: bill.user._id,
          type: "bill_reminder",
          title: "Bill Almost Due",
          message: `Your ${bill.name} of ₦${bill.amount} is due in 7 days.`
        });
        
        await sendBillEmail(bill.user, bill, "bill_reminder");
      }

      // 5. Logic for "Overdue" (Due date is in the past)
      if (billDate.getTime() < today.getTime()) {
        console.log(`🚨 OVERDUE MATCH: Sending alert for ${bill.name} to ${bill.user.email}`);
        
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

        await sendBillEmail(bill.user, bill, "bill_overdue");
      }
    }
    
    console.log(`--- [WINDOW END] Finished processing hour ${targetHour} ---\n`);
  } catch (error) {
    console.error("CRITICAL ERROR in checkBills function:", error);
  }
};

// INITIALIZE THE CRON SCHEDULER: Runs every hour at minute 0 (e.g. 1:00, 2:00...)
cron.schedule("0 * * * *", () => {
  const currentHour = new Date().getHours();
  checkBills(currentHour);
});