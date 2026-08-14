import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
  }>;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; simulated?: boolean }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || '"Unitglo PM Office" <pm@unitglo.com>';

  // If real SMTP credentials are provided, send via SMTP
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });

      console.log(`[Mailer] Email sent successfully to ${options.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error("[Mailer] SMTP delivery failed:", err.message);
      return { success: false, simulated: true };
    }
  }

  // Simulated email dispatch (logs clean delivery preview when SMTP credentials aren't configured yet)
  console.log("==================== [SIMULATED EMAIL DISPATCH] ====================");
  console.log(`From: ${fromEmail}`);
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  if (options.attachments?.length) {
    console.log(`Attachments: ${options.attachments.map((a) => a.filename).join(", ")}`);
  }
  console.log("===================================================================");

  return { success: true, simulated: true };
}
