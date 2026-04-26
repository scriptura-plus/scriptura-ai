import { NextResponse } from "next/server";
import { getStudioVerseSummaries } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_RECENT_VERSES] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getPositiveNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;

  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return fallback;

  return Math.floor(number);
}

export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const langParam = url.searchParams.get("lang");
    const lang: Lang = isLang(langParam) ? langParam : "ru";

    const days = getPositive
