import cron from "node-cron";
import Bill from "../models/Bills.js";
import { createNotification } from "../services/notificationService.js";
// import { sendEmail } from "../utils/emailService.js"; // Ensure this is imported for the HTML templating next

// 1. Defined the named function so it can be exported
export const checkBills = async () => {
  console.log("--- Starting Bill Check Logic ---");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAway = new Date();
    sevenDaysAway.setDate(today.getDate() + 7);
    sevenDaysAway.setHours(0, 0, 0, 0);

    // Logic: Find bills due exactly 7 days from now
    const almostDue = await Bill.find({ 
      dueDate: sevenDaysAway, 
      status: "unpaid", 
      reminderEnabled: true 
    }).populate("user"); // Populate user to get email/name

    // Logic: Find unpaid bills where the date is older than today
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
      console.log(`Notification sent for almost due bill: ${bill.name}`);
    }

    // Process Overdue
    for (const bill of overdue) {
      if (bill.status !== "overdue") {
        bill.status = "overdue"; // Update DB state
        await bill.save();
      }
      
      await createNotification({
        userId: bill.user._id,
        type: "bill_alert",
        title: "Bill Overdue! 🚨",
        message: `Your ${bill.name} was due on ${bill.dueDate.toDateString()}.`
      });
      console.log(`Status updated and alert sent for overdue bill: ${bill.name}`);
    }
    
    return { almostDueCount: almostDue.length, overdueCount: overdue.length };
  } catch (error) {
    console.error("Error in checkBills function:", error);
    throw error;
  }
};

// 2. Schedule the named function to run at 8:00 AM daily
cron.schedule("0 8 * * *", () => {
  checkBills();
});