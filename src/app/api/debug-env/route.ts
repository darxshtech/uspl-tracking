import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    db_host: process.env.DB_HOST || "NOT_SET",
    db_port: process.env.DB_PORT || "NOT_SET",
    db_user: process.env.DB_USER ? "SET (hidden)" : "NOT_SET",
    db_password: process.env.DB_PASSWORD ? "SET (hidden)" : "NOT_SET",
    db_name: process.env.DB_NAME || "NOT_SET",
    nextauth_url: process.env.NEXTAUTH_URL || "NOT_SET",
    nextauth_secret: process.env.NEXTAUTH_SECRET ? "SET (hidden)" : "NOT_SET",
    node_env: process.env.NODE_ENV || "NOT_SET",
  });
}
