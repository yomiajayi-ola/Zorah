// import { watchFile } from "fs";
import EsusuGroup from "../models/EsusuGroup.js";

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
