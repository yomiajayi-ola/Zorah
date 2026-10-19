import EsusuGroup from "../models/EsusuGroup.js";
import { debitWallet } from "../services/walletService.js";

// @desc    Create Esusu group
// @route   POST /api/esusu/create
// @access  Private
export const createGroup = async (req, res) => {
    try {
        const { name, contributionAmount, frequency, maxMembers, isPublic } = req.body;

        if (!name || !contributionAmount || !frequency) {
            return res.status(400).json({ success: false, message: "name, contributionAmount, and frequency are required." });
        }

        const group = await EsusuGroup.create({
            name,
            creator: req.user._id,
            contributionAmount,
            frequency,
            maxMembers: maxMembers || 10,
            isPublic: isPublic !== undefined ? isPublic : true,
            members: [{ user: req.user._id, order: 1 }],
            nextPayoutDate: new Date(),
        });

        return res.status(201).json({
            success: true,
            message: "Esusu group created successfully",
            data: group,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Join existing Esusu group
// @route   POST /api/esusu/join
// @access  Private
export const joinGroup = async (req, res) => {
    try {
        const { groupId } = req.body;
        const userId = req.user._id;

        const group = await EsusuGroup.findById(groupId);
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        if (!group.active) {
            return res.status(400).json({ success: false, message: "This group is no longer active." });
        }

        // Check if group is full
        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({
                success: false,
                message: `This group is full. Maximum ${group.maxMembers} members allowed.`,
            });
        }

        // Check if already a member
        if (group.members.some((m) => m.user.toString() === userId.toString())) {
            return res.status(400).json({ success: false, message: "You are already a member of this group." });
        }

        group.members.push({
            user: userId,
            order: group.members.length + 1,
        });
        await group.save();

        return res.status(200).json({
            success: true,
            message: "Joined group successfully",
            data: {
                groupId: group._id,
                groupName: group.name,
                yourOrder: group.members.length,
                totalMembers: group.members.length,
                contributionAmount: group.contributionAmount,
                frequency: group.frequency,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single group details
// @route   GET /api/esusu/:id
// @access  Private
export const getGroup = async (req, res) => {
    try {
        const group = await EsusuGroup.findById(req.params.id)
            .populate("creator", "firstName lastName email")
            .populate("members.user", "firstName lastName email");

        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        return res.status(200).json({ success: true, data: group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add esusu contribution
// @route   POST /api/esusu/contribute
// @access  Private
export const addEsusuContribution = async (req, res) => {
    try {
        const { groupId, amount } = req.body;
        const userId = req.user.id;

        const group = await EsusuGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        const member = group.members.find((m) => m.user.toString() === userId.toString());
        if (!member) {
            return res.status(403).json({ success: false, message: "You're not a member of this group" });
        }

        if (amount !== group.contributionAmount) {
            return res.status(400).json({
                success: false,
                message: `Contribution must be exactly ₦${group.contributionAmount}`,
            });
        }

        // Deduct from wallet & log transaction
        await debitWallet(userId, amount, "esusu_contribution", group._id);

        if (!group.contributions) group.contributions = [];
        group.contributions.push({
            user: userId,
            amount,
            date: new Date(),
            round: group.currentRound,
        });

        await group.save();

        return res.status(200).json({
            success: true,
            message: "Contribution added successfully",
            data: group,
        });
    } catch (error) {
        console.error("Error in addEsusuContribution:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all public/discoverable Esusu groups (Paginated & Searchable)
// @route   GET /api/esusu
// @access  Private
export const getAllEsusuGroups = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;
        const { search, frequency } = req.query;

        // Only return public, active groups
        const query = {
            isPublic: true,
            active: true,
        };

        if (frequency && ["daily", "weekly", "monthly"].includes(frequency)) {
            query.frequency = frequency;
        }

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const total = await EsusuGroup.countDocuments(query);
        const groups = await EsusuGroup.find(query)
            .populate("creator", "firstName lastName")
            .select("-payoutHistory -contributions") // Exclude heavy fields from listing
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Annotate each group with availability info
        const data = groups.map((g) => ({
            _id: g._id,
            name: g.name,
            frequency: g.frequency,
            contributionAmount: g.contributionAmount,
            maxMembers: g.maxMembers,
            currentMembers: g.members.length,
            spotsLeft: g.maxMembers - g.members.length,
            isFull: g.members.length >= g.maxMembers,
            creator: g.creator,
            nextPayoutDate: g.nextPayoutDate,
            createdAt: g.createdAt,
        }));

        return res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            count: data.length,
            data,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Esusu groups the authenticated user belongs to or created
// @route   GET /api/esusu/my-groups
// @access  Private
export const getUserGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await EsusuGroup.find({
            $or: [
                { creator: userId },
                { "members.user": userId },
            ],
        })
            .populate("creator", "firstName lastName email")
            .populate("members.user", "firstName lastName email")
            .sort({ createdAt: -1 });

        let totalExpectedPayouts = 0;

        const formattedGroups = groups.map((group) => {
            const gObj = group.toObject();

            // Null-safe creator comparison
            const creatorId = group.creator?._id || group.creator;
            const isCreator = creatorId && creatorId.toString() === userId.toString();

            // Find current user's membership details
            const myMemberObj = group.members.find(
                (m) => m.user && m.user._id && m.user._id.toString() === userId.toString()
            );

            // Find next member scheduled for payout
            const nextRecipient = group.members.find(
                (m) => !m.hasReceived && m.payoutStatus !== "paid"
            );

            const totalPoolAmount = group.contributionAmount * group.members.length;

            if (myMemberObj && !myMemberObj.hasReceived) {
                totalExpectedPayouts += totalPoolAmount;
            }

            return {
                ...gObj,
                isCreator,
                spotsLeft: group.maxMembers - group.members.length,
                isFull: group.members.length >= group.maxMembers,
                myMembership: myMemberObj
                    ? {
                          order: myMemberObj.order || null,
                          hasReceived: myMemberObj.hasReceived || false,
                          payoutStatus: myMemberObj.payoutStatus || "pending",
                          payoutAttempts: myMemberObj.payoutAttempts || 0,
                          joinedAt: myMemberObj.joinedAt || null,
                      }
                    : null,
                totalPoolAmount,
                nextRecipient: nextRecipient
                    ? {
                          user: nextRecipient.user,
                          order: nextRecipient.order,
                      }
                    : null,
            };
        });

        return res.status(200).json({
            success: true,
            summary: {
                totalGroups: groups.length,
                totalExpectedPayouts,
            },
            count: formattedGroups.length,
            data: formattedGroups,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
