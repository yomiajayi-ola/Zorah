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