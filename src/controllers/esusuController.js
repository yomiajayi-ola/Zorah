import Joi from "joi";
import mongoose from "mongoose";
import EsusuGroup, { FREQUENCIES, PICKER_TYPES } from "../models/EsusuGroup.js";
import User from "../models/User.js";
import {
    httpError,
    startGroup,
    recordContribution,
    renumber,
    orderedMembers,
    outstandingRounds,
    amountDue,
    hasPaidRound,
    roundContributions,
    groupCard,
    groupSummary,
    participantView,
    nextPickerView,
    buildLeaderboard,
} from "../services/esusu.service.js";
import { createNotification } from "../services/notificationService.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const USER_FIELDS = "firstName lastName email phoneNumber avatar profileImage";

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        const status = err.statusCode || (err.name === "ValidationError" || err.name === "CastError" ? 400 : 500);
        if (status === 500) console.error("❌ Esusu error:", err);
        res.status(status).json({ success: false, message: err.message });
    }
};

const validate = (schema, data) => {
    const { error, value } = schema.validate(data, { abortEarly: true, stripUnknown: true });
    if (error) throw httpError(error.details[0].message, 400);
    return value;
};

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

const loadGroup = async (id, { populate = false } = {}) => {
    if (!isId(id)) throw httpError("Invalid group id", 400);
    let q = EsusuGroup.findById(id);
    if (populate) q = q.populate("creator", USER_FIELDS).populate("members.user", USER_FIELDS).populate("members.invitedBy", USER_FIELDS);
    const group = await q;
    if (!group) throw httpError("Group not found", 404);
    return group;
};

const isCreator = (group, userId) => String(group.creator?._id ?? group.creator) === String(userId);

const assertCreator = (group, userId) => {
    if (!isCreator(group, userId)) throw httpError("Only the group creator can perform this action", 403);
};

const assertMember = (group, userId) => {
    const m = group.findMember(userId);
    if ((!m || m.status !== "joined") && !isCreator(group, userId)) {
        throw httpError("Access denied. You must be a member of this group.", 403);
    }
    return m;
};

const notify = (userId, title, message) =>
    createNotification({ userId, type: "esusu", title, message }).catch(() => null);

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const accountSchema = Joi.object({
    accountNumber: Joi.string().trim().pattern(/^\d{10}$/).allow("").messages({ "string.pattern.base": "accountNumber must be 10 digits" }),
    bankName: Joi.string().trim().allow(""),
    accountName: Joi.string().trim().allow(""),
});

const createSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    description: Joi.string().trim().max(500).allow("").default(""),
    contributionAmount: Joi.number().positive().required(),
    frequency: Joi.string().valid(...FREQUENCIES).required(),
    maxMembers: Joi.number().integer().min(2).max(100).default(10),
    isPublic: Joi.boolean().default(true),
    pickerType: Joi.string().valid(...PICKER_TYPES).default("rotating"),
    startDate: Joi.date().iso().min("now").allow(null),
    latePaymentFee: Joi.number().min(0).default(0),
    collectionAccount: accountSchema.optional(),
    inviteUserIds: Joi.array().items(Joi.string().custom((v, h) => (isId(v) ? v : h.error("any.invalid")))).default([]),
    invitePhoneNumbers: Joi.array().items(Joi.string().trim()).default([]),
});

const updateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80),
    description: Joi.string().trim().max(500).allow(""),
    contributionAmount: Joi.number().positive(),
    frequency: Joi.string().valid(...FREQUENCIES),
    maxMembers: Joi.number().integer().min(2).max(100),
    isPublic: Joi.boolean(),
    pickerType: Joi.string().valid(...PICKER_TYPES),
    startDate: Joi.date().iso().min("now").allow(null),
    latePaymentFee: Joi.number().min(0),
    collectionAccount: accountSchema,
}).min(1);

const inviteSchema = Joi.object({
    userIds: Joi.array().items(Joi.string()).default([]),
    phoneNumbers: Joi.array().items(Joi.string().trim()).default([]),
}).custom((v, h) => (v.userIds.length || v.phoneNumbers.length ? v : h.message("Provide userIds or phoneNumbers")));

const contributeSchema = Joi.object({
    groupId: Joi.string(),
    round: Joi.number().integer().min(1),
    amount: Joi.number().positive(), // accepted for backward compatibility; server computes the real amount
});

const recordPaymentSchema = Joi.object({
    userId: Joi.string().required(),
    round: Joi.number().integer().min(1),
    paymentMethod: Joi.string().valid("cash", "bank_transfer", "pos", "other").default("cash"),
    receiptUrl: Joi.string().uri().allow(""),
    note: Joi.string().max(300).allow(""),
});

// Nigerian phone normalisation: 080..., +23480..., 23480... → +23480...
const normalisePhone = (p) => {
    const d = String(p).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("0")) return `+234${d.slice(1)}`;
    if (d.length === 13 && d.startsWith("234")) return `+${d}`;
    if (d.length === 10) return `+234${d}`;
    return `+${d}`;
};

const resolveInvitees = async (userIds = [], phoneNumbers = []) => {
    const ids = userIds.filter(isId);
    const phones = phoneNumbers.flatMap((p) => {
        const n = normalisePhone(p);
        return [n, n.replace("+234", "0"), n.replace("+", "")];
    });
    const users = await User.find({ $or: [{ _id: { $in: ids } }, ...(phones.length ? [{ phoneNumber: { $in: phones } }] : [])] }).select("_id firstName lastName phoneNumber");
    const foundPhones = new Set(users.map((u) => u.phoneNumber && normalisePhone(u.phoneNumber)));
    const notFound = phoneNumbers.filter((p) => !foundPhones.has(normalisePhone(p)));
    return { users, notFound };
};

/** Adds invites to a pending group. Returns { invited, skipped, notFound }. */
const addInvites = (group, users, inviterId) => {
    const invited = [];
    const skipped = [];
    for (const u of users) {
        if (String(u._id) === String(group.creator?._id ?? group.creator)) { skipped.push({ user: u._id, reason: "creator" }); continue; }
        const existing = group.findMember(u._id);
        if (existing && ["joined", "invited"].includes(existing.status)) { skipped.push({ user: u._id, reason: existing.status }); continue; }
        if (existing) {
            existing.status = "invited";
            existing.invitedBy = inviterId;
            existing.invitedAt = new Date();
            existing.respondedAt = undefined;
        } else {
            group.members.push({ user: u._id, status: "invited", invitedBy: inviterId, invitedAt: new Date() });
        }
        invited.push(u);
    }
    return { invited, skipped };
};

// ---------------------------------------------------------------------------
// Create / edit / lifecycle
// ---------------------------------------------------------------------------

// @route POST /api/esusu/create
export const createGroup = handle(async (req, res) => {
    const v = validate(createSchema, req.body);
    const group = new EsusuGroup({
        name: v.name,
        description: v.description,
        creator: req.user._id,
        contributionAmount: v.contributionAmount,
        frequency: v.frequency,
        maxMembers: v.maxMembers,
        isPublic: v.isPublic,
        pickerType: v.pickerType,
        startDate: v.startDate ?? null,
        latePaymentFee: v.latePaymentFee,
        collectionAccount: v.collectionAccount,
        status: "pending",
        members: [{ user: req.user._id, order: 1, status: "joined" }],
    });

    const { users, notFound } = await resolveInvitees(v.inviteUserIds, v.invitePhoneNumbers);
    const { invited } = addInvites(group, users, req.user._id);
    await group.save();

    invited.forEach((u) => notify(u._id, "Esusu invite", `${fullName(req.user)} invited you to join "${group.name}".`));

    res.status(201).json({
        success: true,
        message: "Esusu group created successfully",
        data: { ...groupCard(group, req.user._id), inviteCode: group.inviteCode, invitesSent: invited.length, invitesNotFound: notFound },
    });
});

// @route PATCH /api/esusu/:id
export const updateGroup = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    const v = validate(updateSchema, req.body);

    if (group.status !== "pending") {
        // Once running, only cosmetic fields may change
        const locked = Object.keys(v).filter((k) => !["name", "description", "isPublic", "collectionAccount"].includes(k));
        if (locked.length) throw httpError(`Cannot change ${locked.join(", ")} after the group has started`, 409);
    }
    if (v.maxMembers && v.maxMembers < group.joinedMembers().length) {
        throw httpError(`maxMembers cannot be lower than the current member count (${group.joinedMembers().length})`, 409);
    }
    Object.assign(group, v);
    await group.save();
    res.json({ success: true, message: "Group updated", data: groupCard(group, req.user._id) });
});

// @route POST /api/esusu/:id/start
export const startEsusu = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    await startGroup(group);
    await group.populate("members.user", USER_FIELDS);
    res.json({
        success: true,
        message: "Esusu started",
        data: {
            ...groupCard(group, req.user._id),
            payoutOrder: orderedMembers(group).map((m) => participantView(group, m)),
        },
    });
});

// @route POST /api/esusu/:id/cancel
export const cancelGroup = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    if (group.status !== "pending") throw httpError("Only groups that haven't started can be cancelled", 409);
    group.status = "cancelled";
    await group.save();
    group.joinedMembers().forEach((m) => notify(m.user, "Esusu cancelled", `"${group.name}" was cancelled by the creator.`));
    res.json({ success: true, message: "Group cancelled" });
});

// @route PATCH /api/esusu/:id/order   body: { order: [userId, ...] }
export const reorderPayout = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    const { order } = validate(Joi.object({ order: Joi.array().items(Joi.string()).min(2).required() }), req.body);

    if (group.pickerType !== "manual") throw httpError("Payout order can only be set manually when pickerType is 'manual'", 409);
    if (group.status === "completed" || group.status === "cancelled") throw httpError(`Group is ${group.status}`, 409);

    // Members who already received keep their slots at the front
    const received = orderedMembers(group).filter((m) => m.hasReceived);
    const waiting = orderedMembers(group).filter((m) => !m.hasReceived);
    const waitingIds = waiting.map((m) => String(m.user));
    if (order.length !== waitingIds.length || !order.every((id) => waitingIds.includes(String(id)))) {
        throw httpError("order must list every member who hasn't received a payout yet, exactly once", 400);
    }
    received.forEach((m, i) => { m.order = i + 1; });
    order.forEach((id, i) => { group.findMember(id).order = received.length + i + 1; });
    await group.save();
    await group.populate("members.user", USER_FIELDS);
    res.json({ success: true, message: "Payout order updated", data: orderedMembers(group).map((m) => participantView(group, m)) });
});

// ---------------------------------------------------------------------------
// Join / invites / membership
// ---------------------------------------------------------------------------

// @route POST /api/esusu/join   body: { groupId } | { inviteCode }
export const joinGroup = handle(async (req, res) => {
    const { groupId, inviteCode } = validate(Joi.object({ groupId: Joi.string(), inviteCode: Joi.string().trim().uppercase() }).or("groupId", "inviteCode"), req.body);
    const group = groupId ? await loadGroup(groupId) : await EsusuGroup.findOne({ inviteCode });
    if (!group) throw httpError("Group not found", 404);

    const existing = group.findMember(req.user._id);
    if (existing?.status === "joined") throw httpError("You are already a member of this group.", 409);
    if (existing?.status === "removed") throw httpError("You were removed from this group and cannot rejoin.", 403);
    if (group.status !== "pending") throw httpError("This group has already started and is not accepting new members.", 409);
    if (!group.isPublic && !inviteCode && existing?.status !== "invited") throw httpError("This is a private group. Join with an invite code or invitation.", 403);
    if (group.joinedMembers().length >= group.maxMembers) throw httpError(`This group is full. Maximum ${group.maxMembers} members allowed.`, 409);

    if (existing) {
        existing.status = "joined";
        existing.respondedAt = new Date();
        existing.joinedAt = new Date();
    } else {
        group.members.push({ user: req.user._id, status: "joined", joinedAt: new Date() });
    }
    renumber(group);
    await group.save();
    notify(group.creator, "New Esusu member", `${fullName(req.user)} joined "${group.name}".`);

    const me = group.findMember(req.user._id);
    res.json({
        success: true,
        message: "Joined group successfully",
        data: {
            groupId: group._id,
            groupName: group.name,
            yourOrder: me.order,
            totalMembers: group.joinedMembers().length,
            contributionAmount: group.contributionAmount,
            frequency: group.frequency,
        },
    });
});

// @route GET /api/esusu/invites   (my pending invitations)
export const getMyInvites = handle(async (req, res) => {
    const uid = req.user._id;
    const groups = await EsusuGroup.find({ members: { $elemMatch: { user: uid, invitedAt: { $exists: true } } } })
        .populate("creator", USER_FIELDS)
        .populate("members.invitedBy", USER_FIELDS)
        .sort({ updatedAt: -1 });

    let accepted = 0, declined = 0;
    const pending = [];
    for (const g of groups) {
        const me = g.findMember(uid);
        if (me.status === "joined") accepted++;
        else if (me.status === "declined") declined++;
        else if (me.status === "invited" && g.status === "pending") {
            pending.push({
                groupId: g._id,
                name: g.name,
                status: g.status,
                pickerType: g.pickerType,
                contributionAmount: g.contributionAmount,
                frequency: g.frequency,
                invitedBy: me.invitedBy ? { _id: me.invitedBy._id, firstName: me.invitedBy.firstName, lastName: me.invitedBy.lastName } : null,
                creator: { _id: g.creator._id, firstName: g.creator.firstName, lastName: g.creator.lastName },
                invitedAt: me.invitedAt,
            });
        }
    }
    res.json({ success: true, summary: { totalInvites: groups.length, pending: pending.length, accepted, declined }, data: pending });
});

// @route POST /api/esusu/:id/invites   body: { userIds?, phoneNumbers? }
export const inviteMembers = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    if (group.status !== "pending") throw httpError("Invites can only be sent before the group starts", 409);
    const v = validate(inviteSchema, req.body);

    const { users, notFound } = await resolveInvitees(v.userIds, v.phoneNumbers);
    const open = group.maxMembers - group.joinedMembers().length - group.members.filter((m) => m.status === "invited").length;
    if (users.length > open) throw httpError(`Only ${Math.max(0, open)} spot(s) left in this group`, 409);

    const { invited, skipped } = addInvites(group, users, req.user._id);
    await group.save();
    invited.forEach((u) => notify(u._id, "Esusu invite", `${fullName(req.user)} invited you to join "${group.name}".`));

    res.json({
        success: true,
        message: `${invited.length} invite(s) sent`,
        data: { invited: invited.map((u) => ({ _id: u._id, firstName: u.firstName, lastName: u.lastName })), skipped, notFound, inviteCode: group.inviteCode },
    });
});

// @route POST /api/esusu/:id/invites/respond   body: { action: "accept" | "decline" }
export const respondToInvite = handle(async (req, res) => {
    const { action } = validate(Joi.object({ action: Joi.string().valid("accept", "decline").required() }), req.body);
    const group = await loadGroup(req.params.id);
    const me = group.findMember(req.user._id);
    if (!me || me.status !== "invited") throw httpError("You don't have a pending invite for this group", 404);
    if (group.status !== "pending") throw httpError("This group has already started; the invite has expired", 409);

    if (action === "accept") {
        if (group.joinedMembers().length >= group.maxMembers) throw httpError("This group is full", 409);
        me.status = "joined";
        me.joinedAt = new Date();
        renumber(group);
    } else {
        me.status = "declined";
    }
    me.respondedAt = new Date();
    await group.save();
    notify(group.creator, `Invite ${action}ed`, `${fullName(req.user)} ${action}ed your invite to "${group.name}".`);
    res.json({ success: true, message: action === "accept" ? "Group joined successfully" : "Group declined successfully", data: { groupId: group._id, status: me.status, order: me.order ?? null } });
});

/** Withdraws a pending invite. Marked "revoked" (not "removed") so addInvites can re-invite later. */
const revokePendingInvite = async (group, m, res) => {
    if (group.status !== "pending") throw httpError("Invites can only be revoked before the group starts", 409);
    m.status = "revoked";
    m.respondedAt = new Date();
    await group.save();
    notify(m.user, "Esusu invite withdrawn", `Your invite to "${group.name}" was withdrawn.`);
    res.json({ success: true, message: "Invite revoked", data: { groupId: group._id, userId: m.user, status: "revoked" } });
};

// @route DELETE /api/esusu/:id/invites/:userId
export const revokeInvite = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    const m = group.findMember(req.params.userId);
    if (!m || m.status !== "invited") throw httpError("No pending invite found for this user", 404);
    await revokePendingInvite(group, m, res);
});

// @route DELETE /api/esusu/:id/members/:userId
// Pending invitees are revoked (re-invitable); joined members are removed permanently.
export const removeMember = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    if (String(req.params.userId) === String(req.user._id)) throw httpError("The creator cannot remove themselves. Cancel the group instead.", 409);
    const m = group.findMember(req.params.userId);
    if (!m || !["joined", "invited"].includes(m.status)) throw httpError("Member not found in this group", 404);
    if (m.status === "invited") return revokePendingInvite(group, m, res);

    if (group.status === "active") {
        if (m.hasReceived) throw httpError("This member has already received a payout and must complete their contributions before removal", 409);
        if (group.contributions.some((c) => String(c.user) === String(m.user))) {
            throw httpError("This member has contributions in the current cycle. Refund them before removing.", 409);
        }
    }
    if (group.status === "completed" || group.status === "cancelled") throw httpError(`Group is ${group.status}`, 409);

    m.status = "removed";
    m.order = undefined;
    renumber(group);
    if (group.status === "active") group.totalCycles = group.joinedMembers().length;
    await group.save();
    notify(m.user, "Removed from Esusu", `You were removed from "${group.name}".`);
    res.json({ success: true, message: "Member removed" });
});

// @route POST /api/esusu/:id/leave
export const leaveGroup = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    if (isCreator(group, req.user._id)) throw httpError("The creator cannot leave. Cancel the group instead.", 409);
    const m = group.findMember(req.user._id);
    if (!m || m.status !== "joined") throw httpError("You are not a member of this group", 404);
    if (group.status === "active") throw httpError("You can't leave a running cycle. Contact the group creator.", 409);
    m.status = "left";
    m.order = undefined;
    renumber(group);
    await group.save();
    notify(group.creator, "Member left", `${fullName(req.user)} left "${group.name}".`);
    res.json({ success: true, message: "You have left the group" });
});

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

// @route POST /api/esusu/contribute   (legacy, body.groupId)  |  POST /api/esusu/:id/contribute
export const addEsusuContribution = handle(async (req, res) => {
    const v = validate(contributeSchema, req.body);
    const group = await loadGroup(req.params.id || v.groupId);
    const result = await recordContribution(group, req.user._id, { round: v.round, method: "wallet" });
    res.json({
        success: true,
        message: result.isLate ? `Contribution recorded with a ₦${result.lateFee} late fee` : "Contribution added successfully",
        data: { groupId: group._id, ...result, outstandingRounds: outstandingRounds(group, req.user._id) },
    });
});

// @route POST /api/esusu/:id/record-payment   (creator logs an offline payment)
export const recordManualPayment = handle(async (req, res) => {
    const v = validate(recordPaymentSchema, req.body);
    const group = await loadGroup(req.params.id);
    assertCreator(group, req.user._id);
    const result = await recordContribution(group, v.userId, {
        round: v.round, method: "manual", paymentMethod: v.paymentMethod, receiptUrl: v.receiptUrl, note: v.note, recordedBy: req.user._id,
    });
    notify(v.userId, "Esusu payment recorded", `Your ${v.paymentMethod.replace("_", " ")} payment for round ${result.round} of "${group.name}" was recorded.`);
    res.status(201).json({ success: true, message: "Payment recorded successfully", data: { groupId: group._id, userId: v.userId, ...result } });
});

// @route POST /api/esusu/:id/members/:userId/remind
export const remindMember = handle(async (req, res) => {
    const group = await loadGroup(req.params.id);
    assertMember(group, req.user._id);
    if (group.status !== "active") throw httpError("Reminders are only available while the group is active", 409);
    const target = group.findMember(req.params.userId);
    if (!target || target.status !== "joined") throw httpError("Member not found", 404);
    if (hasPaidRound(group, req.params.userId, group.currentRound)) throw httpError("This member has already paid for the current cycle", 409);
    const due = amountDue(group, group.currentRound);
    await notify(req.params.userId, "Esusu reminder", `Reminder: your ₦${due.total.toLocaleString()} contribution to "${group.name}" is ${due.isLate ? "overdue" : "due soon"}.`);
    res.json({ success: true, message: "Reminder sent" });
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// @route GET /api/esusu   (discover public groups)
export const getAllEsusuGroups = handle(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const { search, frequency } = req.query;
    const query = { isPublic: { $ne: false }, status: "pending" };
    if (frequency && FREQUENCIES.includes(frequency)) query.frequency = frequency;
    if (search) query.name = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const [total, groups] = await Promise.all([
        EsusuGroup.countDocuments(query),
        EsusuGroup.find(query).populate("creator", "firstName lastName").select("-payoutHistory -contributions").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    const data = groups.map((g) => groupCard(g, req.user._id));
    res.json({ success: true, total, page, pages: Math.ceil(total / limit), count: data.length, data });
});

// @route GET /api/esusu/my-groups?status=all|active|pending|completed&search=
export const getUserGroups = handle(async (req, res) => {
    const uid = req.user._id;
    const { status = "all", search } = req.query;
    const groups = await EsusuGroup.find({
        $or: [{ creator: uid }, { members: { $elemMatch: { user: uid, status: "joined" } } }],
        status: { $ne: "cancelled" },
    })
        .populate("creator", USER_FIELDS)
        .populate("members.user", USER_FIELDS)
        .sort({ createdAt: -1 });

    let totalContribution = 0;
    let activeGroups = 0;
    let totalExpectedPayouts = 0;
    for (const g of groups) {
        totalContribution += g.contributions.filter((c) => String(c.user) === String(uid)).reduce((s, c) => s + c.amount + (c.lateFee || 0), 0);
        if (g.status === "active") activeGroups++;
        const me = g.findMember(uid);
        if (me && !me.hasReceived && g.status !== "completed") totalExpectedPayouts += g.contributionAmount * g.joinedMembers().length;
    }

    let filtered = groups;
    if (status !== "all") filtered = filtered.filter((g) => g.status === status);
    if (search) filtered = filtered.filter((g) => g.name.toLowerCase().includes(String(search).toLowerCase()));

    res.json({
        success: true,
        summary: { totalGroups: groups.length, activeGroups, totalContribution, totalExpectedPayouts },
        count: filtered.length,
        data: filtered.map((g) => groupCard(g, uid)),
    });
});

// @route GET /api/esusu/:id   (Group Details screen)
export const getGroup = handle(async (req, res) => {
    const group = await loadGroup(req.params.id, { populate: true });
    const uid = req.user._id;
    const me = group.findMember(uid);
    const canView = isCreator(group, uid) || ["joined", "invited"].includes(me?.status) || (group.isPublic && group.status === "pending");
    if (!canView) throw httpError("Access denied", 403);

    const isMember = me?.status === "joined";
    res.json({
        success: true,
        data: {
            ...groupCard(group, uid),
            latePaymentFee: group.latePaymentFee,
            startDate: group.startDate,
            collectionAccount: isMember ? group.collectionAccount : undefined,
            inviteCode: isCreator(group, uid) ? group.inviteCode : undefined,
            summary: groupSummary(group),
            nextPicker: nextPickerView(group),
            invites: isCreator(group, uid)
                ? group.members.filter((m) => m.invitedAt && ["joined", "invited"].includes(m.status)).map((m) => ({
                      user: { _id: m.user?._id, firstName: m.user?.firstName, lastName: m.user?.lastName, avatar: m.user?.avatar ?? null },
                      status: m.status === "invited" ? "pending" : m.status,
                      invitedAt: m.invitedAt,
                      respondedAt: m.respondedAt ?? null,
                  }))
                : undefined,
            participants: isMember || isCreator(group, uid) ? orderedMembers(group).map((m) => participantView(group, m)) : undefined,
            leaderboard: isMember ? buildLeaderboard(group) : undefined,
            myDue: isMember && group.status === "active" && outstandingRounds(group, uid).length
                ? { rounds: outstandingRounds(group, uid), ...amountDue(group, outstandingRounds(group, uid)[0]) }
                : null,
        },
    });
});

// @route GET /api/esusu/:id/tracking   (Payment & Contribution Tracking screen)
export const getTracking = handle(async (req, res) => {
    const group = await loadGroup(req.params.id, { populate: true });
    assertMember(group, req.user._id);
    const round = Number(req.query.round) || group.currentRound;
    const due = amountDue(group, round);

    const contributions = orderedMembers(group).map((m) => {
        const paid = roundContributions(group, round, m.user._id);
        const total = paid.reduce((s, c) => s + c.amount, 0);
        return {
            user: { _id: m.user._id, firstName: m.user.firstName, lastName: m.user.lastName, avatar: m.user.avatar ?? null },
            status: paid.length ? "paid" : "pending",
            amountContributed: total,
            lateFee: paid.length ? paid.reduce((s, c) => s + (c.lateFee || 0), 0) : due.lateFee,
            isLate: paid.length ? paid.some((c) => c.isLate) : due.isLate,
            paidAt: paid[0]?.date ?? null,
            canRemind: group.status === "active" && !paid.length && String(m.user._id) !== String(req.user._id),
        };
    });

    const previousPickers = group.payoutHistory
        .filter((p) => p.status === "paid")
        .sort((a, b) => b.round - a.round)
        .map((p) => {
            const m = group.findMember(p.member);
            return { user: m?.user ? { _id: m.user._id, firstName: m.user.firstName, lastName: m.user.lastName } : { _id: p.member }, round: p.round, payoutAmount: p.amount, status: "paid", paidAt: p.timestamp };
        });

    const myOwed = outstandingRounds(group, req.user._id);
    res.json({
        success: true,
        data: {
            round,
            payment: {
                nextPicker: nextPickerView(group),
                myPayment: myOwed.length
                    ? { status: "pending", rounds: myOwed, ...amountDue(group, myOwed[0]), canPayNow: group.status === "active" }
                    : { status: "paid", rounds: [], canPayNow: false },
                previousPickers,
            },
            contributions,
        },
    });
});

// @route GET /api/esusu/:id/transactions?type=contribution|payout&round=&userId=&from=&to=&page=&limit=
export const getTransactions = handle(async (req, res) => {
    const group = await loadGroup(req.params.id, { populate: true });
    assertMember(group, req.user._id);
    const { type, round, userId, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);

    const nameOf = (id) => {
        const m = group.findMember(id);
        return m?.user?.firstName ? { _id: m.user._id, firstName: m.user.firstName, lastName: m.user.lastName } : { _id: id };
    };

    let items = [
        ...group.contributions.map((c) => ({
            _id: c._id, type: "contribution", user: nameOf(c.user), round: c.round, amount: c.amount, lateFee: c.lateFee || 0,
            isLate: c.isLate, method: c.method, paymentMethod: c.paymentMethod, receiptUrl: c.receiptUrl || null, note: c.note || null,
            status: "successful", date: c.date,
        })),
        ...group.payoutHistory.map((p) => ({
            _id: p._id, type: p.status === "topup" ? "payout_topup" : "payout", user: nameOf(p.member), round: p.round, amount: p.amount || 0,
            status: p.status === "paid" || p.status === "topup" ? "successful" : p.status, transactionId: p.transactionId || null, note: p.note || null, date: p.timestamp,
        })),
    ];

    if (type === "contribution") items = items.filter((i) => i.type === "contribution");
    if (type === "payout") items = items.filter((i) => i.type.startsWith("payout"));
    if (round) items = items.filter((i) => i.round === Number(round));
    if (userId) items = items.filter((i) => String(i.user._id) === String(userId));
    if (from) items = items.filter((i) => new Date(i.date) >= new Date(from));
    if (to) items = items.filter((i) => new Date(i.date) <= new Date(to));
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, total: items.length, page, pages: Math.ceil(items.length / limit), data: items.slice((page - 1) * limit, page * limit) });
});
