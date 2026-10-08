// import { watchFile } from "fs";
import EsusuGroup from "../models/EsusuGroup.js";
import { debitWallet } from "../services/walletService.js"

// @desc Create Esusu group
export const createGroup = async (req, res) => {
    try {
        const { name, contributionAmount, frequency } = req.body;

        const group = await EsusuGroup.create({
            name,
            creator: req.user._id,
            contributionAmount,
            frequency,
            members: [{ user: req.user._id, order: 1 }],
            nextPayoutDate: new Date(),
        });


        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Join existing Esusu group 
export const joinGroup = async (req, res) => {
    try {
        const { groupId } = req.body;
        const group = await EsusuGroup.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found"});

        // Check if already a member 
        if (group.members.some(members => members.user.toString() === req.user._id.toString())) {
            return res.status(400).json({ message: "Already a member" });
        }

        group.members.push({ user: req.user._id, order: group.members.length + 1 });
        await group.save();

        res.json({ message: "Joined successfully", group });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get group details
export const getGroup = async (req, res) => {
  try {
    const group = await EsusuGroup.findById(req.params.id)
      .populate("members.user", "name email");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Add esusu contribution
export const addEsusuContribution = async (req, res) => {
  try {
    const { groupId, amount } = req.body;
    const userId = req.user.id;

    const group = await EsusuGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const member = group.members.find(
      (m) => m.user.toString() === userId.toString()
    );
    if (!member) {
      return res.status(403).json({ success: false, message: "You’re not a member of this group" });
    }

    if (amount !== group.contributionAmount) {
      return res.status(400).json({
        success: false,
        message: `Contribution must be exactly ₦${group.contributionAmount}`,
      });
    }

    // 💳 Deduct from wallet & log transaction
    await debitWallet(userId, amount, "esusu_contribution", group._id);

    // Optionally, track the contribution internally
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
      group,
    });
  } catch (error) {
    console.error("Error in addEsusuContribution:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all public/discoverable Esusu groups (Paginated & Searchable)
export const getAllEsusuGroups = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const { search, frequency, active } = req.query;

    const query = {};

    if (active !== undefined) {
      query.active = active === "true";
    } else {
      query.active = true;
    }

    if (frequency && ["daily", "weekly", "monthly"].includes(frequency)) {
      query.frequency = frequency;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const total = await EsusuGroup.countDocuments(query);
    const groups = await EsusuGroup.find(query)
      .populate("creator", "name email")
      .populate("members.user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: groups.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: groups,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Esusu groups where authenticated user is creator or member
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await EsusuGroup.find({
      $or: [
        { creator: userId },
        { "members.user": userId }
      ]
    })
      .populate("creator", "name email")
      .populate("members.user", "name email")
      .sort({ createdAt: -1 });

    let totalExpectedPayouts = 0;

    const formattedGroups = groups.map((group) => {
      const gObj = group.toObject();
      const isCreator = group.creator._id.toString() === userId.toString();
      
      // Find current user's membership details
      const myMemberObj = group.members.find(
        (m) => m.user && m.user._id.toString() === userId.toString()
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
        myMembership: myMemberObj
          ? {
              order: myMemberObj.order || null,
              hasReceived: myMemberObj.hasReceived || false,
              payoutStatus: myMemberObj.payoutStatus || "pending",
              payoutAttempts: myMemberObj.payoutAttempts || 0,
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

    res.status(200).json({
      success: true,
      summary: {
        totalGroups: groups.length,
        totalExpectedPayouts,
      },
      count: formattedGroups.length,
      data: formattedGroups,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
