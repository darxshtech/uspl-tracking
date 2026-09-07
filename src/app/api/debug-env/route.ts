import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let db_status = "unknown";
  let latency_ms = 0;
  let db_error = null;

  try {
    const [rows]: any = await pool.query("SELECT 1 as connected, NOW() as server_time");
    db_status = "connected";
    latency_ms = Date.now() - start;
  } catch (err: any) {
    db_status = "error";
    db_error = err?.message || String(err);
    latency_ms = Date.now() - start;
  }

  return NextResponse.json({
    db_status,
    latency_ms,
    db_error,
    db_host: process.env.DB_HOST || "NOT_SET",
    db_port: process.env.DB_PORT || "NOT_SET",
    db_user: process.env.DB_USER || "NOT_SET",
    db_password_start: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 3) + "***" : "NOT_SET",
    db_name: process.env.DB_NAME || "NOT_SET",
  });
}
