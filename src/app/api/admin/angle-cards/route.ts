import { NextResponse } from "next/server";
import {
  getAngleCards,
  toPublicAngleCard,
  type AngleCardStatus,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isAngleCardStatus(value: string): value is AngleCardStatus {
  return (
    value === "featured" ||
    value === "reserve" ||
    value === "rewrite" ||
    value === "hidden" ||
    value === "rejected"
  );
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[ANGLE_CARDS_READ] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function parseStatuses(value: string | null): AngleCardStatus[] {
  if (!value) return ["featured", "reserve"];

  const statuses = value
    .split(",")
    .map((item) => item.trim())
    .filter(isAngleCardStatus);

  return statuses.length > 0 ? statuses : ["featured", "reserve"];
}

export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const reference = url.searchParams.get("reference")?.trim();
    const langParam = url.searchParams.get("lang");
    const statuses = parseStatuses(url.searchParams.get("statuses"));

    const limitRaw = Number(url.searchParams.get("limit") ?? 24);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(100, limitRaw))
      : 24;

    const lang = isLang(langParam) ? langParam : null;

    if (!reference || !lang) {
      return NextResponse.json(
        { error: "reference and lang are required" },
        { status: 400 },
      );
    }

    const result = await getAngleCards({
      reference,
      lang,
      statuses,
      limit,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to read angle cards" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      count: result.cards.length,
      cards: result.cards.map(toPublicAngleCard),
      raw_cards: result.cards,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Read angle cards failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
