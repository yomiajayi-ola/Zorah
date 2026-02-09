import nodemailer from "nodemailer";

export const sendEmail = async (options) => {
    const smtpConfig = {
        host: process.env.SMTP_HOST || "smtp.gmail.com", 
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465 || true, 
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS, 
        },
        logger: true, 
        debug: true,
        tls: {
            
            rejectUnauthorized: false 
        },
        connectionTimeout: 10000, 
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