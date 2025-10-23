import SavingsGoal from "../models/SavingsGoal.js";
import { debitWallet } from "../services/walletService.js"

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
      const userId = req.user._id;
  
      // Find user's goal
      const goal = await SavingsGoal.findOne({ _id: goalId, user: userId });
      if (!goal)
        return res.status(404).json({ message: "Goal not found" });
  
      // Step 1: Debit the user’s wallet first
      await debitWallet(userId, amount, "savings_contribution", goal._id);
  
      // Step 2: Add contribution to goal
      goal.currentAmount += amount;
      await goal.save();
  
      // Step 3: Compute progress
      const progress = ((goal.currentAmount / goal.targetAmount) * 100).toFixed(2);
  
      return res.json({
        message: "Contribution added successfully",
        progress: `${progress}%`,
        goal,
      });
    } catch (error) {
      console.error("Error adding savings contribution:", error);
      return res.status(500).json({ message: error.message });
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