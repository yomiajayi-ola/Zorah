import cron from "node-cron";
import { retryFailedPayouts } from "../controllers/esusuRetryController.js";
import { processEsusuPayouts } from "../controllers/esusuPayoutController.js";

// Runs every Monday at 8 AM (you can adjust for weekly payouts)
cron.schedule("* * * * *", async () => {
  console.log("🔁 Running scheduled Esusu payouts...");

  try {
    await processEsusuPayouts();
    console.log("✅ Payout processing complete");
  } catch (err) {
    console.error("❌ Error processing payouts:", err.message);
  }

  try {
    await retryFailedPayouts();
    console.log("🔁 Retry process complete");
  } catch (err) {
    console.error("❌ Error retrying failed payouts:", err.message);
  }
});
