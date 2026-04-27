import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import { createAdminClient } from "@/lib/supabase/server";
import { getVerseText } from "@/lib/bible/getVerseText";
import { buildEvaluateAnglePrompt } from "@/lib/prompts/buildEvaluateAnglePrompt";
import {
  getAllStudioCardsForVerse,
  type AngleCardLang,
  type AngleCardRow,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StudioCardRow = {
  id: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: AngleCardLang;

  canonical_ref: string | null;
  book_key: string | null;
  translation_group_id: string | null;
  origin_lang: AngleCardLang | null;

  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;

  angle_summary: string | null;
  coverage_type: string | null;

  score_total: number | null;
  status: string;
  is_locked: boolean;

  source_type: string | null;
  source_provider: string | null;
  source_model: string | null;

  created_at: string;
  updated_at: string;
};

type RewrittenCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_REWRITE_CARD] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isLang(value: unknown): value is AngleCardLang {
  return value === "ru" || value === "en" || value === "es";
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

    throw new Error("AI returned non-JSON response");
  }
}

function languageName(lang: AngleCardLang): string {
  if (lang === "ru") return "Russian";
  if (lang === "es") return "Spanish";
  return "English";
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

function toPromptCandidate(card: RewrittenCard, id: string) {
  return {
    id,
    title: card.title,
    anchor: card.anchor ?? undefined,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? undefined,
  };
}

function normalizeRewrittenCard(value: unknown): RewrittenCard {
  if (!isRecord(value)) {
    throw new Error("Rewrite response is not an object");
  }

  const cardValue = isRecord(value.card) ? value.card : value;

  const title = getString(cardValue.title);
  const teaser = getString(cardValue.teaser);

  if (!title || !teaser) {
    throw new Error("Rewrite response must include card.title and card.teaser");
  }

  return {
    title,
    anchor: getString(cardValue.anchor),
    teaser,
    why_it_matters: getString(cardValue.why_it_matters),
  };
}

function buildRewritePrompt(args: {
  reference: string;
  verseText: string;
  lang: AngleCardLang;
  currentCard: StudioCardRow;
  instruction: string;
  extraMaterial: string | null;
}): string {
  const outputLanguage = languageName(args.lang);

  return `
You are a senior Scriptura AI editor.

Your task is to rewrite ONE existing insight card according to the moderator instruction.

This is not a new angle search.
Preserve the same main angle unless the moderator explicitly asks to sharpen it.
Do not invent new facts.
Do not add unsupported Greek/Hebrew claims.
Do not make the card longer than necessary.
Make the card stronger according to Scriptura AI standards:
- concrete textual anchor
- clear discovery / “I did not notice that before” effect
- specific to this verse
- faithful to the verse
- not generic devotional wording
- intellectually memorable but not overclaimed

Output language: ${outputLanguage}
JSON keys must stay in English.
All user-visible string values must be in ${outputLanguage}.

VERSE:
Reference: ${args.reference}

Verse text:
${args.verseText}

CURRENT CARD:
${JSON.stringify(
  {
    id: args.currentCard.id,
    title: args.currentCard.title,
    anchor: args.currentCard.anchor,
    teaser: args.currentCard.teaser,
    why_it_matters: args.currentCard.why_it_matters,
    angle_summary: args.currentCard.angle_summary,
    coverage_type: args.currentCard.coverage_type,
    score_total: args.currentCard.score_total,
    status: args.currentCard.status,
  },
  null,
  2,
)}

MODERATOR INSTRUCTION:
${args.instruction}

EXTRA MATERIAL, IF ANY:
${args.extraMaterial ?? "None provided."}

Return ONLY valid JSON.
No markdown.
No code fences.
No explanation before or after JSON.

JSON shape:
{
  "card": {
    "title": "string",
    "anchor": "string or null",
    "teaser": "string",
    "why_it_matters": "string or null"
  },
  "editor_note": "short explanation of what was improved"
}
`.trim();
}

async function resolveVerseText(args: {
  reference: string;
  lang: AngleCardLang;
  bodyVerseText: unknown;
  provider: unknown;
}): Promise<{
  text: string;
  source: "request" | "getVerseText";
}> {
  const provided = getString(args.bodyVerseText);

  if (provided) {
    return {
      text: provided,
      source: "request",
    };
  }

  const verseProvider = isProvider(args.provider)
    ? args.provider
    : isProvider("openai")
      ? "openai"
      : defaultProvider();

  const verse = await getVerseText(args.reference, args.lang, verseProvider);

  return {
    text: verse.text,
    source: "getVerseText",
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const cardId = getString(body?.card_id);
    const instruction = getString(body?.instruction);
    const lang = isLang(body?.lang) ? body.lang : null;
    const extraMaterial = getString(body?.extra_material);
    const targetFeaturedCount = 12;

    if (!cardId || !instruction || !lang) {
      return NextResponse.json(
        {
          error: "card_id, instruction, and lang are required",
        },
        { status: 400 },
      );
    }

    const client = createAdminClient();

    if (!client) {
      return NextResponse.json(
        { error: "Supabase admin client unavailable" },
        { status: 500 },
      );
    }

    const { data: cardData, error: cardError } = await client
      .from("angle_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError || !cardData) {
      return NextResponse.json(
        { error: cardError?.message ?? "Card not found" },
        { status: 404 },
      );
    }

    const currentCard = cardData as StudioCardRow;

    if (currentCard.lang !== lang) {
      return NextResponse.json(
        {
          error: `Card lang is ${currentCard.lang}, but request lang is ${lang}`,
        },
        { status: 400 },
      );
    }

    const resolvedVerse = await resolveVerseText({
      reference: currentCard.reference,
      lang,
      bodyVerseText: body?.verseText,
      provider: body?.provider,
    });

    const rewritePrompt = buildRewritePrompt({
      reference: currentCard.reference,
      verseText: resolvedVerse.text,
      lang,
      currentCard,
      instruction,
      extraMaterial,
    });

    const rewriteText = await runAI("openai", rewritePrompt, lang, true);
    const rewriteParsed = extractJsonObject(rewriteText);
    const rewrittenCard = normalizeRewrittenCard(rewriteParsed);

    const existing = await getAllStudioCardsForVerse({
      reference: currentCard.reference,
      canonical_ref: currentCard.canonical_ref,
      lang,
      limit: 100,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { error: existing.error ?? "Failed to read existing cards" },
        { status: 500 },
      );
    }

    const otherCards = existing.cards.filter((card) => card.id !== currentCard.id);

    const featuredCards = otherCards.filter(
      (card) => card.status === "featured",
    );
    const reserveCards = otherCards.filter((card) => card.status === "reserve");

    const evaluationPrompt = buildEvaluateAnglePrompt({
      reference: currentCard.reference,
      verseText: resolvedVerse.text,
      lang,
      candidate: toPromptCandidate(rewrittenCard, `rewritten:${currentCard.id}`),
      featuredCards: featuredCards.map(toEvaluatorCard),
      reserveCards: reserveCards.map(toEvaluatorCard),
      sourceArticle: extraMaterial ?? undefined,
      targetFeaturedCount,
    });

    const evaluationText = await runAI("openai", evaluationPrompt, lang, true);
    const evaluation = extractJsonObject(evaluationText);

    return NextResponse.json({
      ok: true,
      mode: "preview_only",
      changed_database: false,
      card_id: currentCard.id,
      reference: currentCard.reference,
      canonical_ref: currentCard.canonical_ref,
      lang,
      verse_text_source: resolvedVerse.source,
      verse_text_preview: resolvedVerse.text.slice(0, 220),
      instruction,
      original_card: {
        title: currentCard.title,
        anchor: currentCard.anchor,
        teaser: currentCard.teaser,
        why_it_matters: currentCard.why_it_matters,
        score_total: currentCard.score_total,
        status: currentCard.status,
      },
      rewritten_card: rewrittenCard,
      evaluation,
      raw_rewrite: rewriteParsed,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Rewrite card failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
