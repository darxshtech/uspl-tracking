import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";

// Trigger this endpoint weekly (e.g. Sunday) via ?type=weekly or monthly (e.g. 1st of month) via ?type=monthly
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "weekly"; // weekly or monthly

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'secret'}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [users]: any = await pool.query("SELECT id, name, email, role, leaves_carried_forward, total_leaves_allowed FROM users WHERE role NOT IN ('CEO', 'Admin')");
    
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);
    
    if (type === "monthly") {
      // Last month
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
    } else {
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [attendance]: any = await pool.query(
      "SELECT * FROM attendance WHERE date >= ? AND date <= ?",
      [startStr, endStr]
    );

    let emailsSent = 0;

    for (const user of users) {
      if (!user.email) continue;
      
      const userRecords = attendance.filter((a: any) => a.user_id === user.id);
      
      let presents = 0;
      let halfDays = 0;
      let absences = 0;
      let leaves = 0;
      let holidays = 0;

      let tableRows = "";
      
      userRecords.forEach((rec: any) => {
        let badgeColor = "#94a3b8"; // slate
        if (rec.status === 'Present') { presents++; badgeColor = "#10b981"; } // emerald
        else if (rec.status === 'Half Day') { halfDays++; badgeColor = "#f59e0b"; } // amber
        else if (rec.status === 'Absent') { absences++; badgeColor = "#ef4444"; } // red
        else if (rec.status === 'Holiday') { holidays++; badgeColor = "#3b82f6"; } // blue
        else if (rec.status?.includes('Leave')) { leaves++; badgeColor = "#8b5cf6"; } // violet

        tableRows += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-size: 14px;">${new Date(rec.date).toLocaleDateString()}</td>
            <td style="padding: 10px; font-size: 14px;">${rec.login_time || '-'}</td>
            <td style="padding: 10px; font-size: 14px;">${rec.logout_time || '-'}</td>
            <td style="padding: 10px; font-size: 14px;">${rec.total_hours || '0.00'} hrs</td>
            <td style="padding: 10px; font-size: 14px;"><span style="color: ${badgeColor}; font-weight: bold;">${rec.status}</span></td>
          </tr>
        `;
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
            ${type === "monthly" ? "Monthly" : "Weekly"} Attendance Summary
          </h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Here is your attendance summary for the period of <strong>${startDate.toLocaleDateString()}</strong> to <strong>${endDate.toLocaleDateString()}</strong>.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Summary Dashboard</h3>
            <ul style="list-style-type: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <li>✅ Presents: <strong>${presents}</strong></li>
              <li>⚠️ Half Days: <strong>${halfDays}</strong></li>
              <li>🏖️ Paid Leaves: <strong>${leaves}</strong></li>
              <li>❌ Absences: <strong>${absences}</strong></li>
              <li>🎉 Holidays: <strong>${holidays}</strong></li>
            </ul>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left;">
            <thead>
              <tr style="background-color: #f1f5f9; text-transform: uppercase; font-size: 12px; color: #64748b;">
                <th style="padding: 10px;">Date</th>
                <th style="padding: 10px;">Check In</th>
                <th style="padding: 10px;">Check Out</th>
                <th style="padding: 10px;">Hours</th>
                <th style="padding: 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5" style="padding: 10px; text-align: center;">No records found for this period.</td></tr>'}
            </tbody>
          </table>
          
          <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
            This is an automated message from the Unitglo PM Office. Please contact your PM for any discrepancies.
          </p>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: `[Unitglo] Your ${type === "monthly" ? "Monthly" : "Weekly"} Attendance Report`,
        html: htmlContent
      });
      emailsSent++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully sent ${emailsSent} ${type} attendance emails.` 
    });
  } catch (error: any) {
    console.error("Attendance Cron Email Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
