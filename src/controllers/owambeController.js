import EventBudget from "../models/EventBudget.js";
import Joi from "joi";

// Joi Schemas for Request Validation
const createEventBudgetSchema = Joi.object({
  title: Joi.string().required().trim().messages({
    "any.required": "Event title is required",
    "string.empty": "Event title cannot be empty",
  }),
  targetBudget: Joi.number().positive().required().messages({
    "any.required": "Target budget is required",
    "number.positive": "Target budget must be a positive number",
  }),
  categoryTags: Joi.array().items(Joi.string().trim()).default([]),
  itemizedList: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required().trim(),
        estimatedCost: Joi.number().min(0).default(0),
        actualCost: Joi.number().min(0).default(0),
        paid: Joi.boolean().default(false),
      })
    )
    .default([]),
});

const updateEventBudgetSchema = Joi.object({
  title: Joi.string().trim(),
  targetBudget: Joi.number().positive(),
  categoryTags: Joi.array().items(Joi.string().trim()),
  status: Joi.string().valid("active", "completed", "cancelled"),
});

const logExpenseSchema = Joi.object({
  itemId: Joi.string().optional(),
  name: Joi.string().trim().when("itemId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  estimatedCost: Joi.number().min(0),
  actualCost: Joi.number().min(0),
  paid: Joi.boolean(),
});

/**
 * @desc    Create a new Event Budget (Owambe Mode)
 * @route   POST /api/owambe/events
 * @access  Private
 */
export const createEventBudget = async (req, res) => {
  try {
    const { error, value } = createEventBudgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: "fail", message: error.details[0].message });
    }

    const eventBudget = new EventBudget({
      user: req.user._id,
      ...value,
    });

    // Uses .save() to ensure pre('save') hook calculates totalSpent
    await eventBudget.save();

    res.status(201).json({
      status: "success",
      message: "Event budget created successfully",
      data: eventBudget,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Get all Event Budgets for authenticated user
 * @route   GET /api/owambe/events
 * @access  Private
 */
export const getEventBudgets = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { user: req.user._id };

    if (status && ["active", "completed", "cancelled"].includes(status)) {
      query.status = status;
    }

    const eventBudgets = await EventBudget.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      count: eventBudgets.length,
      data: eventBudgets,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Get single Event Budget by ID
 * @route   GET /api/owambe/events/:id
 * @access  Private
 */
export const getEventBudgetById = async (req, res) => {
  try {
    const eventBudget = await EventBudget.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!eventBudget) {
      return res.status(404).json({ status: "fail", message: "Event budget not found" });
    }

    res.status(200).json({
      status: "success",
      data: eventBudget,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Update Event Budget details
 * @route   PATCH /api/owambe/events/:id
 * @access  Private
 */
export const updateEventBudget = async (req, res) => {
  try {
    const { error, value } = updateEventBudgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: "fail", message: error.details[0].message });
    }

    const eventBudget = await EventBudget.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!eventBudget) {
      return res.status(404).json({ status: "fail", message: "Event budget not found" });
    }

    // Apply updates
    if (value.title !== undefined) eventBudget.title = value.title;
    if (value.targetBudget !== undefined) eventBudget.targetBudget = value.targetBudget;
    if (value.categoryTags !== undefined) eventBudget.categoryTags = value.categoryTags;
    if (value.status !== undefined) eventBudget.status = value.status;

    // Use document .save() to execute pre('save') hooks and validations
    await eventBudget.save();

    res.status(200).json({
      status: "success",
      message: "Event budget updated successfully",
      data: eventBudget,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Add or update itemized expense item in Event Budget
 * @route   POST /api/owambe/events/:id/expenses
 * @access  Private
 */
export const addOrUpdateEventExpense = async (req, res) => {
  try {
    const { error, value } = logExpenseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: "fail", message: error.details[0].message });
    }

    const eventBudget = await EventBudget.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!eventBudget) {
      return res.status(404).json({ status: "fail", message: "Event budget not found" });
    }

    if (value.itemId) {
      // Update existing item
      const item = eventBudget.itemizedList.id(value.itemId);
      if (!item) {
        return res.status(404).json({ status: "fail", message: "Item not found in event budget" });
      }

      if (value.name !== undefined) item.name = value.name;
      if (value.estimatedCost !== undefined) item.estimatedCost = value.estimatedCost;
      if (value.actualCost !== undefined) item.actualCost = value.actualCost;
      if (value.paid !== undefined) item.paid = value.paid;
    } else {
      // Add new item
      eventBudget.itemizedList.push({
        name: value.name,
        estimatedCost: value.estimatedCost || 0,
        actualCost: value.actualCost || 0,
        paid: value.paid || false,
      });
    }

    // Use document .save() to automatically recalculate totalSpent
    await eventBudget.save();

    res.status(200).json({
      status: "success",
      message: value.itemId ? "Event item updated successfully" : "Event item added successfully",
      data: eventBudget,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Delete itemized expense item from Event Budget
 * @route   DELETE /api/owambe/events/:id/items/:itemId
 * @access  Private
 */
export const deleteEventExpense = async (req, res) => {
  try {
    const eventBudget = await EventBudget.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!eventBudget) {
      return res.status(404).json({ status: "fail", message: "Event budget not found" });
    }

    const item = eventBudget.itemizedList.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ status: "fail", message: "Item not found in event budget" });
    }

    item.deleteOne();

    // Use document .save() to recalculate totalSpent after item removal
    await eventBudget.save();

    res.status(200).json({
      status: "success",
      message: "Item removed successfully from event budget",
      data: eventBudget,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * @desc    Delete Event Budget permanently
 * @route   DELETE /api/owambe/events/:id
 * @access  Private
 */
export const deleteEventBudget = async (req, res) => {
  try {
    const eventBudget = await EventBudget.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!eventBudget) {
      return res.status(404).json({ status: "fail", message: "Event budget not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Event budget deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
