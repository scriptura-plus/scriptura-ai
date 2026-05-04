import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunAutoCuratorBody = {
  reference?: string;
  canonical_ref?: string | null;
  book_key?: string | null;
  book?: string | null;
  chapter?: number | null;
  verse?: number | null;
  lang?: string;
  maxCandidates?: number;
  apply?: boolean;
};

type CandidateCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
};

type GeneratedCandidate = {
  candidate: CandidateCard;
  source_basis: string | null;
};

type EvaluatedCandidate = {
  candidate: CandidateCard;
  score_total: number;
  scores: Record<string, number>;
  coverage_type: string | null;
  angle_summary: string | null;
  angle_relationship:
    | "duplicate"
    | "stronger_version"
    | "sibling_angle"
    | "distinct_angle"
    | "uncertain";
  relationship_confidence: "low" | "medium" | "high";
  matched_card_id: string | null;
  matched_card_title: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  risk: string | null;
  reason: string;
  source_basis: string | null;
};

type Decision = {
  candidate: CandidateCard;
  score_total: number;
  scores: Record<string, number>;
  coverage_type: string | null;
  angle_summary: string | null;
  angle_relationship: EvaluatedCandidate["angle_relationship"];
  relationship_confidence: EvaluatedCandidate["relationship_confidence"];
  matched_card_id: string | null;
  matched_card_title: string | null;
  risk_level: EvaluatedCandidate["risk_level"];
  risk: string | null;
  reason: string;
  source_basis: string | null;
  recommended_action: "auto_add" | "auto_reject" | "editorial_suggestion";
  suggestion_type:
    | "replacement"
    | "needs_review"
    | "locked_card_challenger"
    | "style_review"
    | "promote_candidate"
    | "duplicate_uncertain"
    | null;
  decision_reason: string;
  applied: boolean;
  inserted_card_id: string | null;
  inserted_suggestion_id: string | null;
  error: string | null;
};

type ModelCallResult = {
  rawText: string;
  rawJson: unknown;
  provider: string;
  model: string;
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[RUN_AUTO_CURATOR] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
}

function stringifyCompact(value: unknown, maxLength = 900): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    return truncate(value.replace(/\s+/g, " ").trim(), maxLength);
  }

  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return "";
  }
}

function readAnyString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = getString(row[key]);
    if (value) return value;
  }

  return null;
}

function compactLakeRow(row: unknown, index: number): Record<string, unknown> | null {
  if (!isRecord(row)) return null;

  return {
    index: index + 1,
    id: getString(row.id),
    reference: getString(row.reference),
    canonical_ref: getString(row.canonical_ref),
    lang: getString(row.lang),
    kind:
      readAnyString(row, [
        "source_kind",
        "source_type",
        "note_kind",
        "note_type",
        "article_type",
        "lens_id",
      ]) ?? "unknown",
    title: readAnyString(row, ["source_title", "title", "kicker"]),
    summary: readAnyString(row, ["summary", "source_summary"]),
    text: stringifyCompact(
      row.content_json ??
        row.raw_json ??
        row.raw_text ??
        row.note_text ??
        row.body ??
        row.text,
      1500,
    ),
    created_at: getString(row.created_at),
  };
}

function compactAngleCard(row: unknown): Record<string, unknown> | null {
  if (!isRecord(row)) return null;

  return {
    id: getString(row.id),
    title: getString(row.title),
    anchor: getString(row.anchor),
    teaser: getString(row.teaser),
    why_it_matters: getString(row.why_it_matters),
    status: getString(row.status),
    score_total: getNumber(row.score_total),
    moderator_boost: getNumber(row.moderator_boost),
    is_locked: row.is_locked === true,
    angle_summary: getString(row.angle_summary),
    coverage_type: getString(row.coverage_type),
  };
}

function extractOpenAIResponseText(value: unknown): string {
  if (!isRecord(value)) return "";

  const direct = getString(value.output_text);
  if (direct) return direct;

  const output = Array.isArray(value.output) ? value.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    if (!isRecord(item)) continue;
    const content = Array.isArray(item.content) ? item.content : [];

    for (const part of content) {
      if (!isRecord(part)) continue;
      const text = getString(part.text);
      if (text) chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
}

function extractAnthropicResponseText(value: unknown): string {
  if (!isRecord(value)) return "";

  const content = Array.isArray(value.content) ? value.content : [];
  const chunks: string[] = [];

  for (const part of content) {
    if (!isRecord(part)) continue;
    const text = getString(part.text);
    if (text) chunks.push(text);
  }

  return chunks.join("\n").trim();
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();

  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(fenced);
  } catch {
    // continue
  }

  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(fenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeCandidateCard(value: unknown): CandidateCard | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const teaser = getString(value.teaser);
  const anchor = getString(value.anchor);
  const whyItMatters =
    getString(value.why_it_matters) ?? getString(value.whyItMatters);

  if (!title || !teaser) return null;

  return {
    title,
    anchor,
    teaser,
    why_it_matters: whyItMatters,
  };
}

function normalizeGeneratedCandidates(value: unknown): GeneratedCandidate[] {
  if (!isRecord(value)) return [];

  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];

  return rawCandidates
    .map((item) => {
      if (!isRecord(item)) return null;

      const card = normalizeCandidateCard(item.candidate ?? item);
      if (!card) return null;

      return {
        candidate: card,
        source_basis: getString(item.source_basis),
      };
    })
    .filter((item): item is GeneratedCandidate => item !== null);
}

function normalizeRelationship(value: unknown): EvaluatedCandidate["angle_relationship"] {
  const text = getString(value);

  if (
    text === "duplicate" ||
    text === "stronger_version" ||
    text === "sibling_angle" ||
    text === "distinct_angle" ||
    text === "uncertain"
  ) {
    return text;
  }

  return "uncertain";
}

function normalizeConfidence(value: unknown): EvaluatedCandidate["relationship_confidence"] {
  const text = getString(value);

  if (text === "low" || text === "medium" || text === "high") {
    return text;
  }

  return "medium";
}

function normalizeRiskLevel(value: unknown): EvaluatedCandidate["risk_level"] {
  const text = getString(value);

  if (text === "low" || text === "medium" || text === "high" || text === "unknown") {
    return text;
  }

  return "unknown";
}

function normalizeScores(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  const result: Record<string, number> = {};

  for (const [key, raw] of Object.entries(value)) {
    const score = getNumber(raw);
    if (score !== null) result[key] = clampInt(score, 0, 10);
  }

  return result;
}

function normalizeEvaluationOutput(value: unknown): EvaluatedCandidate[] {
  if (!isRecord(value)) return [];

  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];

  return rawCandidates
    .map((item) => {
      if (!isRecord(item)) return null;

      const card = normalizeCandidateCard(item.candidate);
      if (!card) return null;

      const rawScore = getNumber(item.score_total) ?? getNumber(item.score);
      const score = clampInt(rawScore ?? 0, 0, 100);

      return {
        candidate: card,
        score_total: score,
        scores: normalizeScores(item.scores),
        coverage_type: getString(item.coverage_type),
        angle_summary: getString(item.angle_summary),
        angle_relationship: normalizeRelationship(item.angle_relationship),
        relationship_confidence: normalizeConfidence(item.relationship_confidence),
        matched_card_id: getString(item.matched_card_id),
        matched_card_title: getString(item.matched_card_title),
        risk_level: normalizeRiskLevel(item.risk_level),
        risk: getString(item.risk),
        reason: getString(item.reason) ?? "Evaluator did not provide a reason.",
        source_basis: getString(item.source_basis),
      };
    })
    .filter((item): item is EvaluatedCandidate => item !== null);
}

function getOutputLanguageInstruction(lang: string): string {
  if (lang === "ru") {
    return "Write all human-readable fields in Russian. Keep Greek/Hebrew words as-is when needed.";
  }

  if (lang === "es") {
    return "Write all human-readable fields in Spanish. Keep Greek/Hebrew words as-is when needed.";
  }

  return "Write all human-readable fields in English. Keep Greek/Hebrew words as-is when needed.";
}

function buildGenerationPrompt(args: {
  reference: string;
  canonicalRef: string | null;
  lang: string;
  lakeSources: Record<string, unknown>[];
  lakeNotes: Record<string, unknown>[];
  existingCards: Record<string, unknown>[];
  maxCandidates: number;
}): string {
  return `
You are Claude, the discovery generator for Scriptura AI Auto Curator.

Your job is NOT to write a general Bible commentary.
Your job is to inspect Research Lake material and propose only strong candidate insight cards.

Product standard:
A good card should make a serious Bible reader think:
"Wow — I have read this verse before, but I never noticed THAT."

Output language:
${getOutputLanguageInstruction(args.lang)}

Generate candidates only when the Lake material supports a concrete discovery:
- concrete textual anchor
- hidden or easily missed observation
- specific to this verse
- strong discovery / aha effect
- faithful and cautious
- no unsupported Greek/Hebrew claims
- no generic moral lesson
- no sermon tone

Prefer fewer, stronger candidates.
If nothing genuinely strong is found, return an empty array.

Return ONLY valid JSON:
{
  "candidates": [
    {
      "candidate": {
        "title": "...",
        "anchor": "...",
        "teaser": "...",
        "why_it_matters": "..."
      },
      "source_basis": "which lake source/note supports this candidate"
    }
  ]
}

Verse:
reference: ${args.reference}
canonical_ref: ${args.canonicalRef ?? "null"}
lang: ${args.lang}

Existing cards:
${JSON.stringify(args.existingCards, null, 2)}

Research Lake sources:
${JSON.stringify(args.lakeSources, null, 2)}

Research Lake notes:
${JSON.stringify(args.lakeNotes, null, 2)}

Maximum candidates: ${args.maxCandidates}
`.trim();
}

function buildEvaluationPrompt(args: {
  reference: string;
  canonicalRef: string | null;
  lang: string;
  generatedCandidates: GeneratedCandidate[];
  existingCards: Record<string, unknown>[];
}): string {
  return `
You are GPT-5.5, the evaluator and risk checker for Scriptura AI Auto Curator.

Your job is NOT to generate new cards.
Your job is to evaluate Claude-generated candidates against the existing card set and classify each candidate.

Strategic product standard:
A strong Scriptura card should make a serious Bible reader think:
"Wow — I have read this verse before, but I never noticed THAT."

Output language:
${getOutputLanguageInstruction(args.lang)}

Use the same evaluator standard across the whole product:
- discovery / aha effect is the main criterion
- concrete textual anchor is required
- faithfulness and caution are mandatory
- no unsupported original-language claims
- no generic moral lesson
- no obvious paraphrase
- no inflated scores

Score guidance:
- 90+ rare, exceptional discovery
- 82–89 strong public candidate
- 74–81 usable but may need review or reserve
- below 74 should generally be rejected

Same-angle policy:
- duplicate: same anchor + same hidden observation + same meaning shift
- stronger_version: same angle, candidate is clearly better
- sibling_angle: related broad theme, but different mechanism/anchor/example
- distinct_angle: genuinely new discovery
- uncertain: not enough confidence

Risk policy:
- low: safe and well-supported
- medium: plausible but needs human judgment
- high: likely overclaim, weak support, or factual risk
- unknown: not enough evidence

Return ONLY valid JSON:
{
  "candidates": [
    {
      "candidate": {
        "title": "...",
        "anchor": "...",
        "teaser": "...",
        "why_it_matters": "..."
      },
      "score_total": 0,
      "scores": {
        "discovery": 0,
        "textual_anchor": 0,
        "specificity": 0,
        "faithfulness": 0,
        "clarity": 0
      },
      "coverage_type": "lexical | grammatical | structural | contextual | translation | rhetorical | historical | conceptual | other",
      "angle_summary": "...",
      "angle_relationship": "duplicate | stronger_version | sibling_angle | distinct_angle | uncertain",
      "relationship_confidence": "low | medium | high",
      "matched_card_id": null,
      "matched_card_title": null,
      "risk_level": "low | medium | high | unknown",
      "risk": null,
      "reason": "...",
      "source_basis": "..."
    }
  ]
}

Verse:
reference: ${args.reference}
canonical_ref: ${args.canonicalRef ?? "null"}
lang: ${args.lang}

Existing cards:
${JSON.stringify(args.existingCards, null, 2)}

Claude-generated candidates:
${JSON.stringify(args.generatedCandidates, null, 2)}
`.trim();
}

async function callClaude(args: {
  prompt: string;
  model: string;
}): Promise<ModelCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 5000,
      temperature: 0.45,
      system:
        "You are Claude serving as the discovery generator for Scriptura AI Auto Curator. Return only valid JSON. Do not include markdown fences. Obey the requested output language for all human-readable fields.",
      messages: [
        {
          role: "user",
          content: args.prompt,
        },
      ],
    }),
  });

  const json = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      isRecord(json) && isRecord(json.error)
        ? getString(json.error.message)
        : null;

    throw new Error(message ?? `Claude request failed with status ${response.status}`);
  }

  const rawText = extractAnthropicResponseText(json);
  const rawJson = extractJsonObject(rawText);

  return {
    rawText,
    rawJson,
    provider: "claude",
    model: args.model,
  };
}

async function callOpenAI(args: {
  prompt: string;
  model: string;
}): Promise<ModelCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: args.prompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const json = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      isRecord(json) && isRecord(json.error)
        ? getString(json.error.message)
        : null;

    throw new Error(message ?? `OpenAI request failed with status ${response.status}`);
  }

  const rawText = extractOpenAIResponseText(json);
  const rawJson = extractJsonObject(rawText);

  return {
    rawText,
    rawJson,
    provider: "openai",
    model: args.model,
  };
}

function decideCandidate(candidate: EvaluatedCandidate): {
  recommended_action: Decision["recommended_action"];
  suggestion_type: Decision["suggestion_type"];
  decision_reason: string;
} {
  if (candidate.angle_relationship === "duplicate") {
    return {
      recommended_action: "auto_reject",
      suggestion_type: null,
      decision_reason: "Отклонено автоматически: evaluator считает это дублем существующего угла.",
    };
  }

  if (candidate.score_total < 74) {
    return {
      recommended_action: "auto_reject",
      suggestion_type: null,
      decision_reason: "Отклонено автоматически: score ниже порога 74.",
    };
  }

  if (
    candidate.score_total >= 82 &&
    candidate.angle_relationship === "distinct_angle" &&
    candidate.risk_level === "low" &&
    !candidate.matched_card_id
  ) {
    return {
      recommended_action: "auto_add",
      suggestion_type: null,
      decision_reason:
        "Автоматическое добавление разрешено: новый самостоятельный угол, низкий риск, score >= 82.",
    };
  }

  if (
    candidate.angle_relationship === "stronger_version" &&
    candidate.matched_card_id
  ) {
    return {
      recommended_action: "editorial_suggestion",
      suggestion_type: "replacement",
      decision_reason:
        "Требуется решение редактора: кандидат выглядит как более сильная версия существующей карточки.",
    };
  }

  if (
    candidate.angle_relationship === "sibling_angle" ||
    candidate.angle_relationship === "uncertain" ||
    candidate.risk_level === "medium" ||
    candidate.risk_level === "high" ||
    candidate.matched_card_id
  ) {
    return {
      recommended_action: "editorial_suggestion",
      suggestion_type:
        candidate.angle_relationship === "uncertain"
          ? "duplicate_uncertain"
          : "needs_review",
      decision_reason:
        "Требуется решение редактора: хороший кандидат, но есть связь с существующим углом, риск или неопределённость.",
    };
  }

  return {
    recommended_action: "editorial_suggestion",
    suggestion_type: "needs_review",
    decision_reason:
      "Требуется решение редактора: кандидат прошёл минимальный порог, но не удовлетворил строгим условиям auto_add.",
  };
}

async function insertAngleCard(args: {
  client: ReturnType<typeof createAdminClient>;
  reference: string;
  canonicalRef: string | null;
  bookKey: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lang: string;
  candidate: EvaluatedCandidate;
  generator: ModelCallResult;
  evaluator: ModelCallResult;
  now: string;
}): Promise<{ id: string | null; error: string | null }> {
  if (!args.client) return { id: null, error: "Supabase admin client missing" };

  const payload = {
    reference: args.reference,
    canonical_ref: args.canonicalRef ?? args.reference,
    book_key: args.bookKey,
    book: args.book,
    chapter: args.chapter,
    verse: args.verse,
    lang: args.lang,

    title: args.candidate.candidate.title,
    anchor: args.candidate.candidate.anchor,
    teaser: args.candidate.candidate.teaser,
    why_it_matters: args.candidate.candidate.why_it_matters,

    angle_summary: args.candidate.angle_summary,
    coverage_type: args.candidate.coverage_type,
    score_total: args.candidate.score_total,
    scores: args.candidate.scores,
    evaluation: {
      reason: args.candidate.reason,
      risk: args.candidate.risk,
      risk_level: args.candidate.risk_level,
      angle_relationship: args.candidate.angle_relationship,
      relationship_confidence: args.candidate.relationship_confidence,
      matched_card_id: args.candidate.matched_card_id,
      matched_card_title: args.candidate.matched_card_title,
    },
    battle: {
      winner: "candidate",
      required: false,
      reason: "Auto Curator v1 allowed auto_add only for distinct low-risk high-score candidates.",
    },

    status: "featured",
    rank: 999,
    is_locked: false,

    source_type: "auto_curator",
    source_provider: args.generator.provider,
    source_model: `auto_curator:${args.generator.model}`,
    editor_provider: args.evaluator.provider,
    editor_model: args.evaluator.model,
    original_card: {
      candidate: args.candidate.candidate,
      source_basis: args.candidate.source_basis,
    },
    prompt_version: "auto_curator_v1",

    moderator_boost: 0,
    moderator_note: null,
    moderator_decision: "auto_curator_auto_add_v1",
    moderator_reviewed_at: null,

    created_at: args.now,
    updated_at: args.now,
  };

  const { data, error } = await args.client
    .from("angle_cards")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[RUN_AUTO_CURATOR] auto_add insert error", {
      title: args.candidate.candidate.title,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return { id: null, error: error.message || "Failed to insert angle_card" };
  }

  return {
    id: isRecord(data) ? getString(data.id) : null,
    error: null,
  };
}

async function insertEditorialSuggestion(args: {
  client: ReturnType<typeof createAdminClient>;
  reference: string;
  canonicalRef: string | null;
  bookKey: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lang: string;
  candidate: EvaluatedCandidate;
  decision: ReturnType<typeof decideCandidate>;
  generator: ModelCallResult;
  evaluator: ModelCallResult;
  now: string;
}): Promise<{ id: string | null; error: string | null }> {
  if (!args.client) return { id: null, error: "Supabase admin client missing" };

  let scoreExisting: number | null = null;

  if (args.candidate.matched_card_id) {
    const { data } = await args.client
      .from("angle_cards")
      .select("score_total")
      .eq("id", args.candidate.matched_card_id)
      .maybeSingle();

    if (data && isRecord(data)) scoreExisting = getNumber(data.score_total);
  }

  const scoreDelta =
    typeof scoreExisting === "number"
      ? args.candidate.score_total - scoreExisting
      : null;

  const payload = {
    reference: args.reference,
    canonical_ref: args.canonicalRef ?? args.reference,
    book_key: args.bookKey,
    book: args.book,
    chapter: args.chapter,
    verse: args.verse,
    lang: args.lang,

    suggestion_type: args.decision.suggestion_type ?? "needs_review",
    status: "pending",

    existing_card_id: args.candidate.matched_card_id,
    candidate_card_id: null,
    candidate_payload: {
      ...args.candidate.candidate,
      auto_curator: {
        source_basis: args.candidate.source_basis,
        decision_reason: args.decision.decision_reason,
      },
    },

    score_existing: scoreExisting,
    score_candidate: args.candidate.score_total,
    score_delta: scoreDelta,

    angle_relationship: args.candidate.angle_relationship,
    relationship_confidence: args.candidate.relationship_confidence,
    same_angle_summary:
      args.candidate.matched_card_title
        ? `Кандидат связан с существующей карточкой: ${args.candidate.matched_card_title}.`
        : args.candidate.angle_summary,

    reason: `${args.decision.decision_reason}\n\nEvaluator: ${args.candidate.reason}`,
    risk: args.candidate.risk,
    risk_level: args.candidate.risk_level,
    source_summary: args.candidate.source_basis,

    source_id: null,
    note_id: null,

    provider: args.generator.provider,
    model: args.generator.model,
    evaluator_version: `auto_curator_eval:${args.evaluator.model}`,
    decision_engine_version: "auto_curator_decision_v1",

    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    moderator_decision: null,

    created_at: args.now,
    updated_at: args.now,
  };

  const { data, error } = await args.client
    .from("editorial_suggestions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[RUN_AUTO_CURATOR] editorial suggestion insert error", {
      title: args.candidate.candidate.title,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return {
      id: null,
      error: error.message || "Failed to insert editorial_suggestion",
    };
  }

  return {
    id: isRecord(data) ? getString(data.id) : null,
    error: null,
  };
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = createAdminClient();

  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  let body: RunAutoCuratorBody = {};

  try {
    body = (await req.json()) as RunAutoCuratorBody;
  } catch {
    body = {};
  }

  const reference = getString(body.reference);
  const canonicalRef = getString(body.canonical_ref);
  const lang = getString(body.lang) ?? "ru";
  const effectiveReference = reference ?? canonicalRef ?? "";
  const maxCandidates = clampInt(body.maxCandidates ?? 5, 1, 8);
  const apply = body.apply === true;

  if (!reference && !canonicalRef) {
    return NextResponse.json(
      { ok: false, error: "Missing reference or canonical_ref" },
      { status: 400 },
    );
  }

  const generatorModel =
    process.env.ANTHROPIC_GENERATOR_MODEL ?? "claude-sonnet-4-6";
  const evaluatorModel =
    process.env.OPENAI_EVALUATOR_MODEL ?? "gpt-5.5";

  try {
    let sourcesQuery = client
      .from("research_sources")
      .select("*")
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(16);

    let notesQuery = client
      .from("research_notes")
      .select("*")
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(32);

    let cardsQuery = client
      .from("angle_cards")
      .select("*")
      .eq("lang", lang)
      .order("score_total", { ascending: false, nullsFirst: false })
      .limit(100);

    if (canonicalRef) {
      sourcesQuery = sourcesQuery.eq("canonical_ref", canonicalRef);
      notesQuery = notesQuery.eq("canonical_ref", canonicalRef);
      cardsQuery = cardsQuery.eq("canonical_ref", canonicalRef);
    } else if (reference) {
      sourcesQuery = sourcesQuery.eq("reference", reference);
      notesQuery = notesQuery.eq("reference", reference);
      cardsQuery = cardsQuery.eq("reference", reference);
    }

    const [sourcesResult, notesResult, cardsResult] = await Promise.all([
      sourcesQuery,
      notesQuery,
      cardsQuery,
    ]);

    if (sourcesResult.error) {
      throw new Error(`research_sources read failed: ${sourcesResult.error.message}`);
    }

    if (notesResult.error) {
      throw new Error(`research_notes read failed: ${notesResult.error.message}`);
    }

    if (cardsResult.error) {
      throw new Error(`angle_cards read failed: ${cardsResult.error.message}`);
    }

    const sourceRows = ((sourcesResult.data ?? []) as unknown[])
      .map(compactLakeRow)
      .filter((row): row is Record<string, unknown> => row !== null);

    const noteRows = ((notesResult.data ?? []) as unknown[])
      .map(compactLakeRow)
      .filter((row): row is Record<string, unknown> => row !== null);

    const existingCards = ((cardsResult.data ?? []) as unknown[])
      .map(compactAngleCard)
      .filter((row): row is Record<string, unknown> => row !== null);

    if (sourceRows.length === 0 && noteRows.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: apply ? "apply" : "preview",
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        generator_model: generatorModel,
        evaluator_model: evaluatorModel,
        source_count: 0,
        note_count: 0,
        existing_card_count: existingCards.length,
        decisions: [],
        summary: "В Озере пока нет материалов для этого стиха.",
      });
    }

    const generationPrompt = buildGenerationPrompt({
      reference: effectiveReference,
      canonicalRef,
      lang,
      lakeSources: sourceRows,
      lakeNotes: noteRows,
      existingCards,
      maxCandidates,
    });

    const generator = await callClaude({
      prompt: generationPrompt,
      model: generatorModel,
    });

    const generatedCandidates = normalizeGeneratedCandidates(generator.rawJson);

    if (generatedCandidates.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: apply ? "apply" : "preview",
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        generator_provider: generator.provider,
        generator_model: generator.model,
        evaluator_model: evaluatorModel,
        source_count: sourceRows.length,
        note_count: noteRows.length,
        existing_card_count: existingCards.length,
        generated_count: 0,
        evaluated_count: 0,
        decisions: [],
        raw_generation: truncate(generator.rawText, 1400),
        summary: "Claude не нашёл новых сильных кандидатов в Озере.",
      });
    }

    const evaluationPrompt = buildEvaluationPrompt({
      reference: effectiveReference,
      canonicalRef,
      lang,
      generatedCandidates,
      existingCards,
    });

    const evaluator = await callOpenAI({
      prompt: evaluationPrompt,
      model: evaluatorModel,
    });

    const evaluatedCandidates = normalizeEvaluationOutput(evaluator.rawJson);

    const now = new Date().toISOString();

    const decisions: Decision[] = evaluatedCandidates.map((candidate) => {
      const decision = decideCandidate(candidate);

      return {
        candidate: candidate.candidate,
        score_total: candidate.score_total,
        scores: candidate.scores,
        coverage_type: candidate.coverage_type,
        angle_summary: candidate.angle_summary,
        angle_relationship: candidate.angle_relationship,
        relationship_confidence: candidate.relationship_confidence,
        matched_card_id: candidate.matched_card_id,
        matched_card_title: candidate.matched_card_title,
        risk_level: candidate.risk_level,
        risk: candidate.risk,
        reason: candidate.reason,
        source_basis: candidate.source_basis,
        recommended_action: decision.recommended_action,
        suggestion_type: decision.suggestion_type,
        decision_reason: decision.decision_reason,
        applied: false,
        inserted_card_id: null,
        inserted_suggestion_id: null,
        error: null,
      };
    });

    if (apply) {
      for (const decision of decisions) {
        const evaluated: EvaluatedCandidate = {
          candidate: decision.candidate,
          score_total: decision.score_total,
          scores: decision.scores,
          coverage_type: decision.coverage_type,
          angle_summary: decision.angle_summary,
          angle_relationship: decision.angle_relationship,
          relationship_confidence: decision.relationship_confidence,
          matched_card_id: decision.matched_card_id,
          matched_card_title: decision.matched_card_title,
          risk_level: decision.risk_level,
          risk: decision.risk,
          reason: decision.reason,
          source_basis: decision.source_basis,
        };

        if (decision.recommended_action === "auto_add") {
          const inserted = await insertAngleCard({
            client,
            reference: effectiveReference,
            canonicalRef,
            bookKey: getString(body.book_key),
            book: getString(body.book),
            chapter: getNumber(body.chapter),
            verse: getNumber(body.verse),
            lang,
            candidate: evaluated,
            generator,
            evaluator,
            now,
          });

          decision.applied = inserted.error === null;
          decision.inserted_card_id = inserted.id;
          decision.error = inserted.error;
        }

        if (decision.recommended_action === "editorial_suggestion") {
          const inserted = await insertEditorialSuggestion({
            client,
            reference: effectiveReference,
            canonicalRef,
            bookKey: getString(body.book_key),
            book: getString(body.book),
            chapter: getNumber(body.chapter),
            verse: getNumber(body.verse),
            lang,
            candidate: evaluated,
            decision: {
              recommended_action: decision.recommended_action,
              suggestion_type: decision.suggestion_type,
              decision_reason: decision.decision_reason,
            },
            generator,
            evaluator,
            now,
          });

          decision.applied = inserted.error === null;
          decision.inserted_suggestion_id = inserted.id;
          decision.error = inserted.error;
        }

        if (decision.recommended_action === "auto_reject") {
          decision.applied = true;
        }
      }
    }

    const errorCount = decisions.filter((decision) => decision.error).length;
    const autoAddCount = decisions.filter(
      (decision) => decision.recommended_action === "auto_add",
    ).length;
    const suggestionCount = decisions.filter(
      (decision) => decision.recommended_action === "editorial_suggestion",
    ).length;
    const rejectCount = decisions.filter(
      (decision) => decision.recommended_action === "auto_reject",
    ).length;

    return NextResponse.json(
      {
        ok: errorCount === 0,
        mode: apply ? "apply" : "preview",
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        generator_provider: generator.provider,
        generator_model: generator.model,
        evaluator_provider: evaluator.provider,
        evaluator_model: evaluator.model,
        source_count: sourceRows.length,
        note_count: noteRows.length,
        existing_card_count: existingCards.length,
        generated_count: generatedCandidates.length,
        evaluated_count: evaluatedCandidates.length,
        auto_add_count: autoAddCount,
        editorial_suggestion_count: suggestionCount,
        auto_reject_count: rejectCount,
        applied_count: decisions.filter((decision) => decision.applied).length,
        error_count: errorCount,
        decisions,
      },
      { status: errorCount === 0 ? 200 : 207 },
    );
  } catch (error) {
    console.error("[RUN_AUTO_CURATOR] error", {
      reference,
      canonicalRef,
      lang,
      apply,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Run Auto Curator failed",
      },
      { status: 500 },
    );
  }
}
