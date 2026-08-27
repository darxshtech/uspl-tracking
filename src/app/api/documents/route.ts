import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs/promises";

// Configure Cloudinary if environment variables are present
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function extractCloudinaryDetails(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("cloudinary.com")) return null;

    const parts = parsed.pathname.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    const resourceType = uploadIndex >= 2 ? parts[uploadIndex - 1] : "image";

    // Subpath after /upload/ (and optional version /v12345/)
    let afterUpload = parts.slice(uploadIndex + 1);
    if (afterUpload.length > 0 && /^v\d+$/.test(afterUpload[0])) {
      afterUpload = afterUpload.slice(1);
    }

    const fullPathWithExt = afterUpload.join("/");
    const publicIdWithoutExt = fullPathWithExt.replace(/\.[^/.]+$/, "");

    return {
      resourceType,
      publicId: publicIdWithoutExt,
      fullPathWithExt,
    };
  } catch (_) {
    return null;
  }
}

async function deleteAssetFile(fileUrl: string) {
  if (!fileUrl) return;

  // 1. If Cloudinary asset
  if (isCloudinaryConfigured && fileUrl.includes("cloudinary.com")) {
    const details = extractCloudinaryDetails(fileUrl);
    if (details) {
      try {
        // Attempt deletion with detected resource_type
        const res = await cloudinary.uploader.destroy(details.publicId, {
          resource_type: details.resourceType as any,
          invalidate: true,
        });

        // Fallback: try raw resource_type and full filename
        if (res?.result !== "ok") {
          await cloudinary.uploader.destroy(details.fullPathWithExt, {
            resource_type: "raw",
            invalidate: true,
          }).catch(() => {});
          await cloudinary.uploader.destroy(details.publicId, {
            resource_type: "raw",
            invalidate: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Error destroying asset in Cloudinary:", err);
      }
    }
  }

  // 2. If locally stored in /public/uploads
  if (fileUrl.startsWith("/uploads/")) {
    try {
      const localPath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
      await fs.unlink(localPath).catch(() => {});
    } catch (_) {}
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const role = (session.user as any)?.role;
    const userId = (session.user as any)?.id;
    const isManager = ["Admin", "CEO", "PM"].includes(role);

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");

    let query = `
      SELECT d.*, 
        u.name AS creator_name, 
        u.role AS creator_role,
        p.name AS project_name
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Access control for Developer & Tester
    if (!isManager) {
      query += `
        AND (
          d.is_public_all = 1
          OR d.id IN (SELECT document_id FROM document_access WHERE user_id = ?)
          OR d.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        )
      `;
      params.push(userId, userId);
    }

    // Category filter
    if (category && category !== "All") {
      query += " AND d.category = ?";
      params.push(category);
    }

    // Project filter
    if (projectId) {
      if (projectId === "standalone") {
        query += " AND d.project_id IS NULL";
      } else if (!isNaN(parseInt(projectId, 10))) {
        query += " AND d.project_id = ?";
        params.push(parseInt(projectId, 10));
      }
    }

    // Search filter
    if (search) {
      query += " AND (d.title LIKE ? OR d.description LIKE ? OR d.file_name LIKE ? OR p.name LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += " ORDER BY d.created_at DESC";

    const [rows]: any = await pool.query(query, params);

    // Fetch access lists for these documents
    const docIds = rows.map((r: any) => r.id);
    let accessMap: Record<number, any[]> = {};

    if (docIds.length > 0) {
      const [accessRows]: any = await pool.query(
        `SELECT da.document_id, da.user_id, u.name, u.role, u.email
         FROM document_access da
         JOIN users u ON da.user_id = u.id
         WHERE da.document_id IN (?)`,
        [docIds]
      );
      accessRows.forEach((a: any) => {
        if (!accessMap[a.document_id]) accessMap[a.document_id] = [];
        accessMap[a.document_id].push({
          id: a.user_id,
          name: a.name,
          role: a.role,
          email: a.email,
        });
      });
    }

    const formatted = rows.map((r: any) => ({
      ...r,
      is_public_all: Boolean(r.is_public_all),
      granted_users: accessMap[r.id] || [],
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: Admin, CEO, or PM role required" }, { status: 403 });
  }

  try {
    const creatorId = (session.user as any).id;
    const creatorName = session.user?.name || "Management";
    const creatorRole = (session.user as any).role;

    const body = await req.json();
    const {
      title,
      description,
      category,
      file_url,
      file_name,
      file_type,
      file_size,
      project_id,
      is_public_all,
      granted_users,
    } = body;

    if (!title || !file_url || !file_name) {
      return NextResponse.json({ error: "Title, file URL, and file name are required" }, { status: 400 });
    }

    const connection: any = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result]: any = await connection.query(
        `INSERT INTO documents 
          (title, description, category, file_url, file_name, file_type, file_size, project_id, is_public_all, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          category || "Project Document",
          file_url,
          file_name,
          file_type || "pdf",
          file_size || 0,
          project_id ? parseInt(project_id, 10) : null,
          is_public_all ? 1 : 0,
          creatorId,
        ]
      );

      const documentId = result.insertId;

      // Grant access to specific users if provided
      if (granted_users && Array.isArray(granted_users) && granted_users.length > 0) {
        const accessValues = granted_users.map((uid: any) => [documentId, parseInt(uid, 10), creatorId]);
        await connection.query(
          "INSERT IGNORE INTO document_access (document_id, user_id, granted_by) VALUES ?",
          [accessValues]
        );

        // Notify granted users
        for (const uid of granted_users) {
          await connection.query(
            `INSERT INTO notifications (user_id, title, message, type) 
             VALUES (?, ?, ?, 'info')`,
            [
              uid,
              `📁 New Document Shared: ${title}`,
              `${creatorName} (${creatorRole}) granted you access to document "${title}" in the Document Vault.`,
            ]
          );
        }
      }

      await connection.commit();
      return NextResponse.json({
        id: documentId,
        title,
        message: "Document stored successfully",
      }, { status: 201 });
    } catch (err) {
      await connection.rollback().catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Error creating document:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, title, description, category, project_id, is_public_all, file_url, file_name, file_type, file_size } = body;

    if (!id || !title) {
      return NextResponse.json({ error: "Document ID and title are required" }, { status: 400 });
    }

    await pool.query(
      `UPDATE documents 
       SET title = ?, 
           description = ?, 
           category = ?, 
           project_id = ?, 
           is_public_all = ?,
           file_url = IFNULL(?, file_url),
           file_name = IFNULL(?, file_name),
           file_type = IFNULL(?, file_type),
           file_size = IFNULL(?, file_size)
       WHERE id = ?`,
      [
        title,
        description || null,
        category || "Project Document",
        project_id ? parseInt(project_id, 10) : null,
        is_public_all ? 1 : 0,
        file_url || null,
        file_name || null,
        file_type || null,
        file_size || null,
        id,
      ]
    );

    return NextResponse.json({ success: true, message: "Document updated successfully" });
  } catch (error: any) {
    console.error("Error updating document:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // 1. Fetch file_url before deleting record
    const [docRows]: any = await pool.query("SELECT file_url FROM documents WHERE id = ?", [id]);
    if (docRows.length > 0 && docRows[0].file_url) {
      await deleteAssetFile(docRows[0].file_url);
    }

    // 2. Delete database record
    await pool.query("DELETE FROM documents WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Document removed from vault and cloud storage" });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
