import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFullDayHours, setFullDayHours } from "@/lib/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const fullDayHours = await getFullDayHours();
    return NextResponse.json({
      full_day_hours: fullDayHours,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const role = (session.user as any)?.role;
  if (!["Admin", "CEO", "PM"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized: Management role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { full_day_hours } = body;

    if (full_day_hours === undefined || full_day_hours === null) {
      return NextResponse.json({ error: "full_day_hours value is required" }, { status: 400 });
    }

    const numericHours = parseFloat(full_day_hours);
    if (isNaN(numericHours) || numericHours <= 0 || numericHours > 24) {
      return NextResponse.json({ error: "Working hours must be between 1 and 24 hours" }, { status: 400 });
    }

    await setFullDayHours(numericHours);

    return NextResponse.json({
      success: true,
      message: `Full day working hours updated to ${numericHours} hours successfully.`,
      full_day_hours: numericHours,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
