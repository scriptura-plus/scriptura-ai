import { NextResponse } from "next/server";
import { saveAngleCard, type AngleCardInput } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[SAVE_ANGLE_CARD] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStatus(value: unknown): AngleCardInput["status"] {
  if (
    value === "featured" ||
    value === "reserve" ||
    value === "rewrite" ||
    value === "hidden" ||
    value === "rejected"
  ) {
    return value;
  }

  return "reserve";
}

function normalizeCoverageType(
  value: unknown,
): AngleCardInput["coverage_type"] {
  if (
    value === "lexical" ||
    value === "grammatical" ||
    value === "structural" ||
    value === "contextual" ||
    value === "translation" ||
    value === "rhetorical" ||
    value === "historical" ||
    value === "conceptual" ||
    value === "other"
  ) {
    return value;
  }

  return null;
}

function parseReferenceParts(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} {
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);

  if (!match) {
    return {
      book: reference,
      chapter: 0,
      verse: 0,
    };
  }

  return {
    book: match[1].trim(),
    chapter: Number(match[2]),
    verse: Number(match[3]),
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const reference = getString(body.reference);
    const lang = isLang(body.lang) ? body.lang : null;
    const card = isRecord(body.card) ? body.card : null;
    const evaluation = isRecord(body.evaluation) ? body.evaluation : null;

    if (!reference || !lang || !card || !evaluation) {
      return NextResponse.json(
        { error: "reference, lang, card, and evaluation are required" },
        { status: 400 },
      );
    }

    const title = getString(card.title);
    const teaser = getString(card.teaser);

    if (!title || !teaser) {
      return NextResponse.json(
        { error: "card.title and card.teaser are required" },
        { status: 400 },
      );
    }

    const referenceParts = parseReferenceParts(reference);

    const scoreTotal = getNumber(evaluation.score_total);
    const placement = getString(evaluation.placement);
    const status = normalizeStatus(
      placement === "featured_new" ? "featured" : placement,
    );

    const result = await saveAngleCard({
      reference,
      book: referenceParts.book,
      chapter: referenceParts.chapter,
      verse: referenceParts.verse,
      lang,

      title,
      anchor: getString(card.anchor),
      teaser,
      why_it_matters: getString(card.why_it_matters),

      angle_summary: getString(evaluation.angle_summary),
      coverage_type: normalizeCoverageType(evaluation.coverage_type),

      score_total: scoreTotal,
      scores: isRecord(evaluation.scores) ? evaluation.scores : null,
      evaluation,
      battle: isRecord(evaluation.battle) ? evaluation.battle : null,

      status,
      rank: status === "featured" ? 999 : null,
      is_locked: false,

      source_type: getString(body.source_type) ?? "manual_test",
      source_provider: getString(body.source_provider),
      source_model: getString(body.source_model),

      editor_provider: "openai",
      editor_model: "gpt-5.5",

      original_card: body.original_card ?? null,
      rewritten_from_card_id: null,
      replaced_card_id: null,

      prompt_version: "angle_cards_v1",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to save angle card" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Save angle card failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
