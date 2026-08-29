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

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = parseInt(process.env.SMTP_PORT?.trim() || "587", 10);
  const smtpUser = process.env.SMTP_USER?.trim();
  // Strip quotes and whitespace from SMTP password (common with Gmail 16-char app passwords)
  const smtpPass = process.env.SMTP_PASS?.replace(/["']/g, "").trim();

  // If using Gmail, from address should match or alias the authenticated user to avoid SPF / domain rejection
  let fromEmail = process.env.SMTP_FROM?.trim();
  if (!fromEmail) {
    fromEmail = smtpUser ? `"Unitglo PM Office" <${smtpUser}>` : '"Unitglo PM Office" <pm@unitglo.com>';
  }

  // If real SMTP credentials are provided, send via SMTP
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const isGmail = smtpHost.toLowerCase().includes("gmail");

      const transportConfig: any = isGmail
        ? {
            service: "gmail",
            auth: {
              user: smtpUser,
              pass: smtpPass.replace(/\s+/g, ""), // Gmail app passwords work without spaces
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            tls: {
              rejectUnauthorized: false, // Prevents failure with self-signed or cPanel certs
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          };

      const transporter = nodemailer.createTransport(transportConfig);

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
      return { success: false, error: err.message, simulated: false };
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
