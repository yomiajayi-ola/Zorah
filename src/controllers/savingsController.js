import SavingsGoal from "../models/SavingsGoal.js";

// @desc Create savings goal
export const createGoal = async (req, res) => {
    try {
        const { title, targetAmount, deadline, description } = req.body;
        const goal = await SavingsGoal.create({
            user: req.user._id,
            title,
            targetAmount,
            deadline,
            description,
        });

        res.status(201).json(goal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};