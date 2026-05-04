import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutoCuratorPreviewBody = {
  reference?: string;
  canonical_ref?: string | null;
  lang?: string;
  provider?: string;
  model?: string;
  maxCandidates?: number;
};

type CandidateCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
};

type PreviewCandidate = {
  candidate: CandidateCard;
  score_total: number | null;
  angle_relationship:
    | "duplicate"
    | "stronger_version"
    | "sibling_angle"
    | "distinct_angle"
    | "uncertain";
  relationship_confidence: "low" | "medium" | "high";
  matched_card_id: string | null;
  matched_card_title: string | null;
  recommended_action: "auto_add" | "auto_reject" | "editorial_suggestion";
  suggestion_type:
    | "replacement"
    | "needs_review"
    | "locked_card_challenger"
    | "style_review"
    | "promote_candidate"
    | "duplicate_uncertain"
    | null;
  reason: string;
  risk_level: "low" | "medium" | "high" | "unknown";
  risk: string | null;
  source_basis: string | null;
};

type AutoCuratorModelOutput = {
  summary?: string;
  candidates?: unknown[];
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
    console.error("[AUTO_CURATOR_PREVIEW] ADMIN_SECRET is not configured");
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
      1400,
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

function normalizeRelationship(value: unknown): PreviewCandidate["angle_relationship"] {
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

function normalizeConfidence(value: unknown): PreviewCandidate["relationship_confidence"] {
  const text = getString(value);

  if (text === "low" || text === "medium" || text === "high") {
    return text;
  }

  return "medium";
}

function normalizeRiskLevel(value: unknown): PreviewCandidate["risk_level"] {
  const text = getString(value);

  if (text === "low" || text === "medium" || text === "high" || text === "unknown") {
    return text;
  }

  return "unknown";
}

function normalizeRecommendedAction(value: unknown): PreviewCandidate["recommended_action"] {
  const text = getString(value);

  if (text === "auto_add" || text === "auto_reject" || text === "editorial_suggestion") {
    return text;
  }

  return "editorial_suggestion";
}

function normalizeSuggestionType(value: unknown): PreviewCandidate["suggestion_type"] {
  const text = getString(value);

  if (
    text === "replacement" ||
    text === "needs_review" ||
    text === "locked_card_challenger" ||
    text === "style_review" ||
    text === "promote_candidate" ||
    text === "duplicate_uncertain"
  ) {
    return text;
  }

  return null;
}

function normalizeCandidate(value: unknown): PreviewCandidate | null {
  if (!isRecord(value)) return null;

  const cardSource = isRecord(value.candidate) ? value.candidate : value;

  const title = getString(cardSource.title);
  const teaser = getString(cardSource.teaser);
  const anchor = getString(cardSource.anchor);
  const whyItMatters =
    getString(cardSource.why_it_matters) ?? getString(cardSource.whyItMatters);

  if (!title || !teaser) return null;

  const rawScore = getNumber(value.score_total) ?? getNumber(value.score);
  const score = rawScore === null ? null : clampInt(rawScore, 0, 100);

  const relationship = normalizeRelationship(value.angle_relationship);
  const riskLevel = normalizeRiskLevel(value.risk_level);
  const action = normalizeRecommendedAction(value.recommended_action);

  return {
    candidate: {
      title,
      anchor,
      teaser,
      why_it_matters: whyItMatters,
    },
    score_total: score,
    angle_relationship: relationship,
    relationship_confidence: normalizeConfidence(value.relationship_confidence),
    matched_card_id: getString(value.matched_card_id),
    matched_card_title: getString(value.matched_card_title),
    recommended_action: action,
    suggestion_type: normalizeSuggestionType(value.suggestion_type),
    reason:
      getString(value.reason) ??
      "Auto Curator preview did not provide a reason.",
    risk_level: riskLevel,
    risk: getString(value.risk),
    source_basis: getString(value.source_basis),
  };
}

function normalizeModelOutput(value: unknown): {
  summary: string | null;
  candidates: PreviewCandidate[];
} {
  if (!isRecord(value)) return { summary: null, candidates: [] };

  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates = rawCandidates
    .map(normalizeCandidate)
    .filter((candidate): candidate is PreviewCandidate => candidate !== null);

  return {
    summary: getString(value.summary),
    candidates,
  };
}

function buildPrompt(args: {
  reference: string;
  canonicalRef: string | null;
  lang: string;
  lakeSources: Record<string, unknown>[];
  lakeNotes: Record<string, unknown>[];
  existingCards: Record<string, unknown>[];
  maxCandidates: number;
}): string {
  return `
You are Auto Curator Preview for Scriptura AI.

Your job is NOT to write a general Bible commentary.
Your job is to inspect the Research Lake materials for one verse and propose candidate insight cards.

CRITICAL PRODUCT GOAL:
A good Scriptura card should make a serious Bible reader think:
"Wow — I have read this verse before, but I never noticed THAT."

MODEL ROLE:
In this route, Claude is the discovery generator. Your strength here is finding strong, vivid candidate cards from Research Lake material.
You must still be careful with facts and avoid overclaiming, but your primary task is discovery-quality candidate generation.

Use the same strategic quality standard across all decisions:
- discovery / aha effect
- concrete textual anchor
- non-obvious observation
- specific to this verse
- faithful and cautious
- no unsupported language claims
- no generic moral lesson
- useful as a short public insight card

Automation-first decision rules:
1. New safe strong angle with score >= 74:
   recommended_action = "auto_add"
2. Weak card, generic card, or true duplicate:
   recommended_action = "auto_reject"
3. Stronger version of existing card, risky strong card, uncertain duplicate, or locked-card challenge:
   recommended_action = "editorial_suggestion"

Same-angle policy:
- duplicate: same anchor + same hidden observation + same meaning shift. Reject.
- stronger_version: same angle, but candidate is clearly better. Suggest replacement.
- sibling_angle: same broad theme, but different mechanism/anchor/example. Keep both if score >= 74.
- distinct_angle: new discovery. Keep if score >= 74.
- uncertain: use editorial_suggestion only when candidate is strong enough to deserve review.

Important:
- Do NOT silently replace active cards.
- Do NOT rewrite existing cards.
- This is preview only.
- Prefer fewer, stronger candidates.
- If the Lake has no useful material, return an empty candidates array.

Return ONLY valid JSON with this exact shape:
{
  "summary": "short summary of what you found",
  "candidates": [
    {
      "candidate": {
        "title": "...",
        "anchor": "...",
        "teaser": "...",
        "why_it_matters": "..."
      },
      "score_total": 0,
      "angle_relationship": "duplicate | stronger_version | sibling_angle | distinct_angle | uncertain",
      "relationship_confidence": "low | medium | high",
      "matched_card_id": null,
      "matched_card_title": null,
      "recommended_action": "auto_add | auto_reject | editorial_suggestion",
      "suggestion_type": "replacement | needs_review | locked_card_challenger | style_review | promote_candidate | duplicate_uncertain | null",
      "reason": "...",
      "risk_level": "low | medium | high | unknown",
      "risk": null,
      "source_basis": "which lake source/note this came from"
    }
  ]
}

Verse:
reference: ${args.reference}
canonical_ref: ${args.canonicalRef ?? "null"}
lang: ${args.lang}

Existing public/editorial cards:
${JSON.stringify(args.existingCards, null, 2)}

Research Lake sources:
${JSON.stringify(args.lakeSources, null, 2)}

Research Lake notes:
${JSON.stringify(args.lakeNotes, null, 2)}

Maximum candidates: ${args.maxCandidates}
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
      temperature: 0.35,
      system:
        "You are Claude serving as the discovery generator for Scriptura AI Auto Curator. Return only valid JSON. Do not include markdown fences.",
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

async function callModel(args: {
  provider: string;
  model: string;
  prompt: string;
}): Promise<ModelCallResult> {
  if (args.provider === "openai") {
    return callOpenAI({ prompt: args.prompt, model: args.model });
  }

  return callClaude({ prompt: args.prompt, model: args.model });
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

  let body: AutoCuratorPreviewBody = {};

  try {
    body = (await req.json()) as AutoCuratorPreviewBody;
  } catch {
    body = {};
  }

  const reference = getString(body.reference);
  const canonicalRef = getString(body.canonical_ref);
  const lang = getString(body.lang) ?? "ru";
  const provider = getString(body.provider) ?? "claude";
  const model =
    getString(body.model) ??
    (provider === "openai"
      ? process.env.OPENAI_EVALUATOR_MODEL ?? "gpt-5.5"
      : process.env.ANTHROPIC_GENERATOR_MODEL ?? "claude-sonnet-4-6");
  const maxCandidates = clampInt(body.maxCandidates ?? 5, 1, 8);

  if (!reference && !canonicalRef) {
    return NextResponse.json(
      { ok: false, error: "Missing reference or canonical_ref" },
      { status: 400 },
    );
  }

  const effectiveReference = reference ?? canonicalRef ?? "";

  try {
    let sourcesQuery = client
      .from("research_sources")
      .select("*")
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(12);

    let notesQuery = client
      .from("research_notes")
      .select("*")
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(24);

    let cardsQuery = client
      .from("angle_cards")
      .select("*")
      .eq("lang", lang)
      .order("score_total", { ascending: false, nullsFirst: false })
      .limit(80);

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
        mode: "preview_only",
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        provider,
        model,
        source_count: 0,
        note_count: 0,
        existing_card_count: existingCards.length,
        summary: "В Озере пока нет материалов для этого стиха.",
        candidates: [],
      });
    }

    const prompt = buildPrompt({
      reference: effectiveReference,
      canonicalRef,
      lang,
      lakeSources: sourceRows,
      lakeNotes: noteRows,
      existingCards,
      maxCandidates,
    });

    const ai = await callModel({ provider, prompt, model });
    const normalized = normalizeModelOutput(ai.rawJson);

    return NextResponse.json({
      ok: true,
      mode: "preview_only",
      reference: effectiveReference,
      canonical_ref: canonicalRef,
      lang,
      provider: ai.provider,
      model: ai.model,
      generator_provider: ai.provider,
      generator_model: ai.model,
      source_count: sourceRows.length,
      note_count: noteRows.length,
      existing_card_count: existingCards.length,
      summary: normalized.summary,
      candidates: normalized.candidates,
      raw_preview:
        normalized.candidates.length === 0 ? truncate(ai.rawText, 1400) : undefined,
    });
  } catch (error) {
    console.error("[AUTO_CURATOR_PREVIEW] error", {
      reference,
      canonicalRef,
      lang,
      provider,
      model,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Auto Curator preview failed",
      },
      { status: 500 },
    );
  }
}
