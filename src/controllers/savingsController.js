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
// @desc Add contributiona
// /controllers/savingsController.js
export const addContribution = async (req, res) => {
  try {
    const { goalId, amount } = req.body;
    const userId = req.user._id;

    // A. Find the Goal
    const goal = await SavingsGoal.findOne({ _id: goalId, user: userId });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    // B. Real-Time Balance Check (Optional but recommended)
    // You can call your getWalletBalance function here to ensure 
    // the user has enough money before even hitting the API.

    // C. Execute the Debit in Real-Time
    // This calls Xpress Wallet API to actually move the money
    await debitWallet(userId, amount, "savings_contribution", goal._id);

    // D. Update the Goal amount locally
    goal.currentAmount += Number(amount);
    
    // E. Update Goal's internal funding history
    goal.fundingHistory.push({
        amount: amount,
        date: new Date()
    });
    
    await goal.save();

    const progress = ((goal.currentAmount / goal.targetAmount) * 100).toFixed(2);

    return res.json({
      message: "Contribution added successfully",
      balance_deducted: amount,
      progress: `${progress}%`,
      goal,
    });
  } catch (error) {
    // If debitWallet throws "Insufficient balance", it caught here
    return res.status(400).json({ message: error.message });
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

export const getGoalById = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    res.json(goal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    const { title, targetAmount, deadline, description } = req.body;

    if (title) goal.title = title;
    if (targetAmount) goal.targetAmount = targetAmount;
    if (deadline) goal.deadline = deadline;
    if (description) goal.description = description;

    await goal.save();

    res.json({ message: "Goal updated successfully", goal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const archiveGoal = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    goal.status = "archived";
    goal.archivedAt = new Date();

    await goal.save();

    res.json({ message: "Goal archived successfully", goal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const restoreGoal = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    goal.status = "active";
    goal.archivedAt = null;

    await goal.save();

    res.json({ message: "Goal restored successfully", goal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteGoalPermanently = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!goal)
      return res.status(404).json({ message: "Goal not found" });

    res.json({ message: "Goal deleted permanently" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// /controllers/savingsController.js
export const getGoalFundingHistory = async (req, res) => {
  try {
      const history = await Transaction.find({ 
          user: req.user.id, 
          purpose: "savings_contribution", // Filter for savings money
          reference: req.params.goalId,     // The goal ID we saved as reference
          status: "successful"
      }).sort({ createdAt: -1 });

      return res.json({ success: true, history });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
};
