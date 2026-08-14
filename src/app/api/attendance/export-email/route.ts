import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { employee_id, employee_email, employee_name, month_name, year, records, summary } = body;

    if (!employee_email) {
      return NextResponse.json({ error: "Employee email is required" }, { status: 400 });
    }

    const pmName = session.user?.name || "Project Management";
    const pmEmail = session.user?.email || "pm@unitglo.com";

    // Build formatted HTML table of the attendance records
    let tableRowsHtml = "";
    if (Array.isArray(records)) {
      tableRowsHtml = records
        .map(
          (r: any) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date(r.date).toLocaleDateString()}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${r.login_time || "--:--"}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${r.logout_time || "--:--"}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${r.total_hours || 0} hrs</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${r.status || "Present"}</td>
          </tr>`
        )
        .join("");
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #0099ff; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0;">Unitglo Solutions</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Official Attendance & Shift Report</p>
        </div>

        <p>Dear <strong>${employee_name || "Employee"}</strong>,</p>
        <p style="color: #334155; font-size: 14px;">
          Please find below your verified monthly attendance summary for <strong>${month_name} ${year}</strong>, compiled by Project Management (${pmName}).
        </p>

        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #cbd5e1;">
          <h4 style="margin: 0 0 8px 0; color: #0f172a;">Monthly Summary:</h4>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Total Days Logged:</strong> ${summary?.totalDays || records?.length || 0}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Total Working Hours:</strong> ${summary?.totalHours || 0} hrs</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Present Days:</strong> ${summary?.presentDays || 0}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Half Days:</strong> ${summary?.halfDays || 0}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Date</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Login (IST)</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Logout (IST)</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Hours</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 12px;">No records</td></tr>'}
          </tbody>
        </table>

        <p style="color: #64748b; font-size: 12px; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Sent by Project Management (<a href="mailto:${pmEmail}">${pmEmail}</a>) &bull; Unitglo Solutions System
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: employee_email,
      subject: `Official Attendance Timesheet - ${month_name} ${year} (${employee_name})`,
      html: emailHtml,
    });

    // Notify employee in dashboard notifications
    if (employee_id) {
      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
        [
          employee_id,
          `Monthly Attendance Report: ${month_name} ${year}`,
          `Your verified monthly attendance report for ${month_name} ${year} was dispatched to your email (${employee_email}) by ${pmName}.`
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Attendance report successfully sent to ${employee_email}!`,
      simulated: result.simulated,
    });
  } catch (error: any) {
    console.error("Export email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
