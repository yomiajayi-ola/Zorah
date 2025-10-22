import EsusuGroup from "../models/EsusuGroup.js";
import { processEsusuPayouts } from "./esusuPayoutController.js";

export const retryFailedPayouts = async () => {
    const groups = await EsusuGroup.find({ active: true });

    const retryLog = [];

    for (const group of groups) {
        const failedMembers = group.members.filter(
        (members) => members.payoutStatus === "failed" && members.payoutAttempts < 3
        );

        for (const member of failedMembers) {
            try {
                await processEsusuPayouts(); 
                retryLog.push({ group: group._id, retried: member.user });
            } catch (err) {
                retryLog.push({
                    group: group._id,
                    failed: member.user,
                    reason: err.message,
                });
            }
        }
    }

    return retryLog;
}