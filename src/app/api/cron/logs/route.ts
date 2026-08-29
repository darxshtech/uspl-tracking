import { NextResponse } from "next/server";
import { getRecentCronLogs } from "@/lib/cronLogger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

  try {
    const logs = await getRecentCronLogs(limit);
    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error("[Get Cron Logs Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
