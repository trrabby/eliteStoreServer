import nodemailer from "nodemailer";
import config from "../config";

const emailSender = async (email: string, html: string) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: config.email,
        pass: config.app_pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: '"assignment 9" <sadikrahman494@gmail.com>',
      to: email,
      subject: "Reset Password Link",
      html,
    });

    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("Failed to send email", error);
    throw new Error("Failed to send reset password email");
  }
};
export default emailSender;
