import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    db_host: process.env.DB_HOST || "NOT_SET",
    db_port: process.env.DB_PORT || "NOT_SET",
    db_user: process.env.DB_USER || "NOT_SET",
    // We will only show the first 3 characters of the password to verify it's the correct one without exposing the whole thing
    db_password_start: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 3) + "***" : "NOT_SET",
    db_name: process.env.DB_NAME || "NOT_SET",
  });
}
