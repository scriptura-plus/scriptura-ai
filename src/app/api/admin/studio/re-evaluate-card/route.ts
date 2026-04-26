import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { buildEvaluateAnglePrompt } from "@/lib/prompts/buildEvaluateAnglePrompt";
import {
  getAllStudioCardsForVerse,
  type AngleCardRow,
  type AngleCardLang,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandidateCard = {
  id?: string;
  title: string;
  anchor?: string | null;
  teaser?: string | null;
  why_it_matters?: string | null;
  body?: string | null;
  score_total?: number | null;
  status?: string | null;
  is_locked?: boolean;
  angle_summary?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is AngleCardLang {
  return value === "ru" || value === "en" || value === "es";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_RE_EVALUATE] ADMIN_SECRET is not configured");
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

function isCandidateCard(value: unknown): value is CandidateCard {
  if (!isRecord(value)) return false;

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  return Boolean(title && teaser);
}

function toPromptCard(card: CandidateCard) {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor ?? undefined,
    teaser: card.teaser ?? undefined,
    why_it_matters: card.why_it_matters ?? undefined,
    body: card.body ?? undefined,
    score_total: card.score_total ?? undefined,
    status: card.status ?? undefined,
    is_locked: card.is_locked ?? undefined,
    angle_summary: card.angle_summary ?? undefined,
  };
}

function toEvaluatorCard(card: AngleCardRow) {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor ?? undefined,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? undefined,
    score_total: card.score_total ?? undefined,
    status: card.status,
    is_locked: card.is_locked,
    angle_summary: card.angle_summary ?? undefined,
  };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): unknown {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }

    throw new Error("Evaluator returned non-JSON response");
  }
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const reference = getString(body?.reference);
    const verseText = getString(body?.verseText) ?? "";
    const canonical_ref = getString(body?.canonical_ref);
    const lang = isLang(body?.lang) ? body.lang : null;
    const candidate = body?.candidate;
    const targetFeaturedCount = getNumber(body?.targetFeaturedCount) ?? 12;

    if (!reference || !lang || !isCandidateCard(candidate)) {
      return NextResponse.json(
        {
          error:
            "reference, lang, and candidate { title, teaser } are required",
        },
        { status: 400 },
      );
    }

    const existing = await getAllStudioCardsForVerse({
      reference,
      canonical_ref,
      lang,
      limit: 100,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { error: existing.error ?? "Failed to read existing cards" },
        { status: 500 },
      );
    }

    const otherCards = existing.cards.filter((card) => card.id !== candidate.id);

    const featuredCards = otherCards.filter(
      (card) => card.status === "featured",
    );
    const reserveCards = otherCards.filter((card) => card.status === "reserve");

    const prompt = buildEvaluateAnglePrompt({
      reference,
      verseText,
      lang,
      candidate: toPromptCard(candidate),
      featuredCards: featuredCards.map(toEvaluatorCard),
      reserveCards: reserveCards.map(toEvaluatorCard),
      sourceArticle: getString(body?.sourceArticle) ?? undefined,
      targetFeaturedCount,
    });

    const text = await runAI("openai", prompt, lang, true);
    const evaluation = extractJsonObject(text);

    return NextResponse.json({
      ok: true,
      mode: "preview_only",
      changed_database: false,
      reference,
      canonical_ref,
      lang,
      candidate_id: candidate.id ?? null,
      old_score: candidate.score_total ?? null,
      evaluation,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Re-evaluate card failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
