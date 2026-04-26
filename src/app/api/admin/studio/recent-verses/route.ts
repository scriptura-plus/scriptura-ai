import { NextResponse } from "next/server";
import {
  getStudioVerseSummaries,
  type StudioVerseSummary,
} from "@/lib/cache/angleCards";

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

function getPositiveInteger(
  value: string | null,
  fallback: number,
  max: number,
): number {
  if (!value) return fallback;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  const integer = Math.floor(parsed);

  if (integer <= 0) return fallback;

  return Math.min(integer, max);
}

function toPublicVerseSummary(verse: StudioVerseSummary) {
  return {
    reference: verse.reference,
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    lang: verse.lang,
    book_key: verse.book_key,
    total_count: verse.total_count,
    featured_count: verse.featured_count,
    reserve_count: verse.reserve_count,
    hidden_count: verse.hidden_count,
    rejected_count: verse.rejected_count,
    best_score: verse.best_score,
    sources: verse.sources,
    last_activity_at: verse.last_activity_at,
  };
}

export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const langParam = url.searchParams.get("lang");
    const lang: Lang = isLang(langParam) ? langParam : "ru";

    const days = getPositiveInteger(url.searchParams.get("days"), 7, 365);
    const limit = getPositiveInteger(url.searchParams.get("limit"), 50, 200);

    const result = await getStudioVerseSummaries({
      lang,
      days,
      limit,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to load recent verses" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      lang,
      days,
      limit,
      count: result.verses.length,
      verses: result.verses.map(toPublicVerseSummary),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load recent verses";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
