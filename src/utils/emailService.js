import nodemailer from "nodemailer";

/**
 * @param {Object} user - Populated user object containing email and name
 * @param {Object} bill - The bill object from the database
 * @param {String} type - Notification type: 'bill_reminder', 'bill_alert', 'bill_overdue'
 */
export const sendBillEmail = async (user, bill, type) => {
  // 1. Create transporter using your specific .env keys
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // smtp.gmail.com
    port: process.env.SMTP_PORT, // 587
    secure: false, // TLS
    auth: {
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASS, 
    },
  });

  // 2. Map the 'type' parameter to specific visual styles
  const config = {
    bill_reminder: {
      subject: `Upcoming Bill: ${bill.name}`,
      title: "Friendly Reminder",
      color: "#3b82f6", 
      message: `Your bill for ${bill.name} is due in 7 days.`
    },
    bill_alert: {
      subject: `Action Required: ${bill.name}`,
      title: "Bill Due Today",
      color: "#f59e0b", 
      message: `Your bill for ${bill.name} is due today. Pay now to avoid issues.`
    },
    bill_overdue: {
      subject: `URGENT: ${bill.name} is Overdue`,
      title: "Payment Overdue",
      color: "#ef4444", 
      message: `Your bill for ${bill.name} was due on ${new Date(bill.dueDate).toDateString()}.`
    }
  };

  const { subject, title, color, message } = config[type];

  // 3. Generate the HTML with inline styles for better email client support
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${color}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Zorah</h1>
        </div>
        <div style="padding: 30px; color: #334155;">
            <h2 style="color: ${color};">${title}</h2>
            <p>Hello ${user.name},</p>
            <p>${message}</p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <p style="margin:0;"><strong>Bill:</strong> ${bill.name}</p>
                <p style="margin:5px 0;"><strong>Amount:</strong> ₦${bill.amount.toLocaleString()}</p>
                <p style="margin:0;"><strong>Due Date:</strong> ${new Date(bill.dueDate).toDateString()}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.SMTP_USER}/bills" style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View & Pay Bill</a>
            </div>
        </div>
    </div>
  `;

  // 4. Send the mail
  await transporter.sendMail({
    from: `"Zorah Finance" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: subject,
    html: html,
  });
};