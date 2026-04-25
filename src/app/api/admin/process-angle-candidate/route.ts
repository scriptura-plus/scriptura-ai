import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import { buildEvaluateAnglePrompt } from "@/lib/prompts/buildEvaluateAnglePrompt";
import { buildRewriteAnglePrompt } from "@/lib/prompts/buildRewriteAnglePrompt";
import {
  getAngleCards,
  saveAngleCard,
  type AngleCardInput,
  type AngleCardRow,
} from "@/lib/cache/angleCards";
import type { RewriteAngleEvaluation } from "@/lib/prompts/buildRewriteAnglePrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type CandidateCard = {
  id?: string;
  title: string;
  anchor?: string | null;
  teaser?: string | null;
  why_it_matters?: string | null;
  body?: string | null;
};

type PromptCard = {
  id?: string;
  title: string;
  anchor?: string;
  teaser?: string;
  why_it_matters?: string;
  body?: string;
};

type Evaluation = {
  angle_summary?: string | null;
  coverage_type?: AngleCardInput["coverage_type"];
  same_angle?: boolean;
  matched_card_id?: string | null;
  similarity_confidence?: number;
  scores?: unknown;
  score_total?: number;
  battle?: unknown;
  placement?: string;
  replace_card_id?: string | null;
  reason?: string | null;
  risk?: string | null;
  rewrite_instruction?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[PROCESS_ANGLE] ADMIN_SECRET is not configured");
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

function toPromptCard(card: CandidateCard): PromptCard {
  const promptCard: PromptCard = {
    id: card.id,
    title: card.title,
  };

  if (card.anchor) promptCard.anchor = card.anchor;
  if (card.teaser) promptCard.teaser = card.teaser;
  if (card.why_it_matters) promptCard.why_it_matters = card.why_it_matters;
  if (card.body) promptCard.body = card.body;

  return promptCard;
}

function toRewriteEvaluation(evaluation: Evaluation): RewriteAngleEvaluation {
  const normalized: RewriteAngleEvaluation = {};

  if (evaluation.angle_summary) {
    normalized.angle_summary = evaluation.angle_summary;
  }

  if (evaluation.coverage_type) {
    normalized.coverage_type = evaluation.coverage_type;
  }

  if (typeof evaluation.score_total === "number") {
    normalized.score_total = evaluation.score_total;
  }

  if (evaluation.placement) {
    normalized.placement = evaluation.placement;
  }

  if (evaluation.reason) {
    normalized.reason = evaluation.reason;
  }

  if (evaluation.risk) {
    normalized.risk = evaluation.risk;
  }

  if (evaluation.rewrite_instruction) {
    normalized.rewrite_instruction = evaluation.rewrite_instruction;
  }

  return normalized;
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

function normalizeStatusFromPlacement(
  placement: unknown,
): AngleCardInput["status"] {
  if (placement === "featured_new" || placement === "replace_existing") {
    return "featured";
  }

  if (placement === "reserve") {
    return "reserve";
  }

  if (placement === "rewrite") {
    return "rewrite";
  }

  if (placement === "hidden") {
    return "hidden";
  }

  if (placement === "reject" || placement === "rejected") {
    return "rejected";
  }

  if (placement === "needs_human_review") {
    return "reserve";
  }

  return "reserve";
}

function shouldRewrite(evaluation: Evaluation): boolean {
  return (
    evaluation.placement === "rewrite" &&
    typeof evaluation.rewrite_instruction === "string" &&
    evaluation.rewrite_instruction.trim().length > 0
  );
}

function getFinalCardForSave(card: CandidateCard): {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
} {
  return {
    title: card.title,
    anchor: card.anchor ?? null,
    teaser: card.teaser ?? card.body ?? "",
    why_it_matters: card.why_it_matters ?? null,
  };
}

function getModelName(provider: string): string {
  if (provider === "openai") {
    return process.env.OPENAI_MODEL || "gpt-5.5";
  }

  if (provider === "claude") {
    return process.env.ANTHROPIC_MODEL || "claude";
  }

  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || "gemini";
  }

  return provider;
}

async function evaluateCandidate(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  candidate: CandidateCard;
  featuredCards: AngleCardRow[];
  reserveCards: AngleCardRow[];
  sourceArticle?: string;
  targetFeaturedCount: number;
}): Promise<Evaluation> {
  const editorProvider = isProvider("openai") ? "openai" : defaultProvider();

  const prompt = buildEvaluateAnglePrompt({
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    candidate: toPromptCard(args.candidate),
    featuredCards: args.featuredCards.map(toEvaluatorCard),
    reserveCards: args.reserveCards.map(toEvaluatorCard),
    sourceArticle: args.sourceArticle,
    targetFeaturedCount: args.targetFeaturedCount,
  });

  const text = await runAI(editorProvider, prompt, args.lang, true);
  const parsed = extractJsonObject(text);

  if (!isRecord(parsed)) {
    throw new Error("Evaluator returned invalid JSON object");
  }

  return parsed as Evaluation;
}

async function rewriteCandidate(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  candidate: CandidateCard;
  evaluation: Evaluation;
  sourceArticle?: string;
}): Promise<CandidateCard> {
  const editorProvider = isProvider("openai") ? "openai" : defaultProvider();

  const prompt = buildRewriteAnglePrompt({
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    candidate: toPromptCard(args.candidate),
    evaluation: toRewriteEvaluation(args.evaluation),
    sourceArticle: args.sourceArticle,
  });

  const text = await runAI(editorProvider, prompt, args.lang, true);
  const parsed = extractJsonObject(text);

  if (!isRecord(parsed) || !isRecord(parsed.card)) {
    throw new Error("Rewrite returned invalid JSON object");
  }

  const card = parsed.card;

  const title = getString(card.title);
  const teaser = getString(card.teaser);

  if (!title || !teaser) {
    throw new Error("Rewrite returned card without title or teaser");
  }

  return {
    id: "rewritten_candidate",
    title,
    anchor: getString(card.anchor),
    teaser,
    why_it_matters: getString(card.why_it_matters),
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const reference = getString(body?.reference);
    const verseText = getString(body?.verseText);
    const lang = isLang(body?.lang) ? body.lang : null;
    const candidate = body?.candidate;
    const sourceArticle = getString(body?.sourceArticle) ?? undefined;
    const targetFeaturedCount = getNumber(body?.targetFeaturedCount) ?? 12;

    const sourceProvider = isProvider(body?.source_provider)
      ? body.source_provider
      : isProvider(body?.provider)
        ? body.provider
        : null;

    const sourceModel = getString(body?.source_model) ?? null;

    if (!reference || !verseText || !lang || !isCandidateCard(candidate)) {
      return NextResponse.json(
        {
          error:
            "reference, verseText, lang, and candidate { title, teaser } are required",
        },
        { status: 400 },
      );
    }

    const existing = await getAngleCards({
      reference,
      lang,
      statuses: ["featured", "reserve"],
      limit: 48,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { error: existing.error ?? "Failed to read existing angle cards" },
        { status: 500 },
      );
    }

    const featuredCards = existing.cards.filter(
      (card) => card.status === "featured",
    );
    const reserveCards = existing.cards.filter(
      (card) => card.status === "reserve",
    );

    const firstEvaluation = await evaluateCandidate({
      reference,
      verseText,
      lang,
      candidate,
      featuredCards,
      reserveCards,
      sourceArticle,
      targetFeaturedCount,
    });

    let finalCard: CandidateCard = candidate;
    let finalEvaluation: Evaluation = firstEvaluation;
    let rewritten = false;
    let rewrittenCard: CandidateCard | null = null;

    if (shouldRewrite(firstEvaluation)) {
      rewrittenCard = await rewriteCandidate({
        reference,
        verseText,
        lang,
        candidate,
        evaluation: firstEvaluation,
        sourceArticle,
      });

      rewritten = true;
      finalCard = rewrittenCard;

      finalEvaluation = await evaluateCandidate({
        reference,
        verseText,
        lang,
        candidate: rewrittenCard,
        featuredCards,
        reserveCards,
        sourceArticle,
        targetFeaturedCount,
      });
    }

    const referenceParts = parseReferenceParts(reference);
    const cardForSave = getFinalCardForSave(finalCard);
    const status = normalizeStatusFromPlacement(finalEvaluation.placement);
    const scoreTotal = getNumber(finalEvaluation.score_total);

    const saveResult = await saveAngleCard({
      reference,
      book: referenceParts.book,
      chapter: referenceParts.chapter,
      verse: referenceParts.verse,
      lang,

      title: cardForSave.title,
      anchor: cardForSave.anchor,
      teaser: cardForSave.teaser,
      why_it_matters: cardForSave.why_it_matters,

      angle_summary: getString(finalEvaluation.angle_summary),
      coverage_type: normalizeCoverageType(finalEvaluation.coverage_type),

      score_total: scoreTotal,
      scores: finalEvaluation.scores ?? null,
      evaluation: finalEvaluation,
      battle: finalEvaluation.battle ?? null,

      status,
      rank: status === "featured" ? 999 : null,
      is_locked: false,

      source_type: rewritten
        ? "admin_process_candidate_rewrite"
        : "admin_process_candidate",
      source_provider: sourceProvider,
      source_model: sourceModel,

      editor_provider: "openai",
      editor_model: getModelName("openai"),

      original_card: candidate,
      rewritten_from_card_id: null,
      replaced_card_id: getString(finalEvaluation.replace_card_id),

      prompt_version: "angle_cards_v1",
    });

    if (!saveResult.ok) {
      return NextResponse.json(
        { error: saveResult.error ?? "Failed to save processed card" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      saved_id: saveResult.id,
      rewritten,
      status,
      score_total: scoreTotal,
      first_evaluation: firstEvaluation,
      rewritten_card: rewrittenCard,
      final_card: finalCard,
      final_evaluation: finalEvaluation,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Process angle candidate failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
