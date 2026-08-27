import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "documentId required" }, { status: 400 });
    }

    const [rows]: any = await pool.query(
      `SELECT da.user_id, u.name, u.email, u.role, da.granted_at, u_granter.name AS granted_by_name
       FROM document_access da
       JOIN users u ON da.user_id = u.id
       LEFT JOIN users u_granter ON da.granted_by = u_granter.id
       WHERE da.document_id = ?`,
      [documentId]
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Error getting document access:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: Admin, PM, or CEO role required" }, { status: 403 });
  }

  try {
    const granterId = (session.user as any).id;
    const granterName = session.user?.name || "Management";
    const granterRole = (session.user as any).role;

    const body = await req.json();
    const { documentId, userIds } = body;

    if (!documentId || !Array.isArray(userIds)) {
      return NextResponse.json({ error: "documentId and userIds array required" }, { status: 400 });
    }

    // Fetch document details for notification
    const [docRows]: any = await pool.query("SELECT title FROM documents WHERE id = ?", [documentId]);
    const docTitle = docRows[0]?.title || "Document";

    const connection: any = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Find previously granted users to detect who is newly added
      const [existingRows]: any = await connection.query(
        "SELECT user_id FROM document_access WHERE document_id = ?",
        [documentId]
      );
      const existingUserIds = existingRows.map((r: any) => r.user_id);
      const newUserIds = userIds.filter((id: number) => !existingUserIds.includes(id));

      // Remove existing access
      await connection.query("DELETE FROM document_access WHERE document_id = ?", [documentId]);

      // Re-insert new access list
      if (userIds.length > 0) {
        const values = userIds.map((uid: number) => [documentId, uid, granterId]);
        await connection.query(
          "INSERT INTO document_access (document_id, user_id, granted_by) VALUES ?",
          [values]
        );

        // Notify only newly added users
        for (const uid of newUserIds) {
          await connection.query(
            `INSERT INTO notifications (user_id, title, message, type) 
             VALUES (?, ?, ?, 'info')`,
            [
              uid,
              `📁 Document Access Granted: ${docTitle}`,
              `${granterName} (${granterRole}) granted you access to "${docTitle}" in the Document Vault.`,
            ]
          );
        }
      }

      await connection.commit();
      return NextResponse.json({ success: true, message: "Document permissions updated successfully" });
    } catch (err) {
      await connection.rollback().catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Error updating document access:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
