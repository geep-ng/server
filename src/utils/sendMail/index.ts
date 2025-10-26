import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ejs from "ejs";
import path from "path";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // use STARTTLS (TLS) instead of SSL
  // requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // tls: {
  //   // Uncomment to enforce server certificate verification
  //   rejectUnauthorized: true,
  // },
});

/// Render an EJS email template
const renderEmailTemplate = async (
  templateName: string,
  data: Record<string, any>
): Promise<string> => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "utils",
    "email-templates",
    `${templateName}.ejs`
  );
  return ejs.renderFile(templatePath, data)

};


//send an email using nodemailer
export const sendEmail = async(to:string, subject: string, templateName:string, data: Record<string, any>) => {
  try{
    const html = await renderEmailTemplate(templateName, data);

    await transporter.sendMail({
      from:`"RADON" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,

    });
    return true;
  } catch(error){
    console.log("Error sending email", error);
    return false;
  }
}
