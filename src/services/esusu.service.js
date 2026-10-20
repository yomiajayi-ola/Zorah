import EsusuGroup from "../models/EsusuGroup.js";
import { debitWallet, creditWalletFromPool } from "./walletService.js";
import { createNotification } from "./notificationService.js";

/**
 * Esusu business rules (shared by controllers + cron).
 *
 * Round model: round N runs until `nextPayoutDate`. Every joined member owes
 * `contributionAmount` for round N. Paying after `nextPayoutDate` (for the current
 * or any previous round) is LATE and adds `latePaymentFee`.
 *
 * Payout: when `nextPayoutDate` passes, the round's picker receives everything
 * collected for that round (contributions + late fees). Contributions that arrive
 * late for an already-paid round are forwarded to that round's picker as a "topup".
 */

export const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const idOf = (u) => String(u?._id ?? u);

export const addInterval = (date, frequency, times = 1) => {
    const d = new Date(date);
    if (frequency === "daily") d.setDate(d.getDate() + times);
    else if (frequency === "weekly") d.setDate(d.getDate() + 7 * times);
    else if (frequency === "biweekly") d.setDate(d.getDate() + 14 * times);
    else d.setMonth(d.getMonth() + times);
    return d;
};

const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

/** Joined members sorted by payout order. */
export const orderedMembers = (group) =>
    group.joinedMembers().sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

/** Re-number joined members 1..n preserving relative order. */
export const renumber = (group) => {
    orderedMembers(group).forEach((m, i) => { m.order = i + 1; });
};

/** Picker for the current round (first joined member, in order, who hasn't received). */
export const currentPicker = (group) => orderedMembers(group).find((m) => !m.hasReceived) || null;

export const roundContributions = (group, round, userId) =>
    group.contributions.filter((c) => c.round === round && (!userId || idOf(c.user) === String(userId)));

export const hasPaidRound = (group, userId, round) => roundContributions(group, round, userId).length > 0;

/** Due date of a given round (round 1 due = startDate + 1 interval). */
export const roundDueDate = (group, round) => {
    if (!group.startDate) return null;
    return addInterval(group.startDate, group.frequency, round);
};

/** Rounds (≤ current) the member still owes. */
export const outstandingRounds = (group, userId) => {
    if (group.status !== "active" && group.status !== "completed") return [];
    const member = group.findMember(userId);
    const fromRound = member?.joinedAt && group.startedAt && member.joinedAt > group.startedAt
        ? Math.max(1, group.currentRound) // late joiners only owe from the round they joined
        : 1;
    const last = group.status === "completed" ? group.totalCycles : group.currentRound;
    const owed = [];
    for (let r = fromRound; r <= last; r++) if (!hasPaidRound(group, userId, r)) owed.push(r);
    return owed;
};

export const isRoundLate = (group, round, at = new Date()) => {
    const due = round === group.currentRound && group.status === "active" ? group.nextPayoutDate : roundDueDate(group, round);
    return !!due && at > due;
};

/** Amount + fee a member must pay right now for a round. */
export const amountDue = (group, round, at = new Date()) => {
    const isLate = isRoundLate(group, round, at);
    const lateFee = isLate ? group.latePaymentFee || 0 : 0;
    return { contribution: group.contributionAmount, lateFee, total: group.contributionAmount + lateFee, isLate };
};

const notify = (userId, title, message) =>
    createNotification({ userId, type: "esusu", title, message }).catch(() => null);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const startGroup = async (group) => {
    if (group.status !== "pending") throw httpError(`Group is already ${group.status}`);
    const joined = group.joinedMembers();
    if (joined.length < 2) throw httpError("At least 2 joined members are required to start the group");

    if (group.pickerType === "automatic") {
        shuffle(joined).forEach((m, i) => { m.order = i + 1; });
    } else {
        renumber(group);
    }

    // Pending invites expire when the cycle starts
    group.members.forEach((m) => { if (m.status === "invited") m.status = "declined"; });

    const now = new Date();
    if (!group.startDate || group.startDate < now) group.startDate = now;
    group.status = "active";
    group.startedAt = now;
    group.currentRound = 1;
    group.cyclesCompleted = 0;
    group.totalCycles = joined.length;
    group.nextPayoutDate = roundDueDate(group, 1);
    await group.save();

    joined.forEach((m) =>
        notify(m.user, "Esusu started", `${group.name} has started. Your payout position is #${m.order}.`)
    );
    return group;
};

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

/**
 * Record a contribution. method "wallet" debits the payer's wallet;
 * method "manual" (creator records cash/transfer) does not move money.
 */
export const recordContribution = async (group, userId, { round, method = "wallet", paymentMethod, receiptUrl, note, recordedBy } = {}) => {
    if (group.status !== "active") throw httpError("Contributions are only accepted while the group is active");
    const member = group.findMember(userId);
    if (!member || member.status !== "joined") throw httpError("User is not a member of this group", 403);

    const owed = outstandingRounds(group, userId);
    if (!owed.length) throw httpError("No outstanding contribution — you're up to date for this cycle", 409);

    const targetRound = round ?? owed[0]; // default: oldest unpaid round
    if (!owed.includes(targetRound)) throw httpError(`Round ${targetRound} is already paid or not yet open`, 409);

    const due = amountDue(group, targetRound);
    const reference = `ESUSU-${group._id}-R${targetRound}-${idOf(userId)}`;

    if (method === "wallet") {
        await debitWallet(userId, due.total, "esusu_contribution", reference);
    }

    group.contributions.push({
        user: userId,
        amount: due.contribution,
        lateFee: due.lateFee,
        isLate: due.isLate,
        date: new Date(),
        round: targetRound,
        method,
        paymentMethod: method === "wallet" ? "wallet" : paymentMethod,
        receiptUrl,
        note,
        recordedBy: recordedBy ?? userId,
    });

    // Late payment for a round whose payout already happened → forward to that picker
    const pastPayout = group.payoutHistory.find((p) => p.round === targetRound && p.status === "paid");
    if (pastPayout && method === "wallet") {
        try {
            const tx = await creditWalletFromPool(pastPayout.member, due.total, "esusu_payout_topup", `${reference}-TOPUP`);
            group.payoutHistory.push({
                member: pastPayout.member, round: targetRound, amount: due.total, status: "topup",
                timestamp: new Date(), transactionId: tx?._id ? String(tx._id) : undefined,
                note: `Late contribution forwarded from ${idOf(userId)}`,
            });
        } catch (e) {
            console.error("❌ Esusu topup failed:", e.message);
        }
    }

    await group.save();
    return { round: targetRound, ...due, reference };
};

// ---------------------------------------------------------------------------
// Payouts (cron)
// ---------------------------------------------------------------------------

const MAX_PAYOUT_ATTEMPTS = 3;

const advanceRound = (group) => {
    group.cyclesCompleted += 1;
    if (group.cyclesCompleted >= group.totalCycles || !currentPicker(group)) {
        group.status = "completed";
        group.completedAt = new Date();
        group.nextPayoutDate = null;
        return;
    }
    group.currentRound += 1;
    group.nextPayoutDate = roundDueDate(group, group.currentRound);
};

/** Pay the current round's picker for one group. Returns a log entry. */
export const payoutGroup = async (group) => {
    const picker = currentPicker(group);
    if (!picker) {
        advanceRound(group);
        await group.save();
        return { groupId: group._id, message: "No picker left — group completed" };
    }

    const round = group.currentRound;
    const collected = roundContributions(group, round).reduce((s, c) => s + c.amount + (c.lateFee || 0), 0);

    picker.payoutAttempts += 1;
    picker.lastPayoutAttempt = new Date();

    if (collected <= 0) {
        // Nobody paid: skip this picker's turn (they move to the back of the queue)
        picker.payoutStatus = "skipped";
        picker.order = orderedMembers(group).length + 1;
        renumber(group);
        group.payoutHistory.push({ member: picker.user, round, amount: 0, status: "skipped", timestamp: new Date(), note: "No contributions collected for this round" });
        group.nextPayoutDate = addInterval(new Date(), group.frequency);
        await group.save();
        notify(picker.user, "Esusu payout delayed", `No contributions were collected for round ${round} of ${group.name}. Your turn has been moved.`);
        return { groupId: group._id, skipped: picker.user, round };
    }

    try {
        const reference = `ESUSU-PAYOUT-${group._id}-R${round}`;
        const tx = await creditWalletFromPool(picker.user, collected, "esusu_payout", reference);
        picker.hasReceived = true;
        picker.payoutStatus = "paid";
        picker.receivedRound = round;
        picker.receivedAt = new Date();
        group.payoutHistory.push({ member: picker.user, round, amount: collected, status: "paid", timestamp: new Date(), transactionId: tx?._id ? String(tx._id) : reference });
        advanceRound(group);
        await group.save();
        notify(picker.user, "Esusu payout received 🎉", `₦${collected.toLocaleString()} from ${group.name} (round ${round}) has been credited to your wallet.`);
        return { groupId: group._id, paidTo: picker.user, round, amount: collected };
    } catch (error) {
        picker.payoutStatus = "failed";
        group.payoutHistory.push({ member: picker.user, round, amount: collected, status: "failed", timestamp: new Date(), note: error.message });
        if (picker.payoutAttempts >= MAX_PAYOUT_ATTEMPTS) {
            notify(group.creator, "Esusu payout failing", `Payout to a member of ${group.name} failed ${picker.payoutAttempts} times. Please contact support.`);
        }
        await group.save();
        return { groupId: group._id, failedFor: picker.user, round, reason: error.message };
    }
};

/** Cron entry point: pay out every active group whose round is due. */
export const processDuePayouts = async () => {
    const groups = await EsusuGroup.find({ status: "active", nextPayoutDate: { $lte: new Date() } });
    const results = [];
    for (const g of groups) {
        const picker = currentPicker(g);
        if (picker?.payoutStatus === "failed" && picker.payoutAttempts >= MAX_PAYOUT_ATTEMPTS) continue; // needs manual intervention
        results.push(await payoutGroup(g));
    }
    return results;
};

/** Cron: remind members whose current-round contribution is due within 24h or overdue. */
export const sendDueReminders = async () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const groups = await EsusuGroup.find({ status: "active", nextPayoutDate: { $lte: soon } });
    let sent = 0;
    for (const g of groups) {
        for (const m of g.joinedMembers()) {
            if (!hasPaidRound(g, m.user, g.currentRound)) {
                notify(m.user, "Esusu contribution due", `Your ₦${g.contributionAmount.toLocaleString()} contribution to ${g.name} is due ${g.nextPayoutDate.toDateString()}.`);
                sent++;
            }
        }
    }
    return sent;
};

// ---------------------------------------------------------------------------
// Read models (what the screens render)
// ---------------------------------------------------------------------------

const userCard = (u) =>
    u && typeof u === "object" && u.firstName !== undefined
        ? { _id: u._id, firstName: u.firstName, lastName: u.lastName, email: u.email, phoneNumber: u.phoneNumber, avatar: u.avatar ?? u.profileImage ?? null }
        : { _id: u };

const daysUntil = (date) => (date ? Math.ceil((new Date(date) - Date.now()) / 86400000) : null);

/** Badges shown on the Leaderboard. */
export const memberBadges = (group, userId) => {
    const mine = group.contributions.filter((c) => idOf(c.user) === String(userId));
    if (!mine.length) return [];
    const badges = [];
    const early = mine.filter((c) => {
        const due = roundDueDate(group, c.round);
        return due && new Date(c.date) <= new Date(due.getTime() - 86400000);
    });
    if (early.length && early.length === mine.length) badges.push("early_bird");          // always pays ≥1 day early
    if (mine.every((c) => !c.isLate) && outstandingRounds(group, userId).filter((r) => r < group.currentRound).length === 0)
        badges.push("trustworthy_saver");                                                  // never late, nothing overdue
    return badges;
};

export const buildLeaderboard = (group) => {
    const rows = orderedMembers(group).map((m) => {
        const mine = group.contributions.filter((c) => idOf(c.user) === idOf(m.user));
        return {
            user: userCard(m.user),
            totalContributed: mine.reduce((s, c) => s + c.amount, 0),
            onTimeCount: mine.filter((c) => !c.isLate).length,
            badges: memberBadges(group, idOf(m.user)),
        };
    });
    // Group Hero: top contributor with zero late payments
    const hero = [...rows].filter((r) => r.badges.includes("trustworthy_saver")).sort((a, b) => b.totalContributed - a.totalContributed)[0];
    if (hero && hero.totalContributed > 0) hero.badges.push("group_hero");
    return rows.sort((a, b) => b.badges.length - a.badges.length || b.onTimeCount - a.onTimeCount);
};

export const participantView = (group, m) => {
    const uid = idOf(m.user);
    const picker = currentPicker(group);
    const paidCurrent = hasPaidRound(group, uid, group.currentRound);
    return {
        user: userCard(m.user),
        order: m.order,
        paymentStatus: group.status === "active" ? (paidCurrent ? "paid" : "unpaid") : null,
        pickedStatus: m.hasReceived ? "received" : picker && idOf(picker.user) === uid ? "next_picker" : "waiting",
        payoutStatus: m.payoutStatus,
        receivedRound: m.receivedRound ?? null,
        joinedAt: m.joinedAt,
    };
};

export const groupSummary = (group) => {
    const joined = group.joinedMembers();
    const totalSaved = group.contributions.reduce((s, c) => s + c.amount + (c.lateFee || 0), 0);
    return {
        totalParticipants: joined.length,
        contributionPerCycle: group.contributionAmount * joined.length,
        totalSavedSoFar: totalSaved,
        frequency: group.frequency,
        cyclesCompleted: group.cyclesCompleted,
        currentCycle: group.status === "pending" ? 0 : group.currentRound,
        totalCycles: group.totalCycles || group.maxMembers,
        startDate: group.startDate ?? null,
    };
};

export const nextPickerView = (group) => {
    const picker = currentPicker(group);
    if (!picker || group.status !== "active") return null;
    const paidCount = new Set(roundContributions(group, group.currentRound).map((c) => idOf(c.user))).size;
    return {
        user: userCard(picker.user),
        round: group.currentRound,
        amountDue: group.contributionAmount * group.joinedMembers().length, // full pot if everyone pays
        amountCollected: roundContributions(group, group.currentRound).reduce((s, c) => s + c.amount + (c.lateFee || 0), 0),
        membersPaid: paidCount,
        membersTotal: group.joinedMembers().length,
        payoutDate: group.nextPayoutDate,
        countdownDays: daysUntil(group.nextPayoutDate),
        latePaymentFee: group.latePaymentFee,
    };
};

/** Shape for dashboard cards and list rows. */
export const groupCard = (group, userId) => {
    const me = userId ? group.findMember(userId) : null;
    const picker = currentPicker(group);
    const lastContribution = [...group.contributions].sort((a, b) => b.date - a.date)[0];
    return {
        _id: group._id,
        name: group.name,
        description: group.description,
        status: group.status,
        pickerType: group.pickerType,
        frequency: group.frequency,
        contributionAmount: group.contributionAmount,
        maxMembers: group.maxMembers,
        currentMembers: group.joinedMembers().length,
        spotsLeft: Math.max(0, group.maxMembers - group.joinedMembers().length),
        isFull: group.joinedMembers().length >= group.maxMembers,
        isCreator: userId ? idOf(group.creator) === String(userId) : false,
        cycleProgress: { current: group.status === "pending" ? 0 : group.cyclesCompleted, total: group.totalCycles || group.maxMembers },
        nextPicker: picker && group.status === "active" ? userCard(picker.user) : null,
        nextPayoutDate: group.nextPayoutDate ?? null,
        lastPaymentAt: lastContribution?.date ?? null,
        myMembership: me ? {
            status: me.status,
            order: me.order ?? null,
            hasReceived: me.hasReceived,
            paidCurrentRound: group.status === "active" ? hasPaidRound(group, userId, group.currentRound) : null,
            outstandingRounds: outstandingRounds(group, userId),
        } : null,
        creator: userCard(group.creator),
        createdAt: group.createdAt,
    };
};
