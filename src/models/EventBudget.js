import mongoose from "mongoose";

/**
 * Itemized Expense Schema for Event Budgets (Owambe Mode)
 */
const eventBudgetItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Item name is required"],
    trim: true,
  },
  estimatedCost: {
    type: Number,
    required: true,
    min: [0, "Estimated cost cannot be negative"],
    default: 0,
  },
  actualCost: {
    type: Number,
    min: [0, "Actual cost cannot be negative"],
    default: 0,
  },
  paid: {
    type: Boolean,
    default: false,
  },
});

/**
 * EventBudget Schema (Owambe Mode)
 *
 * INDEXING STRATEGY:
 * ------------------
 * 1. Compound index on { user: 1, status: 1 }: Fast lookup when listing active/completed/cancelled event budgets for a specific user.
 * 2. Index on { user: 1, createdAt: -1 }: Enables fast chronological sorting on user dashboard.
 *
 * SCHEMA VALIDATIONS & DEFAULTS:
 * ------------------------------
 * - title: Trimmed string (e.g., "Wedding", "Burial", "Child Naming"). Required.
 * - targetBudget: Positive number representing total planned event budget.
 * - totalSpent: Default 0. Tracked dynamically.
 * - categoryTags: Array of strings (e.g. ['aso ebi', 'transport to village', 'gift money']).
 * - status: Enum ["active", "completed", "cancelled"], default "active".
 *
 * TOTAL SPENT CALCULATION STRATEGY:
 * ---------------------------------
 * `totalSpent` is calculated dynamically when itemizedList entries are mutated (or via pre-save hook).
 * It computes the sum of `actualCost` for all items marked `paid: true` (or non-zero `actualCost`).
 */
const eventBudgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    targetBudget: {
      type: Number,
      required: [true, "Target budget amount is required"],
      min: [0, "Target budget cannot be negative"],
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, "Total spent cannot be negative"],
    },
    categoryTags: [
      {
        type: String,
        trim: true,
      },
    ],
    itemizedList: [eventBudgetItemSchema],
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Compound indexes for user query performance
eventBudgetSchema.index({ user: 1, status: 1 });
eventBudgetSchema.index({ user: 1, createdAt: -1 });

// Pre-save hook to automatically calculate totalSpent from itemizedList
eventBudgetSchema.pre("save", function (next) {
  if (this.itemizedList && this.itemizedList.length > 0) {
    this.totalSpent = this.itemizedList.reduce((acc, item) => {
      return acc + (item.paid ? (typeof item.actualCost === 'number' ? item.actualCost : item.estimatedCost || 0) : 0);
    }, 0);
  } else {
    this.totalSpent = 0;
  }
  next();
});

export default mongoose.model("EventBudget", eventBudgetSchema);
