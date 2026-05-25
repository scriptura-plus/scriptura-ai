import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_SECRET is not configured" },
      { status: 500 },
    );
  }

  const provided = req.headers.get("x-admin-secret");

  if (provided !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
