import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function ensureLettersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_letters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        letter_type ENUM('Joining Letter', 'Experience Letter', 'Internship Completion') NOT NULL,
        title VARCHAR(255) NOT NULL,
        reference_no VARCHAR(100) NOT NULL,
        issue_date DATE NOT NULL,
        metadata_json JSON NOT NULL,
        custom_remarks TEXT NULL,
        status ENUM('Issued', 'Draft', 'Revoked') NOT NULL DEFAULT 'Issued',
        issued_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_letter_type (letter_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err) {
    console.error("Error ensuring employee_letters table:", err);
  }
}

// GET /api/letters - Fetch issued letters
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureLettersTable();

  try {
    const currentUserId = parseInt(String((session.user as any).id), 10);
    const currentRole = (session.user as any).role;
    const isManagement = ["Admin", "CEO", "PM"].includes(currentRole);

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("user_id");
    const filterType = searchParams.get("type");

    let query = `
      SELECT 
        el.id,
        el.user_id,
        el.letter_type,
        el.title,
        el.reference_no,
        DATE_FORMAT(el.issue_date, '%Y-%m-%d') as issue_date,
        el.metadata_json,
        el.custom_remarks,
        el.status,
        el.issued_by,
        el.created_at,
        u.name as employee_name,
        u.email as employee_email,
        u.role as employee_role,
        u.monthly_salary as employee_salary,
        DATE_FORMAT(u.joining_date, '%Y-%m-%d') as employee_joining_date,
        issuer.name as issuer_name,
        issuer.role as issuer_role
      FROM employee_letters el
      JOIN users u ON el.user_id = u.id
      JOIN users issuer ON el.issued_by = issuer.id
      WHERE el.status != 'Revoked'
    `;

    const params: any[] = [];

    if (!isManagement) {
      // Regular employees can ONLY access letters that have been officially sent to them ('Issued')
      query += ` AND el.user_id = ? AND el.status = 'Issued'`;
      params.push(currentUserId);
    } else {
      if (filterUserId && filterUserId !== "ALL") {
        query += ` AND el.user_id = ?`;
        params.push(parseInt(filterUserId, 10));
      }
    }

    if (filterType && filterType !== "ALL") {
      query += ` AND el.letter_type = ?`;
      params.push(filterType);
    }

    query += ` ORDER BY el.id DESC`;

    const [rows]: any = await pool.query(query, params);

    // Parse metadata_json if string
    const formatted = (rows || []).map((r: any) => {
      let meta = r.metadata_json;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch {
          meta = {};
        }
      }
      return {
        ...r,
        metadata: meta,
      };
    });

    return NextResponse.json({ success: true, letters: formatted });
  } catch (error: any) {
    console.error("Error fetching letters:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch letters" }, { status: 500 });
  }
}

// POST /api/letters - Generate and issue a new letter (PM, Admin, CEO)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = parseInt(String((session.user as any).id), 10);
  const currentRole = (session.user as any).role;
  const isManagement = ["Admin", "CEO", "PM"].includes(currentRole);

  if (!isManagement) {
    return NextResponse.json({ error: "Forbidden: Only PM, CEO, and Admin can issue letters." }, { status: 403 });
  }

  await ensureLettersTable();

  try {
    const body = await req.json();
    const { 
      user_id, 
      letter_type, 
      title, 
      issue_date, 
      metadata = {}, 
      custom_remarks,
      send_to_employee = true
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Target employee is required." }, { status: 400 });
    }
    if (!["Joining Letter", "Experience Letter", "Internship Completion"].includes(letter_type)) {
      return NextResponse.json({ error: "Invalid letter type." }, { status: 400 });
    }

    // Verify target employee exists
    const [empRows]: any = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [user_id]);
    if (!empRows || empRows.length === 0) {
      return NextResponse.json({ error: "Target employee not found." }, { status: 404 });
    }
    const emp = empRows[0];

    const todayIST = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
    const finalIssueDate = issue_date || todayIST;
    const year = finalIssueDate.split("-")[0] || "2026";

    // Auto-generate reference number
    const [countRow]: any = await pool.query("SELECT COUNT(*) as total FROM employee_letters");
    const count = (countRow[0]?.total || 0) + 1;
    const refPad = String(count).padStart(3, "0");
    const refPrefix = letter_type === "Joining Letter" ? "APPT" : letter_type === "Experience Letter" ? "EXP" : "INT";
    const reference_no = `USPL/${refPrefix}/${year}/${refPad}`;

    const finalTitle = title || `${letter_type} - ${emp.name}`;
    const finalStatus = send_to_employee ? "Issued" : "Draft";
    metadata.is_sent_to_employee = Boolean(send_to_employee);

    const metadataJson = JSON.stringify(metadata);

    const [result]: any = await pool.query(
      `INSERT INTO employee_letters (
        user_id, 
        letter_type, 
        title, 
        reference_no, 
        issue_date, 
        metadata_json, 
        custom_remarks, 
        status, 
        issued_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        letter_type,
        finalTitle,
        reference_no,
        finalIssueDate,
        metadataJson,
        custom_remarks || null,
        finalStatus,
        currentUserId
      ]
    );

    const letterId = result.insertId;

    // If sent to employee, notify them immediately
    if (send_to_employee) {
      try {
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
          [
            user_id,
            `📜 Official Letter Issued: ${letter_type}`,
            `Your official ${letter_type} (${reference_no}) has been issued by ${session.user.name || "Management"}. You can view and download it from the Letters & Certificates portal.`
          ]
        );
      } catch (notifErr) {
        console.error("Failed to create notification for issued letter:", notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: send_to_employee 
        ? `${letter_type} issued and sent to employee's login successfully!` 
        : `${letter_type} saved as management draft.`,
      letter: {
        id: letterId,
        user_id,
        employee_name: emp.name,
        letter_type,
        title: finalTitle,
        reference_no,
        issue_date: finalIssueDate,
        status: finalStatus,
        metadata,
      },
    });
  } catch (error: any) {
    console.error("Error creating letter:", error);
    return NextResponse.json({ error: error.message || "Failed to create letter" }, { status: 500 });
  }
}

// PATCH /api/letters - Send draft letter to employee or update letter status (PM, Admin, CEO)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentRole = (session.user as any).role;
  const isManagement = ["Admin", "CEO", "PM"].includes(currentRole);

  if (!isManagement) {
    return NextResponse.json({ error: "Forbidden: Only PM, CEO, and Admin can update letters." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "Letter ID is required." }, { status: 400 });
    }

    const [rows]: any = await pool.query(
      "SELECT el.*, u.name as employee_name FROM employee_letters el JOIN users u ON el.user_id = u.id WHERE el.id = ?",
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Letter not found." }, { status: 404 });
    }

    const letter = rows[0];

    if (action === "send_to_employee") {
      let meta = letter.metadata_json;
      if (typeof meta === "string") {
        try { meta = JSON.parse(meta); } catch { meta = {}; }
      }
      meta.is_sent_to_employee = true;

      await pool.query(
        "UPDATE employee_letters SET status = 'Issued', metadata_json = ? WHERE id = ?",
        [JSON.stringify(meta), id]
      );

      // Send notification to employee
      try {
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
          [
            letter.user_id,
            `📜 Official Letter Delivered: ${letter.letter_type}`,
            `Your official ${letter.letter_type} (${letter.reference_no}) is now available in your personal Letters & Certificates vault.`
          ]
        );
      } catch (notifErr) {
        console.error("Failed to notify employee:", notifErr);
      }

      return NextResponse.json({
        success: true,
        message: `Letter ${letter.reference_no} sent to ${letter.employee_name}'s login successfully!`,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating letter:", error);
    return NextResponse.json({ error: error.message || "Failed to update letter" }, { status: 500 });
  }
}

// DELETE /api/letters?id=X - Revoke / Delete a letter (PM, Admin, CEO)
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentRole = (session.user as any).role;
  const isManagement = ["Admin", "CEO", "PM"].includes(currentRole);

  if (!isManagement) {
    return NextResponse.json({ error: "Forbidden: Only PM, CEO, and Admin can revoke letters." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Letter ID is required" }, { status: 400 });
    }

    await pool.query("DELETE FROM employee_letters WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Letter deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting letter:", error);
    return NextResponse.json({ error: error.message || "Failed to delete letter" }, { status: 500 });
  }
}
