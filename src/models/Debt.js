import mongoose from "mongoose";

/**
 * Debt Schema (Debt Tracker & WhatsApp Nudge Engine)
 *
 * INDEXING STRATEGY:
 * ------------------
 * 1. Compound index on { user: 1, isSettled: 1 }: High performance filtering for active/settled debts.
 * 2. Compound index on { user: 1, type: 1, isSettled: 1 }: Enables instant aggregation of debtor balances ('owe_me' vs 'i_owe').
 * 3. Index on { dueDate: 1 }: Supports upcoming debt alert cron jobs and reminder queries.
 *
 * SCHEMA VALIDATIONS & DEFAULTS:
 * ------------------------------
 * - debtorName: String (required). Name of the person who owes money or is owed money.
 * - phoneNumber: String (optional/recommended for WhatsApp Nudge deep links).
 * - amount: Positive number (required).
 * - type: Enum ["owe_me", "i_owe"], default "owe_me".
 *   - "owe_me": Someone owes the user money (Receivable).
 *   - "i_owe": The user owes someone money (Payable).
 * - dueDate: Date for expected debt repayment.
 * - isSettled: Boolean flag, default false.
 * - remindersSentCount: Increments every time a WhatsApp nudge trigger endpoint is called.
 * - lastNudgeAt: Timestamp recording the last nudge sent.
 */
const debtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    debtorName: {
      type: String,
      required: [true, "Debtor/Creditor name is required"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: [true, "Debt amount is required"],
      min: [0.01, "Amount must be greater than zero"],
    },
    type: {
      type: String,
      enum: ["owe_me", "i_owe"],
      default: "owe_me",
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    isSettled: {
      type: Boolean,
      default: false,
    },
    remindersSentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastNudgeAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound indexes for optimal query execution
debtSchema.index({ user: 1, isSettled: 1 });
debtSchema.index({ user: 1, type: 1, isSettled: 1 });
debtSchema.index({ user: 1, dueDate: 1 });

export default mongoose.model("Debt", debtSchema);
