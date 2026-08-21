import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllPolicies, updatePolicies } from "@/lib/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const policies = await getAllPolicies();
    return NextResponse.json(policies);
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
    const updatedPolicies = await updatePolicies(body);
    return NextResponse.json({
      success: true,
      message: "Company attendance & leave policies updated successfully.",
      policies: updatedPolicies,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
