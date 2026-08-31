import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import pool from "@/lib/db";
import DashboardClientShell from "@/components/DashboardClientShell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userId = (session.user as any).id;
  let user = {
    name: session.user.name || "Employee",
    email: session.user.email || "",
    role: (session.user as any).role || "Developer",
    avatar_url: (session.user as any).avatar_url || null,
  };

  try {
    const [rows]: any = await pool.query(
      "SELECT id, name, email, role, avatar_url, is_active FROM users WHERE id = ?",
      [userId]
    );
    if (rows && rows.length > 0) {
      if (rows[0].is_active === 0 || rows[0].is_active === false) {
        redirect("/login?error=AccountDeactivated");
      }
      user = {
        name: rows[0].name || user.name,
        email: rows[0].email || user.email,
        role: rows[0].role || user.role,
        avatar_url: rows[0].avatar_url || null,
      };
    } else {
      redirect("/login");
    }
  } catch (err: any) {
    if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    // If column missing, try basic query
    try {
      const [rows]: any = await pool.query(
        "SELECT id, name, email, role, is_active FROM users WHERE id = ?",
        [userId]
      );
      if (rows && rows.length > 0) {
        if (rows[0].is_active === 0 || rows[0].is_active === false) {
          redirect("/login?error=AccountDeactivated");
        }
        user = {
          ...user,
          name: rows[0].name || user.name,
          role: rows[0].role || user.role,
        };
      } else {
        redirect("/login");
      }
    } catch (err2: any) {
      if (err2?.message === "NEXT_REDIRECT" || err2?.digest?.startsWith("NEXT_REDIRECT")) {
        throw err2;
      }
    }
  }

  return (
    <DashboardClientShell user={user}>
      {children}
    </DashboardClientShell>
  );
}

