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

// @desc Add contribution
export const addContribution = async (req, res) => {
    try {
        const { goalId, amount } = req.body;
        const goal = await SavingsGoal.findOne({ _id: goalId, user: req.user._id });
        if (!goal) return res.status(404).json({ message: "Goal not found "});

        goal.currentAmount += amount;
        await goal.save();

        res.json({
            message: "Contribution added",
            progress: `${((goal.currentAmount / goal.targetAmount) * 100).toFixed(2)}%`,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get all user goals
export const getGoals = async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ user: req.user._id });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}