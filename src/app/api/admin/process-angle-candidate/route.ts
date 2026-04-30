import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider, type Provider } from "@/lib/ai/providers";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { translateAngleCard } from "@/lib/angles/translateAngleCard";
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

type EvaluationBattle = {
  required?: boolean;
  old_card_id?: string | null;
  old_score?: number;
  new_score?: number;
  winner?: string | null;
  score_delta?: number;
  battle_action?: string | null;
  battle_reason?: string | null;
};

type Evaluation = {
  angle_summary?: string | null;
  coverage_type?: AngleCardInput["coverage_type"];
  same_angle?: boolean;
  matched_card_id?: string | null;
  similarity_confidence?: number;
  scores?: unknown;
  score_total?: number;
  battle?: EvaluationBattle | unknown;
  placement?: string;
  replace_card_id?: string | null;
  reason?: string | null;
  risk?: string | null;
  rewrite_instruction?: string | null;
};

type SaveOneCardArgs = {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: Lang;
  canonical_ref: string | null;
  book_key: string | null;
  translation_group_id: string;
  origin_lang: Lang;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  angle_summary: string | null;
  coverage_type: AngleCardInput["coverage_type"];
  score_total: number | null;
  scores: unknown;
  evaluation: Evaluation;
  battle: unknown;
  status: AngleCardInput["status"];
  rewritten: boolean;
  sourceProvider: string | null;
  sourceModel: string | null;
  editorProvider: Provider;
  candidate: CandidateCard;
  replace_card_id: string | null;
  forceSaveDuplicate: boolean;
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

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = getString(record[key]);
    if (value) return value;
  }

  return null;
}

function firstNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = getNumber(record[key]);
    if (typeof value === "number") return value;
  }

  return null;
}

function firstBoolean(
  record: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    const value = getBoolean(record[key]);
    if (typeof value === "boolean") return value;
  }

  return null;
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

  if (value === "лексический") return "lexical";
  if (value === "грамматический") return "grammatical";
  if (value === "структурный") return "structural";
  if (value === "контекстуальный") return "contextual";
  if (value === "переводческий") return "translation";
  if (value === "риторический") return "rhetorical";
  if (value === "исторический") return "historical";
  if (value === "концептуальный") return "conceptual";

  return null;
}

function normalizePlacementValue(value: unknown): string | null {
  const raw = getString(value);
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();

  if (normalized === "избранное" || normalized === "новая_избранная") {
    return "featured_new";
  }

  if (normalized === "заменить" || normalized === "заменить_существующую") {
    return "replace_existing";
  }

  if (normalized === "резерв" || normalized === "в_резерв") {
    return "reserve";
  }

  if (normalized === "переписать") {
    return "rewrite";
  }

  if (
    normalized === "скрыть" ||
    normalized === "скрытая" ||
    normalized === "hidden" ||
    normalized === "hide" ||
    normalized === "skip" ||
    normalized === "skipped"
  ) {
    return "hidden";
  }

  if (
    normalized === "отклонить" ||
    normalized === "отклонено" ||
    normalized === "reject" ||
    normalized === "rejected"
  ) {
    return "rejected";
  }

  if (normalized === "ручная_проверка") {
    return "needs_human_review";
  }

  return raw;
}

function normalizeForceStatus(value: unknown): AngleCardInput["status"] | null {
  const raw = getString(value);
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();

  if (
    normalized === "featured" ||
    normalized === "active" ||
    normalized === "активная"
  ) {
    return "featured";
  }

  if (normalized === "reserve" || normalized === "запас") {
    return "reserve";
  }

  return null;
}

function normalizeBattleAction(value: unknown): string | null {
  const raw = getString(value);
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();

  if (
    normalized === "оставить_старую_скрыть_новую" ||
    normalized === "оставить_старую_пропустить_новую" ||
    normalized === "hide_new" ||
    normalized === "skip_new" ||
    normalized === "keep_existing_hide_candidate"
  ) {
    return "keep_existing_hide_candidate";
  }

  if (
    normalized === "оставить_старую_в_резерв" ||
    normalized === "keep_existing_send_candidate_to_reserve"
  ) {
    return "keep_existing_send_candidate_to_reserve";
  }

  if (normalized === "заменить_старую" || normalized === "replace_existing") {
    return "replace_existing";
  }

  if (normalized === "none" || normalized === "нет") {
    return "none";
  }

  return raw;
}

function normalizeWinner(value: unknown): string | null {
  const raw = getString(value);
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();

  if (
    normalized === "совпавшая" ||
    normalized === "старая" ||
    normalized === "существующая" ||
    normalized === "matched" ||
    normalized === "old" ||
    normalized === "existing"
  ) {
    return "matched";
  }

  if (
    normalized === "кандидат" ||
    normalized === "новая" ||
    normalized === "candidate" ||
    normalized === "new"
  ) {
    return "candidate";
  }

  return raw;
}

function normalizeBattle(value: unknown): EvaluationBattle | null {
  if (!isRecord(value)) return null;

  const battleAction = normalizeBattleAction(
    value.battle_action ?? value["действие_по_сравнению"],
  );

  return {
    required: firstBoolean(value, ["required", "требуется"]) ?? undefined,
    old_card_id:
      firstString(value, ["old_card_id", "идентификатор_старой_карточки"]) ??
      null,
    old_score:
      firstNumber(value, ["old_score", "оценка_старой"]) ?? undefined,
    new_score:
      firstNumber(value, ["new_score", "оценка_новой"]) ?? undefined,
    winner: normalizeWinner(value.winner ?? value["победитель"]),
    score_delta:
      firstNumber(value, ["score_delta", "разница_оценок"]) ?? undefined,
    battle_action: battleAction,
    battle_reason:
      firstString(value, ["battle_reason", "причина_сравнения"]) ?? null,
  };
}

function normalizeEvaluation(parsed: unknown): Evaluation {
  if (!isRecord(parsed)) {
    throw new Error("Evaluator returned invalid JSON object");
  }

  const battle = normalizeBattle(parsed.battle ?? parsed["сравнение"]);

  const evaluation: Evaluation = {
    angle_summary:
      firstString(parsed, ["angle_summary", "краткое_описание_угла"]) ?? null,
    coverage_type: normalizeCoverageType(
      parsed.coverage_type ?? parsed["тип_охвата"],
    ),
    same_angle:
      firstBoolean(parsed, ["same_angle", "тот_же_угол"]) ?? undefined,
    matched_card_id:
      firstString(parsed, [
        "matched_card_id",
        "идентификатор_совпавшей_карточки",
      ]) ?? null,
    similarity_confidence:
      firstNumber(parsed, [
        "similarity_confidence",
        "уверенность_сходства",
      ]) ?? undefined,
    scores: parsed.scores ?? parsed["оценки"] ?? null,
    score_total:
      firstNumber(parsed, ["score_total", "общая_оценка"]) ?? undefined,
    battle,
    placement:
      normalizePlacementValue(parsed.placement ?? parsed["размещение"]) ??
      undefined,
    replace_card_id:
      firstString(parsed, ["replace_card_id", "заменить_карточку"]) ?? null,
    reason: firstString(parsed, ["reason", "причина"]) ?? null,
    risk: firstString(parsed, ["risk", "риск"]) ?? null,
    rewrite_instruction:
      firstString(parsed, [
        "rewrite_instruction",
        "указание_для_переписывания",
      ]) ?? null,
  };

  return evaluation;
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
  const normalized = normalizeReference(reference);

  if (
    normalized.book &&
    Number.isFinite(normalized.chapter) &&
    Number.isFinite(normalized.verse) &&
    normalized.chapter > 0 &&
    normalized.verse > 0
  ) {
    return {
      book: normalized.book,
      chapter: normalized.chapter,
      verse: normalized.verse,
    };
  }

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

function toDuplicateCard(card: AngleCardRow | null) {
  if (!card) return null;

  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    angle_summary: card.angle_summary,
    coverage_type: card.coverage_type,
    score_total: card.score_total,
    status: card.status,
    is_locked: card.is_locked,
    source_type: card.source_type,
    source_provider: card.source_provider,
    source_model: card.source_model,
    editor_model: card.editor_model,
    moderator_boost:
      "moderator_boost" in card
        ? (card as AngleCardRow & { moderator_boost?: number | null })
            .moderator_boost ?? null
        : null,
  };
}

function normalizeStatusFromPlacement(
  placement: unknown,
): AngleCardInput["status"] {
  const normalized = normalizePlacementValue(placement);

  if (normalized === "featured_new" || normalized === "replace_existing") {
    return "featured";
  }

  if (normalized === "reserve") {
    return "reserve";
  }

  if (normalized === "rewrite") {
    return "rewrite";
  }

  if (normalized === "hidden") {
    return "hidden";
  }

  if (normalized === "reject" || normalized === "rejected") {
    return "rejected";
  }

  if (normalized === "needs_human_review") {
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

function getBattle(evaluation: Evaluation): EvaluationBattle | null {
  if (!isRecord(evaluation.battle)) return null;
  return normalizeBattle(evaluation.battle);
}

function getMatchedCardId(evaluation: Evaluation): string | null {
  const battle = getBattle(evaluation);

  return (
    getString(evaluation.matched_card_id) ??
    getString(evaluation.replace_card_id) ??
    getString(battle?.old_card_id) ??
    null
  );
}

function findMatchedCard(
  evaluation: Evaluation,
  cards: AngleCardRow[],
): AngleCardRow | null {
  const matchedCardId = getMatchedCardId(evaluation);

  if (matchedCardId) {
    const exact = cards.find((card) => card.id === matchedCardId);
    if (exact) return exact;
  }

  const battle = getBattle(evaluation);
  const oldScore = getNumber(battle?.old_score);

  if (typeof oldScore === "number") {
    const scoreMatch = cards.find((card) => card.score_total === oldScore);
    if (scoreMatch) return scoreMatch;
  }

  return cards[0] ?? null;
}

function buildDuplicatePayload(args: {
  evaluation: Evaluation;
  candidate: CandidateCard;
  finalCard: CandidateCard;
  matchedCard: AngleCardRow | null;
}) {
  const battle = getBattle(args.evaluation);

  return {
    reason:
      getString(args.evaluation.reason) ??
      getString(battle?.battle_reason) ??
      "Система считает, что новый кандидат раскрывает тот же угол, что уже существующая карточка.",
    matched_card_id: args.matchedCard?.id ?? getMatchedCardId(args.evaluation),
    existing_card: toDuplicateCard(args.matchedCard),
    candidate_card: {
      id: args.finalCard.id ?? args.candidate.id ?? null,
      title: args.finalCard.title,
      anchor: args.finalCard.anchor ?? null,
      teaser: args.finalCard.teaser ?? args.finalCard.body ?? "",
      why_it_matters: args.finalCard.why_it_matters ?? null,
      original_candidate: args.candidate,
    },
    existing_score:
      args.matchedCard?.score_total ?? getNumber(battle?.old_score) ?? null,
    candidate_score:
      getNumber(args.evaluation.score_total) ?? getNumber(battle?.new_score),
    same_angle: args.evaluation.same_angle ?? null,
    similarity_confidence: args.evaluation.similarity_confidence ?? null,
    battle,
    evaluation: args.evaluation,
  };
}

function shouldSkipMatchedDuplicate(evaluation: Evaluation): boolean {
  const battle = getBattle(evaluation);

  if (!battle) return false;

  const action = normalizeBattleAction(battle.battle_action);

  if (evaluation.same_angle === true && battle.winner === "matched") {
    return true;
  }

  if (
    evaluation.same_angle === true &&
    action === "keep_existing_hide_candidate"
  ) {
    return true;
  }

  return false;
}

function shouldSkipInsteadOfSave(evaluation: Evaluation): {
  skip: boolean;
  reason: string;
} {
  const scoreTotal = getNumber(evaluation.score_total);
  const placement = normalizePlacementValue(evaluation.placement);
  const battle = getBattle(evaluation);
  const battleAction = normalizeBattleAction(battle?.battle_action);

  if (typeof scoreTotal !== "number") {
    return {
      skip: true,
      reason: "invalid_score_total",
    };
  }

  if (scoreTotal < 55) {
    return {
      skip: true,
      reason: "score_below_save_threshold",
    };
  }

  if (
    placement === "hidden" ||
    placement === "rejected" ||
    placement === "reject"
  ) {
    return {
      skip: true,
      reason: "placement_not_savable",
    };
  }

  if (battleAction === "keep_existing_hide_candidate") {
    return {
      skip: true,
      reason: "battle_hide_candidate",
    };
  }

  return {
    skip: false,
    reason: "savable",
  };
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

function chooseEditorProvider(body: unknown): Provider {
  if (!isRecord(body)) {
    return "gemini";
  }

  if (isProvider(body.editor_provider)) {
    return body.editor_provider;
  }

  if (isProvider(body.evaluator_provider)) {
    return body.evaluator_provider;
  }

  if (isProvider(body.provider) && body.provider !== "openai") {
    return body.provider;
  }

  const envProvider = process.env.ANGLE_EDITOR_PROVIDER;

  if (isProvider(envProvider)) {
    return envProvider;
  }

  const fallback = defaultProvider();

  if (fallback !== "openai") {
    return fallback;
  }

  return "gemini";
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
  editorProvider: Provider;
}): Promise<Evaluation> {
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

  const text = await runAI(args.editorProvider, prompt, args.lang, true);
  const parsed = extractJsonObject(text);

  return normalizeEvaluation(parsed);
}

async function rewriteCandidate(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  candidate: CandidateCard;
  evaluation: Evaluation;
  sourceArticle?: string;
  editorProvider: Provider;
}): Promise<CandidateCard> {
  const prompt = buildRewriteAnglePrompt({
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    candidate: toPromptCard(args.candidate),
    evaluation: toRewriteEvaluation(args.evaluation),
    sourceArticle: args.sourceArticle,
  });

  const text = await runAI(args.editorProvider, prompt, args.lang, true);
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

async function saveOneCard(args: SaveOneCardArgs): Promise<{
  ok: boolean;
  id: string | null;
  lang: Lang;
  error: string | null;
}> {
  const saveResult = await saveAngleCard({
    reference: args.reference,
    book: args.book,
    chapter: args.chapter,
    verse: args.verse,
    lang: args.lang,

    canonical_ref: args.canonical_ref,
    book_key: args.book_key,
    translation_group_id: args.translation_group_id,
    origin_lang: args.origin_lang,

    title: args.title,
    anchor: args.anchor,
    teaser: args.teaser,
    why_it_matters: args.why_it_matters,

    angle_summary: args.angle_summary,
    coverage_type: args.coverage_type,

    score_total: args.score_total,
    scores: args.scores,
    evaluation: args.evaluation,
    battle: args.battle,

    status: args.status,
    rank: args.status === "featured" ? 999 : null,
    is_locked: false,

    source_type: args.forceSaveDuplicate
      ? "manual_force_duplicate"
      : args.rewritten
        ? "admin_process_candidate_rewrite"
        : "admin_process_candidate",
    source_provider: args.sourceProvider,
    source_model: args.sourceModel,

    editor_provider: args.editorProvider,
    editor_model: getModelName(args.editorProvider),

    original_card: args.candidate,
    rewritten_from_card_id: null,
    replaced_card_id: args.replace_card_id,

    prompt_version: "angle_cards_v1",
  });

  return {
    ok: saveResult.ok,
    id: saveResult.id,
    lang: args.lang,
    error: saveResult.error,
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

    const previewOnly = getBoolean(body?.preview_only) ?? false;
    const forceSaveDuplicate = getBoolean(body?.force_save_duplicate) ?? false;
    const forceStatus = normalizeForceStatus(body?.force_status);

    const editorProvider = chooseEditorProvider(body);

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

    const normalizedReference = normalizeReference(reference);

    const existing = await getAngleCards({
      reference,
      lang,
      statuses: ["featured", "reserve"],
      limit: 100,
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
      editorProvider,
    });

    if (previewOnly) {
      const duplicate = shouldSkipMatchedDuplicate(firstEvaluation)
        ? buildDuplicatePayload({
            evaluation: firstEvaluation,
            candidate,
            finalCard: candidate,
            matchedCard: findMatchedCard(firstEvaluation, existing.cards),
          })
        : null;

      const skipDecision = shouldSkipInsteadOfSave(firstEvaluation);
      const wouldSave = !duplicate && !skipDecision.skip;

      return NextResponse.json({
        ok: true,
        preview_only: true,
        changed_database: false,
        skipped: Boolean(duplicate) || skipDecision.skip,
        skip_reason: duplicate
          ? "matched_duplicate"
          : skipDecision.skip
            ? skipDecision.reason
            : null,
        would_save: wouldSave,
        saved_id: null,
        saved_ids: [],
        rewritten: false,
        status: forceStatus ?? normalizeStatusFromPlacement(firstEvaluation.placement),
        score_total: getNumber(firstEvaluation.score_total),
        canonical_ref: normalizedReference.canonical_ref,
        book_key: normalizedReference.book_key,
        editor_provider: editorProvider,
        editor_model: getModelName(editorProvider),
        duplicate,
        first_evaluation: firstEvaluation,
        final_card: candidate,
        final_evaluation: firstEvaluation,
      });
    }

    if (shouldSkipMatchedDuplicate(firstEvaluation) && !forceSaveDuplicate) {
      const matchedCard = findMatchedCard(firstEvaluation, existing.cards);

      return NextResponse.json({
        ok: true,
        skipped: true,
        skip_reason: "matched_duplicate",
        saved_id: null,
        saved_ids: [],
        rewritten: false,
        status: "skipped_duplicate",
        score_total: getNumber(firstEvaluation.score_total),
        canonical_ref: normalizedReference.canonical_ref,
        book_key: normalizedReference.book_key,
        editor_provider: editorProvider,
        editor_model: getModelName(editorProvider),
        duplicate: buildDuplicatePayload({
          evaluation: firstEvaluation,
          candidate,
          finalCard: candidate,
          matchedCard,
        }),
        first_evaluation: firstEvaluation,
        final_card: candidate,
        final_evaluation: firstEvaluation,
      });
    }

    let finalCard: CandidateCard = candidate;
    let finalEvaluation: Evaluation = firstEvaluation;
    let rewritten = false;
    let rewrittenCard: CandidateCard | null = null;

    if (shouldRewrite(firstEvaluation) && !forceSaveDuplicate) {
      rewrittenCard = await rewriteCandidate({
        reference,
        verseText,
        lang,
        candidate,
        evaluation: firstEvaluation,
        sourceArticle,
        editorProvider,
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
        editorProvider,
      });

      if (shouldSkipMatchedDuplicate(finalEvaluation) && !forceSaveDuplicate) {
        const matchedCard = findMatchedCard(finalEvaluation, existing.cards);

        return NextResponse.json({
          ok: true,
          skipped: true,
          skip_reason: "matched_duplicate_after_rewrite",
          saved_id: null,
          saved_ids: [],
          rewritten,
          status: "skipped_duplicate",
          score_total: getNumber(finalEvaluation.score_total),
          canonical_ref: normalizedReference.canonical_ref,
          book_key: normalizedReference.book_key,
          editor_provider: editorProvider,
          editor_model: getModelName(editorProvider),
          duplicate: buildDuplicatePayload({
            evaluation: finalEvaluation,
            candidate,
            finalCard,
            matchedCard,
          }),
          first_evaluation: firstEvaluation,
          rewritten_card: rewrittenCard,
          final_card: finalCard,
          final_evaluation: finalEvaluation,
        });
      }
    }

    const skipDecision = shouldSkipInsteadOfSave(finalEvaluation);

    if (skipDecision.skip && !forceSaveDuplicate) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skip_reason: skipDecision.reason,
        saved_id: null,
        saved_ids: [],
        rewritten,
        status: "skipped_not_savable",
        score_total: getNumber(finalEvaluation.score_total),
        canonical_ref: normalizedReference.canonical_ref,
        book_key: normalizedReference.book_key,
        editor_provider: editorProvider,
        editor_model: getModelName(editorProvider),
        first_evaluation: firstEvaluation,
        rewritten_card: rewrittenCard,
        final_card: finalCard,
        final_evaluation: finalEvaluation,
      });
    }

    if (skipDecision.reason === "invalid_score_total") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skip_reason: "invalid_score_total",
        saved_id: null,
        saved_ids: [],
        rewritten,
        status: "skipped_not_savable",
        score_total: null,
        canonical_ref: normalizedReference.canonical_ref,
        book_key: normalizedReference.book_key,
        editor_provider: editorProvider,
        editor_model: getModelName(editorProvider),
        first_evaluation: firstEvaluation,
        rewritten_card: rewrittenCard,
        final_card: finalCard,
        final_evaluation: finalEvaluation,
      });
    }

    const referenceParts = parseReferenceParts(reference);
    const cardForSave = getFinalCardForSave(finalCard);
    let status =
      forceStatus ??
      (forceSaveDuplicate
        ? "reserve"
        : normalizeStatusFromPlacement(finalEvaluation.placement));

    const scoreTotal = getNumber(finalEvaluation.score_total);

    // Force weaker cards into reserve instead of featured
    if (typeof scoreTotal === "number" && scoreTotal < 80) {
      status = "reserve";
    }

    const translationGroupId = randomUUID();

    const translationResult = await translateAngleCard({
      reference,
      originLang: lang,
      provider: editorProvider,
      card: {
        title: cardForSave.title,
        anchor: cardForSave.anchor,
        teaser: cardForSave.teaser,
        why_it_matters: cardForSave.why_it_matters,
      },
    });

    if (!translationResult.ok) {
      return NextResponse.json(
        {
          error:
            translationResult.error ??
            "Failed to translate approved angle card",
          canonical_ref: normalizedReference.canonical_ref,
          book_key: normalizedReference.book_key,
          editor_provider: editorProvider,
          editor_model: getModelName(editorProvider),
          first_evaluation: firstEvaluation,
          final_card: finalCard,
          final_evaluation: finalEvaluation,
        },
        { status: 500 },
      );
    }

    const saveResults = [];

    for (const translated of translationResult.cards) {
      const saveResult = await saveOneCard({
        reference,
        book: referenceParts.book,
        chapter: referenceParts.chapter,
        verse: referenceParts.verse,
        lang: translated.lang,
        canonical_ref: normalizedReference.canonical_ref,
        book_key: normalizedReference.book_key,
        translation_group_id: translationGroupId,
        origin_lang: lang,

        title: translated.title,
        anchor: translated.anchor,
        teaser: translated.teaser,
        why_it_matters: translated.why_it_matters,

        angle_summary: getString(finalEvaluation.angle_summary),
        coverage_type: normalizeCoverageType(finalEvaluation.coverage_type),

        score_total: scoreTotal,
        scores: finalEvaluation.scores ?? null,
        evaluation: finalEvaluation,
        battle: finalEvaluation.battle ?? null,

        status,
        rewritten,
        sourceProvider,
        sourceModel,
        editorProvider,
        candidate,
        replace_card_id: getString(finalEvaluation.replace_card_id),
        forceSaveDuplicate,
      });

      if (!saveResult.ok) {
        return NextResponse.json(
          {
            error: saveResult.error ?? "Failed to save translated card",
            failed_lang: translated.lang,
            partial_saved: saveResults,
          },
          { status: 500 },
        );
      }

      saveResults.push(saveResult);
    }

    const originSaved =
      saveResults.find((result) => result.lang === lang) ?? saveResults[0];

    return NextResponse.json({
      ok: true,
      skipped: false,
      saved_id: originSaved?.id ?? null,
      saved_ids: saveResults,
      translation_group_id: translationGroupId,
      rewritten,
      forced_duplicate_save: forceSaveDuplicate,
      status,
      score_total: scoreTotal,
      canonical_ref: normalizedReference.canonical_ref,
      book_key: normalizedReference.book_key,
      editor_provider: editorProvider,
      editor_model: getModelName(editorProvider),
      first_evaluation: firstEvaluation,
      rewritten_card: rewrittenCard,
      final_card: finalCard,
      translated_cards: translationResult.cards,
      final_evaluation: finalEvaluation,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Process angle candidate failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
