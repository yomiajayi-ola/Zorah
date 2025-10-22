// import { func } from "joi";
import EsusuGroup from "../models/EsusuGroup.js";

// Simulated external payment service 
async function processPayment(member, amount) {
    // Mock: fail to simulate real-world API issues
    const success = Math.random() > 0.2;
    if (!success) throw new Error("Bank API timeout");
    return { status: "success", transactionId: `TX-${Date.now()}` };
}

export const processEsusuPayouts = async () => {
    const today = new Date();
    const groups = await EsusuGroup.find({
        active: true,
        nextPayoutDate: { $lte: today },
    });

    const results = [];

    for (const group of groups) {
        const nextMember = group.members.find(
            (members) => !members.hasReceived && members.payoutStatus != "paid"
            
            // group.payoutHistory!== "paid"
        );

        if (!nextMember) {
            // Start new cycle if all paid
            group.members.forEach((members) => {
                members.hasReceived = false;
                members.payoutStatus = "pending";
                
                // group.payoutHistory= "pending";
                members.payoutAttempts = 0;
            });
            group.currentRound +=1;
            group.nextPayoutDate = calculateNextPayout(group.frequency);
            await group.save();

            results.push({
                groupId: group._id,
                message: "New cycle started"
            });
            continue;
        }

        try {
            // Attempt payout
            nextMember.payoutAttempts += 1;
            nextMember.lastPayoutAttempt = new Date();

            const payment = await processPayment(
                nextMember.user,
                group.contributionAmount
            );

            nextMember.hasReceived = true;
            nextMember.payoutStatus = "paid";

            group.payoutHistory.push({
                member: nextMember.user,
                status: "paid",
                timestamp: new Date(),
                note: `Tranaction ID: ${payment.transactionId}`,
            });

            group.nextPayoutDate = calculateNextPayout(group.frequency);

            results.push({
                groupId: group._id,
                paidTo: nextMember.user,
                transactionId: payment.transactionId,
                nextPayoutDate: group.nextPayoutDate,
            }); 
        } catch (error) {
            // Handle failure 
            nextMember.payoutStatus = "failed";

            group.payoutHistory.push({
                member: nextMember.user,
                status: "failed",
                timestamp: new Date(),
                note: error.message,
            });

            results.push({
                groupId: group._id,
                failedFor: nextMember.user,
                reason: error.message,
            });
        }

        await group.save();
    }

    return results;
};

function calculateNextPayout(frequency) {
    const next = new Date();
    if (frequency === "daily") next.setDate(next.getDate() + 1);
    if (frequency === "weekly") next.setDate(next.getDate() + 7);
    if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
    return next
}