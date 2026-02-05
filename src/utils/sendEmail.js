import nodemailer from "nodemailer";

export const sendEmail = async (options) => {
    // Force direct values if process.env fails for any reason
    const smtpConfig = {
        host: process.env.SMTP_HOST || "smtp.gmail.com", 
        port: Number(process.env.SMTP_PORT) || 465,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        // Add this to help with some network restrictions
        tls: {
            rejectUnauthorized: false
        }
    };

    const transporter = nodemailer.createTransport(smtpConfig);

    const mailOptions = {
        from: `"Zorah Support" <${process.env.SMTP_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("❌ SendMail Error:", error);
        throw error;
    }
};