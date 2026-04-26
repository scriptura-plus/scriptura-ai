import { NextResponse } from "next/server";
import {
  getAllStudioCardsForVerse,
  type AngleCardRow,
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
    console.error("[STUDIO_CARDS] ADMIN_SECRET is not configured");
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

function toPublicCard(card: AngleCardRow) {
  return {
    id: card.id,

    reference: card.reference,
    book: card.book,
    chapter: card.chapter,
    verse: card.verse,
    lang: card.lang,

    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,

    angle_summary: card.angle_summary,
    coverage_type: card.coverage_type,

    score_total: card.score_total,
    scores: card.scores,
    evaluation: card.evaluation,
    battle: card.battle,

    status: card.status,
    rank: card.rank,
    is_locked: card.is_locked,

    source_type: card.source_type,
    source_provider: card.source_provider,
    source_model: card.source_model,

    editor_provider: card.editor_provider,
    editor_model: card.editor_model,

    prompt_version: card.prompt_version,

    created_at: card.created_at,
    updated_at: card.updated_at,
  };
}

function summarizeCards(cards: AngleCardRow[]) {
  const sources = new Set<string>();
  let bestScore: number | null = null;

  const counts = {
    total: cards.length,
    featured: 0,
    reserve: 0,
    rewrite: 0,
    hidden: 0,
    rejected: 0,
  };

  for (const card of cards) {
    if (card.status === "featured") counts.featured += 1;
    if (card.status === "reserve") counts.reserve += 1;
    if (card.status === "rewrite") counts.rewrite += 1;
    if (card.status === "hidden") counts.hidden += 1;
    if (card.status === "rejected") counts.rejected += 1;

    if (
      typeof card.score_total === "number" &&
      (bestScore === null || card.score_total > bestScore)
    ) {
      bestScore = card.score_total;
    }

    const source =
      card.source_model?.replace("article_extractor_v1:", "") ||
      card.source_type ||
      "unknown";

    if (source) sources.add(source);
  }

  return {
    ...counts,
    best_score: bestScore,
    sources: Array.from(sources),
  };
}

export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const reference = url.searchParams.get("reference")?.trim() ?? "";
    const langParam = url.searchParams.get("lang");
    const lang: Lang = isLang(langParam) ? langParam : "ru";
    const limit = getPositiveInteger(url.searchParams.get("limit"), 100, 300);

    if (!reference) {
      return NextResponse.json(
        { error: "reference is required" },
        { status: 400 },
      );
    }

    const result = await getAllStudioCardsForVerse({
      reference,
      lang,
      limit,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to load cards" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      reference,
      lang,
      summary: summarizeCards(result.cards),
      count: result.cards.length,
      cards: result.cards.map(toPublicCard),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load cards";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
