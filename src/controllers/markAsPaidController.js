import Bill from "../models/Bills.js";
import Expense from "../models/Expense.js";

export const markAsPaid = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user._id });

    if (!bill) return res.status(404).json({ message: "Bill not found" });
    if (bill.status === "paid") return res.status(400).json({ message: "Bill already paid" });

    // 1. Update Bill Status
    bill.status = "paid";
    await bill.save();

    // 2. Automatically create an Expense record
    await Expense.create({
      user: req.user._id,
      amount: bill.amount,
      category: bill.category, // e.g., "Electricity"
      description: `Payment for ${bill.name}`,
      paymentMethod: bill.paymentMethod || "Wallet",
      date: new Date(),
      status: "active"
    });

    res.json({ message: "Bill paid and added to expenses", bill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};