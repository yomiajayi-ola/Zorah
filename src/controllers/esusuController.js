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
