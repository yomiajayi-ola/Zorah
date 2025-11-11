import Income from "../models/Income.js";

// ✅ Add new income
export const addIncome = async (req, res) => {
  try {
    const userId = req.user._id;
    const { source, amount, description, category, date } = req.body;

    if (!source || !amount) {
      return res.status(400).json({ message: "Source and amount are required" });
    }

    const income = await Income.create({
      user: userId,
      source,
      amount,
      description,
      category,
      date,
    });

    res.status(201).json({
      success: true,
      message: "Income added successfully",
      data: income,
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding income", error: error.message });
  }
};

// ✅ Get all income for a user
export const getIncomes = async (req, res) => {
  try {
    const incomes = await Income.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: incomes.length, data: incomes });
  } catch (error) {
    res.status(500).json({ message: "Error fetching incomes", error: error.message });
  }
};

// ✅ Get single income
export const getIncomeById = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income || income.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Income not found" });
    }

    res.status(200).json({ success: true, data: income });
  } catch (error) {
    res.status(500).json({ message: "Error fetching income", error: error.message });
  }
};

// ✅ Update income
export const updateIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income || income.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Income not found or not authorized" });
    }

    const updated = await Income.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, message: "Income updated", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Error updating income", error: error.message });
  }
};

// ✅ Delete income
export const deleteIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income || income.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Income not found or not authorized" });
    }

    await income.deleteOne();
    res.status(200).json({ success: true, message: "Income deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting income", error: error.message });
  }
};
