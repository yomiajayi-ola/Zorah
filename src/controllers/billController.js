import Bill from "../models/Bills.js";

export const addBill = async (req, res) => {
    try {
      const { name, amount, dueDate, frequency, category, reminderEnabled } = req.body;
      
      let bill = await Bill.create({
        user: req.user._id,
        name,
        amount,
        dueDate,
        frequency,
        category,
        reminderEnabled
      });
  
      // 💡 SOUND ENGINEER TIP: Populate user so we have the email for the service
      bill = await bill.populate("user", "fullName email");
  
      // Optional: Send a 'Bill Created' email or wait for the Cron Job
      // await sendBillEmail(bill.user, bill, "bill_reminder");
  
      res.status(201).json({ status: "success", data: bill });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

export const getBills = async (req, res) => {
    try {
      const { status } = req.query; // Supports the "All", "Overdue", "Paid" filters
      const query = { user: req.user._id };
  
      if (status && status !== 'all') {
        query.status = status;
      }
  
      const bills = await Bill.find(query).sort({ dueDate: 1 });
  
      // Calculate Summary Totals for the Top Card
      const allUserBills = await Bill.find({ user: req.user._id });
      
      const summary = allUserBills.reduce((acc, bill) => {
        acc.totalMonthly += bill.amount;
        if (bill.status === 'paid') acc.totalPaid += bill.amount;
        if (bill.status === 'unpaid' || bill.status === 'overdue') acc.totalDue += bill.amount;
        return acc;
      }, { totalMonthly: 0, totalPaid: 0, totalDue: 0 });
  
      res.json({
        summary,
        bills
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  export const updateBill = async (req, res) => {
    try {
      const { billId } = req.params;
      
      if (!req.body) {
        return res.status(400).json({ message: "Request body is missing" });
    }
  
      // Only allow fields that can be edited
      const allowedUpdates = [
        "name",
        "amount",
        "dueDate",
        "category",
        "frequency",
        "paymentMethod",
        "note",
        "status",
        "reminderEnabled"
      ];
  
      const updates = {};
      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });
  
      const bill = await Bill.findOneAndUpdate(
        { _id: billId, user: req.user._id }, // 🔐 ensure ownership
        updates,
        { new: true, runValidators: true }
      );
  
      if (!bill) {
        return res.status(404).json({
          status: "error",
          message: "Bill not found"
        });
      }
  
      res.status(200).json({
        status: "success",
        data: bill
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };