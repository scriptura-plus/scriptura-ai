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

type RewriteMode = "polish" | "from_idea";

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

function isRewriteMode(value: unknown): value is RewriteMode {
  return value === "polish" || value === "from_idea";
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

function buildModeInstructions(mode: RewriteMode): string {
  if (mode === "from_idea") {
    return `
REWRITE MODE: BUILD FROM MODERATOR IDEA

The moderator's idea controls the new card.

Use the old card only as background/context.
You are allowed to change the main angle if the moderator's idea points to a stronger angle.
Do not force the moderator's idea back into the old card's weak structure.
Your job is to turn the moderator's idea into a strong Scriptura AI insight card.

Priority order:
1. Moderator instruction
2. Verse text
3. Concrete textual anchor
4. Discovery / “I never noticed that before” effect
5. Faithfulness and caution
6. Old card as optional context only

If the old card and moderator idea conflict, follow the moderator idea.
`.trim();
  }

  return `
REWRITE MODE: POLISH EXISTING ANGLE

Preserve the same main angle of the existing card.
Do not create a different angle unless the moderator explicitly demands it.
Your job is to make the existing angle stronger:
- clearer
- less generic
- more text-grounded
- more memorable
- more discovery-oriented
- safer and less overclaimed

If the current card is weak because it is too obvious, sharpen the same angle until it has a real discovery effect.
`.trim();
}

function buildRewritePrompt(args: {
  reference: string;
  verseText: string;
  lang: AngleCardLang;
  currentCard: StudioCardRow;
  instruction: string;
  extraMaterial: string | null;
  rewriteMode: RewriteMode;
}): string {
  const outputLanguage = languageName(args.lang);
  const modeInstructions = buildModeInstructions(args.rewriteMode);

  return `
You are a senior Scriptura AI editor.

Your task is to produce ONE rewritten insight card.

This is not a cosmetic rewrite.
Your rewritten card will be evaluated immediately by the Scriptura AI evaluator.
You must write the card so that it has the best possible chance to score highly, especially on DISCOVERY / WOW EFFECT.

Scriptura AI's editorial goal:
A strong card should make a serious Bible reader think:
“I never noticed that before — and now I can see it in the verse.”

Your rewritten card must aim for this chain:

concrete textual anchor → unexpected observation → meaning shift

Before returning the JSON, internally test your card:

1. Is it anchored in a concrete word, phrase, structure, contrast, scene, or context of THIS verse?
2. Would it feel like a real discovery to someone who already knows the Bible well?
3. Is it specific to this verse, or could it be moved to many other verses?
4. Does it avoid generic moralizing?
5. Does it avoid unsupported Greek/Hebrew claims?
6. Does it avoid overclaiming?
7. Does it explain why the observation matters?
8. Would it plausibly score 80+ under an evaluator that rewards discovery, specificity, textual grounding, faithfulness, and argument strength?

If the card would only be a correct paraphrase, do NOT return it yet.
Sharpen the angle until it has a clearer discovery effect.

Important:
- Do not invent facts.
- Do not add claims not supported by the verse, immediate context, or supplied material.
- Do not use vague phrases like “deeply important” unless you show why.
- Do not make the card long.
- Do not write a mini-article.
- The card must remain concise and suitable for a short insight card.

Output language: ${outputLanguage}
JSON keys must stay in English.
All user-visible string values must be in ${outputLanguage}.

${modeInstructions}

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
  "editor_note": "short explanation of what was improved and why this version has stronger discovery"
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
    const rewriteMode: RewriteMode = isRewriteMode(body?.rewrite_mode)
      ? body.rewrite_mode
      : "polish";

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
      rewriteMode,
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
      rewrite_mode: rewriteMode,
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
