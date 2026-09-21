import Debt from "../models/Debt.js";
import Joi from "joi";

// Helper function to format Nigerian phone numbers for WhatsApp deep-linking
export const formatNigerianPhone = (phone) => {
  if (!phone) return "";
  // Strip out all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // If 11 digits starting with '0' (e.g., 08012345678 -> 2348012345678)
  if (digits.length === 11 && digits.startsWith("0")) {
    return "234" + digits.substring(1);
  }

  // If 10 digits (e.g., 8012345678 -> 2348012345678)
  if (digits.length === 10) {
    return "234" + digits;
  }

  // If already starts with 234
  if (digits.startsWith("234")) {
    return digits;
  }

  return digits;
};

// Joi Validation Schemas
const createDebtSchema = Joi.object({
  debtorName: Joi.string().required().trim().messages({
    "any.required": "Debtor/Creditor name is required",
    "string.empty": "Debtor/Creditor name cannot be empty",
  }),
  phoneNumber: Joi.string().trim().allow("").default(""),
  amount: Joi.number().greater(0).required().messages({
    "any.required": "Amount is required",
    "number.greater": "Amount must be greater than zero",
  }),
  type: Joi.string().valid("owe_me", "i_owe").default("owe_me"),
  dueDate: Joi.date().iso().allow(null),
  notes: Joi.string().trim().allow("").default(""),
});

const updateDebtSchema = Joi.object({
  debtorName: Joi.string().trim(),
  phoneNumber: Joi.string().trim().allow(""),
  amount: Joi.number().greater(0),
  type: Joi.string().valid("owe_me", "i_owe"),
  dueDate: Joi.date().iso().allow(null),
  notes: Joi.string().trim().allow(""),
  isSettled: Joi.boolean(),
});

/**
 * @desc    Create a new Debt record
 * @route   POST /api/debts
 * @access  Private
 */
export const createDebt = async (req, res) => {
  try {
    const { error, value } = createDebtSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: "fail", message: error.details[0].message });
    }

    const debt = new Debt({
      user: req.user._id,
      ...value,
    });

    // Enforce document .save() for validations and hooks
    await debt.save();

    res.status(201).json({
      status: "success",
      message: "Debt record created successfully",
      data: debt,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Get all debts for user & debtor balance summary
 * @route   GET /api/debts
 * @access  Private
 */
export const getDebts = async (req, res) => {
  try {
    const { type, isSettled } = req.query;
    const query = { user: req.user._id };

    if (type && ["owe_me", "i_owe"].includes(type)) {
      query.type = type;
    }

    if (isSettled !== undefined) {
      query.isSettled = isSettled === "true";
    }

    const debts = await Debt.find(query).sort({ createdAt: -1 });

    // Calculate Debtor Balance Summary
    const summaryData = await Debt.aggregate([
      { $match: { user: req.user._id, isSettled: false } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalOwedToMe = 0;
    let totalIOwe = 0;

    summaryData.forEach((item) => {
      if (item._id === "owe_me") totalOwedToMe = item.total;
      if (item._id === "i_owe") totalIOwe = item.total;
    });

    res.status(200).json({
      status: "success",
      summary: {
        totalOwedToMe,
        totalIOwe,
        netBalance: totalOwedToMe - totalIOwe,
      },
      count: debts.length,
      data: debts,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Get single debt by ID
 * @route   GET /api/debts/:id
 * @access  Private
 */
export const getDebtById = async (req, res) => {
  try {
    const debt = await Debt.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!debt) {
      return res.status(404).json({ status: "fail", message: "Debt record not found" });
    }

    res.status(200).json({
      status: "success",
      data: debt,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Update a debt record
 * @route   PATCH /api/debts/:id
 * @access  Private
 */
export const updateDebt = async (req, res) => {
  try {
    const { error, value } = updateDebtSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: "fail", message: error.details[0].message });
    }

    const debt = await Debt.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!debt) {
      return res.status(404).json({ status: "fail", message: "Debt record not found" });
    }

    // Apply updates on document
    if (value.debtorName !== undefined) debt.debtorName = value.debtorName;
    if (value.phoneNumber !== undefined) debt.phoneNumber = value.phoneNumber;
    if (value.amount !== undefined) debt.amount = value.amount;
    if (value.type !== undefined) debt.type = value.type;
    if (value.dueDate !== undefined) debt.dueDate = value.dueDate;
    if (value.notes !== undefined) debt.notes = value.notes;
    if (value.isSettled !== undefined) debt.isSettled = value.isSettled;

    // Use document .save() to ensure Mongoose hooks & validations execute
    await debt.save();

    res.status(200).json({
      status: "success",
      message: "Debt record updated successfully",
      data: debt,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Settle a debt (mark as paid/settled)
 * @route   PATCH /api/debts/:id/settle
 * @access  Private
 */
export const settleDebt = async (req, res) => {
  try {
    const debt = await Debt.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!debt) {
      return res.status(404).json({ status: "fail", message: "Debt record not found" });
    }

    debt.isSettled = true;

    // Use document .save()
    await debt.save();

    res.status(200).json({
      status: "success",
      message: "Debt marked as settled successfully",
      data: debt,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Trigger WhatsApp Nudge for a debt
 * @route   POST /api/debts/:id/nudge
 * @access  Private
 */
export const triggerNudge = async (req, res) => {
  try {
    // 1. Ownership validation
    const debt = await Debt.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!debt) {
      return res.status(404).json({ status: "fail", message: "Debt record not found" });
    }

    if (debt.isSettled) {
      return res.status(400).json({ status: "fail", message: "Cannot nudge for an already settled debt" });
    }

    if (debt.type !== "owe_me") {
      return res.status(400).json({ status: "fail", message: "Cannot send a collection nudge for money you owe" });
    }

    // 2. Format Phone Number for WhatsApp
    const formattedPhone = formatNigerianPhone(debt.phoneNumber);

    // 3. Construct Pre-filled WhatsApp Message
    const formattedAmount = debt.amount.toLocaleString("en-NG", { minimumFractionDigits: 0 });
    const formattedDate = debt.dueDate
      ? new Date(debt.dueDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "the agreed date";

    const rawMessage = `Hi ${debt.debtorName}, gentle reminder about the balance of ₦${formattedAmount} due on ${formattedDate}.`;
    const nudgeUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(rawMessage)}`;

    // 4. Update reminder tracking metrics
    debt.remindersSentCount += 1;
    debt.lastNudgeAt = new Date();

    // Enforce document .save()
    await debt.save();

    res.status(200).json({
      status: "success",
      message: "Nudge generated successfully",
      nudgeUrl,
      remindersSentCount: debt.remindersSentCount,
      lastNudgeAt: debt.lastNudgeAt,
      data: debt,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Delete a debt record permanently
 * @route   DELETE /api/debts/:id
 * @access  Private
 */
export const deleteDebt = async (req, res) => {
  try {
    const debt = await Debt.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!debt) {
      return res.status(404).json({ status: "fail", message: "Debt record not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Debt record deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
