import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getAllStudioCardsForVerse,
  saveAngleCard,
  type AngleCardCoverageType,
  type AngleCardRow,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type MaterialSelectionMode =
  | "recent"
  | "all"
  | "high_signal"
  | "unprocessed"
  | "selected_sources"
  | "manual_only";

type EvidenceLevel = "strong" | "medium" | "weak" | "unknown";
type RiskLevel = "low" | "medium" | "high" | "unknown";
type Certainty = "firm" | "cautious" | "hypothesis" | "research_only";
type NoveltyStatus =
  | "new"
  | "partially_covered"
  | "covered"
  | "duplicate"
  | "unclear";

type SuggestedNextUse =
  | "craft_candidate"
  | "reserve_only"
  | "editorial_suggestion"
  | "research_only"
  | "ignore";

type AngleRelationship =
  | "distinct_angle"
  | "safe_sibling_angle"
  | "sibling_angle"
  | "stronger_version"
  | "duplicate"
  | "uncertain";

type PreviewAction =
  | "auto_add_active_preview"
  | "auto_add_reserve_preview"
  | "editorial_suggestion_preview"
  | "auto_reject_preview";

type AppliedAction =
  | "inserted_active"
  | "inserted_reserve"
  | "inserted_editorial_suggestion"
  | "rejected_logged"
  | "skipped"
  | "failed";

type SourceRef = {
  source_type: string;
  id: string | null;
  title?: string | null;
  excerpt: string | null;
};

type DiscoverySignal = {
  signal_type: string;
  title: string;
  observation: string;
  textual_anchor: string | null;
  why_it_may_matter: string;
  evidence_level: EvidenceLevel;
  risk_level: RiskLevel;
  certainty: Certainty;
  novelty_status: NoveltyStatus;
  already_covered_by_card_ids: string[];
  rejected_related_card_ids: string[];
  source_refs: SourceRef[];
  suggested_next_use: SuggestedNextUse;
  reasoning_note: string | null;
};

type CandidateCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string;
  source_signal_titles: string[];
  certainty: Certainty;
  estimated_score: number | null;
  risk_level: RiskLevel;
  recommended_status: "active" | "reserve" | "reject";
  strength_reason: string | null;
  risk: string | null;
};

type CandidateEvaluation = {
  candidate_index: number;
  score_total: number | null;
  risk_level: RiskLevel;
  angle_relationship: AngleRelationship;
  matched_card_id: string | null;
  recommended_action:
    | "auto_add_active"
    | "auto_add_reserve"
    | "editorial_suggestion"
    | "auto_reject";
  reason: string | null;
  risk_note: string | null;
  duplicate_note: string | null;
};

type PreviewDecision = {
  candidate: CandidateCard;
  evaluation: CandidateEvaluation;
  preview_action: PreviewAction;
  would_write_to_database: boolean;
  applied_action?: AppliedAction | null;
  inserted_card_id?: string | null;
  inserted_suggestion_id?: string | null;
  apply_error?: string | null;
};

type ResearchRowsResult = {
  rows: Record<string, unknown>[];
  error: string | null;
};

type StoredDecisionPayload = {
  source: "discovery_enrichment_v1";
  candidate: CandidateCard;
  evaluation: CandidateEvaluation;
  preview_action: PreviewAction;
  source_signals: DiscoverySignal[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isMaterialSelectionMode(value: unknown): value is MaterialSelectionMode {
  return (
    value === "recent" ||
    value === "all" ||
    value === "high_signal" ||
    value === "unprocessed" ||
    value === "selected_sources" ||
    value === "manual_only"
  );
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[DISCOVERY_ENRICHMENT] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getModelName(provider: string): string {
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-5.4-mini";
  if (provider === "claude") return process.env.ANTHROPIC_MODEL || "claude";
  if (provider === "gemini") return process.env.GEMINI_MODEL || "gemini";
  return provider;
}

function chooseProvider(body: unknown, envName: string, fallback: Provider): Provider {
  if (isRecord(body) && isProvider(body.provider)) return body.provider;

  if (
    isRecord(body) &&
    envName === "DISCOVERY_EVALUATOR_PROVIDER" &&
    isProvider(body.evaluator_provider)
  ) {
    return body.evaluator_provider;
  }

  if (
    isRecord(body) &&
    envName === "DISCOVERY_SIGNAL_PROVIDER" &&
    isProvider(body.signal_provider)
  ) {
    return body.signal_provider;
  }

  if (
    isRecord(body) &&
    envName === "DISCOVERY_CRAFTER_PROVIDER" &&
    isProvider(body.crafter_provider)
  ) {
    return body.crafter_provider;
  }

  const envProvider = process.env[envName];
  if (isProvider(envProvider)) return envProvider;

  return fallback;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const raw = getNumber(value);
  if (raw === null) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function truncate(value: string, max = 900): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function stringifyPreview(value: unknown, max = 900): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return truncate(value, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return truncate(JSON.stringify(value), max);
  } catch {
    return null;
  }
}

function firstText(row: Record<string, unknown>, keys: string[], max = 1100): string | null {
  for (const key of keys) {
    const text = stringifyPreview(row[key], max);
    if (text) return text;
  }
  return null;
}

function normalizeEvidenceLevel(value: unknown): EvidenceLevel {
  if (value === "strong" || value === "medium" || value === "weak") return value;
  return "unknown";
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "unknown";
}

function normalizeCertainty(value: unknown): Certainty {
  if (
    value === "firm" ||
    value === "cautious" ||
    value === "hypothesis" ||
    value === "research_only"
  ) {
    return value;
  }
  return "cautious";
}

function normalizeNoveltyStatus(value: unknown): NoveltyStatus {
  if (
    value === "new" ||
    value === "partially_covered" ||
    value === "covered" ||
    value === "duplicate" ||
    value === "unclear"
  ) {
    return value;
  }
  return "unclear";
}

function normalizeSuggestedNextUse(value: unknown): SuggestedNextUse {
  if (
    value === "craft_candidate" ||
    value === "reserve_only" ||
    value === "editorial_suggestion" ||
    value === "research_only" ||
    value === "ignore"
  ) {
    return value;
  }
  return "research_only";
}

function normalizeRelationship(value: unknown): AngleRelationship {
  if (
    value === "distinct_angle" ||
    value === "safe_sibling_angle" ||
    value === "sibling_angle" ||
    value === "stronger_version" ||
    value === "duplicate" ||
    value === "uncertain"
  ) {
    return value;
  }
  return "uncertain";
}

function normalizePreviewAction(value: unknown): PreviewAction {
  if (
    value === "auto_add_active_preview" ||
    value === "auto_add_reserve_preview" ||
    value === "editorial_suggestion_preview" ||
    value === "auto_reject_preview"
  ) {
    return value;
  }
  return "editorial_suggestion_preview";
}

function cleanLabeledValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.toLowerCase() === "null" || cleaned === "—" || cleaned === "-") {
    return null;
  }
  return cleaned;
}

function parseCommaList(value: string | null | undefined): string[] {
  const cleaned = cleanLabeledValue(value);
  if (!cleaned) return [];

  return cleaned
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberText(value: string | null | undefined): number | null {
  const cleaned = cleanLabeledValue(value);
  if (!cleaned) return null;

  const match = /-?\d+(?:\.\d+)?/.exec(cleaned);
  if (!match) return null;

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function parseSourceRefsText(value: string | null | undefined): SourceRef[] {
  const cleaned = cleanLabeledValue(value);
  if (!cleaned) return [];

  return cleaned
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());

      if (parts.length >= 4) {
        return {
          source_type: parts[0] || "unknown",
          id: parts[1] && parts[1].toLowerCase() !== "null" ? parts[1] : null,
          title: parts[2] && parts[2].toLowerCase() !== "null" ? parts[2] : null,
          excerpt: parts.slice(3).join(" | ") || null,
        } satisfies SourceRef;
      }

      return {
        source_type: "note",
        id: null,
        title: null,
        excerpt: line,
      } satisfies SourceRef;
    });
}

function parseLabeledBlocks(raw: string, blockName: string): string[] {
  const start = `---${blockName}---`;
  const end = `---END_${blockName}---`;
  const pattern = new RegExp(`${start}([\\s\\S]*?)${end}`, "g");
  return [...raw.matchAll(pattern)].map((match) => match[1] ?? "");
}

function parseFields(block: string, labels: Set<string>): Record<string, string> {
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const match = /^([A-Z_]+)\s*:\s*(.*)$/.exec(line.trim());

    if (match && labels.has(match[1])) {
      currentKey = match[1];
      fields[currentKey] = match[2] ?? "";
      continue;
    }

    if (currentKey && line.trim()) {
      fields[currentKey] = `${fields[currentKey]}\n${line.trim()}`.trim();
    }
  }

  return fields;
}

function parseSignalBlock(block: string, index: number): DiscoverySignal | null {
  const labels = new Set([
    "SIGNAL_TYPE",
    "TITLE",
    "OBSERVATION",
    "TEXTUAL_ANCHOR",
    "WHY_IT_MAY_MATTER",
    "EVIDENCE_LEVEL",
    "RISK_LEVEL",
    "CERTAINTY",
    "NOVELTY_STATUS",
    "ALREADY_COVERED_BY_CARD_IDS",
    "REJECTED_RELATED_CARD_IDS",
    "SOURCE_REFS",
    "SUGGESTED_NEXT_USE",
    "REASONING_NOTE",
  ]);

  const fields = parseFields(block, labels);
  const title = cleanLabeledValue(fields.TITLE);
  const observation = cleanLabeledValue(fields.OBSERVATION);
  const why = cleanLabeledValue(fields.WHY_IT_MAY_MATTER);

  if (!title || !observation || !why) return null;

  return {
    signal_type: cleanLabeledValue(fields.SIGNAL_TYPE) ?? `signal_${index + 1}`,
    title,
    observation,
    textual_anchor: cleanLabeledValue(fields.TEXTUAL_ANCHOR),
    why_it_may_matter: why,
    evidence_level: normalizeEvidenceLevel(cleanLabeledValue(fields.EVIDENCE_LEVEL)),
    risk_level: normalizeRiskLevel(cleanLabeledValue(fields.RISK_LEVEL)),
    certainty: normalizeCertainty(cleanLabeledValue(fields.CERTAINTY)),
    novelty_status: normalizeNoveltyStatus(cleanLabeledValue(fields.NOVELTY_STATUS)),
    already_covered_by_card_ids: parseCommaList(fields.ALREADY_COVERED_BY_CARD_IDS),
    rejected_related_card_ids: parseCommaList(fields.REJECTED_RELATED_CARD_IDS),
    source_refs: parseSourceRefsText(fields.SOURCE_REFS),
    suggested_next_use: normalizeSuggestedNextUse(cleanLabeledValue(fields.SUGGESTED_NEXT_USE)),
    reasoning_note: cleanLabeledValue(fields.REASONING_NOTE),
  };
}

function parseSignalResponse(raw: string): {
  signals: DiscoverySignal[];
  empty_reason: string | null;
  overall_assessment: string | null;
} {
  const overallMatch = /OVERALL_ASSESSMENT\s*:\s*([\s\S]*?)(?=\nEMPTY_REASON\s*:|\n---SIGNAL---|$)/i.exec(raw);
  const emptyMatch = /EMPTY_REASON\s*:\s*([\s\S]*?)(?=\nOVERALL_ASSESSMENT\s*:|\n---SIGNAL---|$)/i.exec(raw);
  const signals = parseLabeledBlocks(raw, "SIGNAL")
    .map((block, index) => parseSignalBlock(block, index))
    .filter((signal): signal is DiscoverySignal => signal !== null);

  return {
    signals,
    empty_reason: cleanLabeledValue(emptyMatch?.[1]),
    overall_assessment: cleanLabeledValue(overallMatch?.[1]),
  };
}

function parseCandidateBlock(block: string): CandidateCard | null {
  const labels = new Set([
    "TITLE",
    "ANCHOR",
    "TEASER",
    "WHY_IT_MATTERS",
    "SOURCE_SIGNAL_TITLES",
    "CERTAINTY",
    "ESTIMATED_SCORE",
    "RISK_LEVEL",
    "RECOMMENDED_STATUS",
    "STRENGTH_REASON",
    "RISK",
  ]);

  const fields = parseFields(block, labels);
  const title = cleanLabeledValue(fields.TITLE);
  const teaser = cleanLabeledValue(fields.TEASER);
  const why = cleanLabeledValue(fields.WHY_IT_MATTERS);

  if (!title || !teaser || !why) return null;

  const statusValue = cleanLabeledValue(fields.RECOMMENDED_STATUS);
  const recommended_status =
    statusValue === "active" || statusValue === "reserve" || statusValue === "reject"
      ? statusValue
      : "reserve";

  return {
    title,
    anchor: cleanLabeledValue(fields.ANCHOR),
    teaser,
    why_it_matters: why,
    source_signal_titles: parseCommaList(fields.SOURCE_SIGNAL_TITLES),
    certainty: normalizeCertainty(cleanLabeledValue(fields.CERTAINTY)),
    estimated_score: parseNumberText(fields.ESTIMATED_SCORE),
    risk_level: normalizeRiskLevel(cleanLabeledValue(fields.RISK_LEVEL)),
    recommended_status,
    strength_reason: cleanLabeledValue(fields.STRENGTH_REASON),
    risk: cleanLabeledValue(fields.RISK),
  };
}

function parseCandidateResponse(raw: string): CandidateCard[] {
  return parseLabeledBlocks(raw, "CANDIDATE")
    .map(parseCandidateBlock)
    .filter((candidate): candidate is CandidateCard => candidate !== null);
}

function parseEvaluationBlock(block: string, fallbackIndex: number): CandidateEvaluation | null {
  const labels = new Set([
    "CANDIDATE_INDEX",
    "SCORE_TOTAL",
    "RISK_LEVEL",
    "ANGLE_RELATIONSHIP",
    "MATCHED_CARD_ID",
    "RECOMMENDED_ACTION",
    "REASON",
    "RISK_NOTE",
    "DUPLICATE_NOTE",
  ]);

  const fields = parseFields(block, labels);
  const indexNumber = parseNumberText(fields.CANDIDATE_INDEX);
  const action = cleanLabeledValue(fields.RECOMMENDED_ACTION);

  const recommended_action =
    action === "auto_add_active" ||
    action === "auto_add_reserve" ||
    action === "editorial_suggestion" ||
    action === "auto_reject"
      ? action
      : "editorial_suggestion";

  return {
    candidate_index: indexNumber ?? fallbackIndex + 1,
    score_total: parseNumberText(fields.SCORE_TOTAL),
    risk_level: normalizeRiskLevel(cleanLabeledValue(fields.RISK_LEVEL)),
    angle_relationship: normalizeRelationship(cleanLabeledValue(fields.ANGLE_RELATIONSHIP)),
    matched_card_id: cleanLabeledValue(fields.MATCHED_CARD_ID),
    recommended_action,
    reason: cleanLabeledValue(fields.REASON),
    risk_note: cleanLabeledValue(fields.RISK_NOTE),
    duplicate_note: cleanLabeledValue(fields.DUPLICATE_NOTE),
  };
}

function parseEvaluationResponse(raw: string): CandidateEvaluation[] {
  return parseLabeledBlocks(raw, "DECISION")
    .map((block, index) => parseEvaluationBlock(block, index))
    .filter((decision): decision is CandidateEvaluation => decision !== null);
}

function normalizeCandidateFromPayload(value: unknown): CandidateCard | null {
  if (!isRecord(value)) return null;
  const title = getString(value.title);
  const teaser = getString(value.teaser);
  const why = getString(value.why_it_matters);
  if (!title || !teaser || !why) return null;

  const status = getString(value.recommended_status);

  return {
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters: why,
    source_signal_titles: normalizeStringArray(value.source_signal_titles),
    certainty: normalizeCertainty(value.certainty),
    estimated_score: getNumber(value.estimated_score),
    risk_level: normalizeRiskLevel(value.risk_level),
    recommended_status:
      status === "active" || status === "reserve" || status === "reject" ? status : "reserve",
    strength_reason: getString(value.strength_reason),
    risk: getString(value.risk),
  };
}

function normalizeEvaluationFromPayload(value: unknown, row: Record<string, unknown>): CandidateEvaluation | null {
  const source = isRecord(value) ? value : {};
  const action = getString(source.recommended_action ?? row.recommended_action);

  const recommended_action =
    action === "auto_add_active" ||
    action === "auto_add_reserve" ||
    action === "editorial_suggestion" ||
    action === "auto_reject"
      ? action
      : "editorial_suggestion";

  return {
    candidate_index: getNumber(source.candidate_index) ?? 1,
    score_total: getNumber(source.score_total ?? row.score_total),
    risk_level: normalizeRiskLevel(source.risk_level ?? row.risk_level),
    angle_relationship: normalizeRelationship(source.angle_relationship ?? row.angle_relationship),
    matched_card_id: getString(source.matched_card_id ?? row.matched_card_id),
    recommended_action,
    reason: getString(source.reason ?? row.reason ?? row.decision_reason),
    risk_note: getString(source.risk_note),
    duplicate_note: getString(source.duplicate_note),
  };
}

function normalizeSignalsFromPayload(value: unknown): DiscoverySignal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const title = getString(item.title);
      const observation = getString(item.observation);
      const why = getString(item.why_it_may_matter);
      if (!title || !observation || !why) return null;

      return {
        signal_type: getString(item.signal_type) ?? `signal_${index + 1}`,
        title,
        observation,
        textual_anchor: getString(item.textual_anchor),
        why_it_may_matter: why,
        evidence_level: normalizeEvidenceLevel(item.evidence_level),
        risk_level: normalizeRiskLevel(item.risk_level),
        certainty: normalizeCertainty(item.certainty),
        novelty_status: normalizeNoveltyStatus(item.novelty_status),
        already_covered_by_card_ids: normalizeStringArray(item.already_covered_by_card_ids),
        rejected_related_card_ids: normalizeStringArray(item.rejected_related_card_ids),
        source_refs: [],
        suggested_next_use: normalizeSuggestedNextUse(item.suggested_next_use),
        reasoning_note: getString(item.reasoning_note),
      } satisfies DiscoverySignal;
    })
    .filter((item): item is DiscoverySignal => item !== null);
}

function previewDecisionFromCuratorRow(row: Record<string, unknown>): PreviewDecision | null {
  const payload = row.candidate_payload;
  const payloadRecord = isRecord(payload) ? payload : null;

  const candidate = normalizeCandidateFromPayload(
    payloadRecord && isRecord(payloadRecord.candidate) ? payloadRecord.candidate : payload,
  );

  if (!candidate) return null;

  const evaluation = normalizeEvaluationFromPayload(
    payloadRecord && isRecord(payloadRecord.evaluation) ? payloadRecord.evaluation : null,
    row,
  );

  if (!evaluation) return null;

  const previewAction = normalizePreviewAction(
    payloadRecord?.preview_action ?? computePreviewAction(evaluation),
  );

  return {
    candidate,
    evaluation,
    preview_action: previewAction,
    would_write_to_database: true,
    applied_action: null,
    inserted_card_id: null,
    inserted_suggestion_id: null,
    apply_error: null,
  };
}

function signalsFromStoredCandidatePayload(payload: unknown): DiscoverySignal[] {
  if (!isRecord(payload)) return [];
  return normalizeSignalsFromPayload(payload.source_signals);
}

async function readResearchRows(args: {
  table: "research_sources" | "research_notes";
  reference: string;
  canonical_ref: string | null;
  lang: Lang;
  limit: number;
  mode: MaterialSelectionMode;
  selectedIds: string[];
}): Promise<ResearchRowsResult> {
  const client = createAdminClient();

  if (!client) return { rows: [], error: "supabase_not_configured" };
  if (args.mode === "manual_only") return { rows: [], error: null };

  try {
    let query = client.from(args.table).select("*").eq("lang", args.lang);

    if (args.mode === "selected_sources" && args.selectedIds.length > 0) {
      query = query.in("id", args.selectedIds);
    } else if (args.canonical_ref) {
      query = query.eq("canonical_ref", args.canonical_ref);
    } else {
      query = query.eq("reference", args.reference);
    }

    if (args.mode === "high_signal" && args.table === "research_notes") {
      query = query
        .in("candidate_status", ["approved", "candidate", "strong_signal"])
        .order("score", { ascending: false, nullsFirst: false });
    } else if (args.mode === "unprocessed" && args.table === "research_notes") {
      query = query
        .in("candidate_status", ["new", "unprocessed", "pending"])
        .order("updated_at", { ascending: false });
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query.limit(args.limit);

    if (error) return { rows: [], error: error.message };

    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

    if (rows.length > 0 || !args.canonical_ref || args.mode === "selected_sources") {
      return { rows, error: null };
    }

    const fallback = await client
      .from(args.table)
      .select("*")
      .eq("lang", args.lang)
      .eq("reference", args.reference)
      .order("updated_at", { ascending: false })
      .limit(args.limit);

    if (fallback.error) return { rows: [], error: fallback.error.message };

    return {
      rows: Array.isArray(fallback.data)
        ? (fallback.data as Record<string, unknown>[])
        : rows,
      error: null,
    };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : `Failed to read ${args.table}`,
    };
  }
}

function formatCardForPrompt(card: AngleCardRow, index: number): string {
  const effectiveScore = (card.score_total ?? 0) + (card.moderator_boost ?? 0);
  const source = card.source_model?.replace("article_extractor_v1:", "") || card.source_type;

  return [
    `#${index + 1}`,
    `id: ${card.id}`,
    `status: ${card.status}`,
    `score_total: ${card.score_total ?? "null"}`,
    `effective_score: ${effectiveScore}`,
    card.is_locked ? "locked: true" : null,
    card.moderator_note ? `moderator_note: ${card.moderator_note}` : null,
    `title: ${card.title}`,
    card.anchor ? `anchor: ${card.anchor}` : null,
    `teaser: ${truncate(card.teaser, 620)}`,
    card.why_it_matters ? `why_it_matters: ${truncate(card.why_it_matters, 420)}` : null,
    card.angle_summary ? `angle_summary: ${truncate(card.angle_summary, 360)}` : null,
    card.coverage_type ? `coverage_type: ${card.coverage_type}` : null,
    source ? `source: ${source}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatResearchSource(row: Record<string, unknown>, index: number): string {
  const id = getString(row.id) ?? `source_${index + 1}`;
  const title = getString(row.title) ?? "Untitled source";
  const kind = getString(row.source_kind) ?? "unknown";
  const type = getString(row.source_type);
  const body =
    firstText(row, [
      "content_text",
      "raw_text",
      "body",
      "article_text",
      "source_text",
      "summary",
      "description",
      "metadata",
      "raw_json",
    ]) ?? "No text preview available.";

  return [
    `#${index + 1}`,
    `id: ${id}`,
    `title: ${title}`,
    `kind: ${kind}`,
    type ? `type: ${type}` : null,
    `excerpt: ${body}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatResearchNote(row: Record<string, unknown>, index: number): string {
  const id = getString(row.id) ?? `note_${index + 1}`;
  const title = getString(row.title) ?? getString(row.kicker) ?? "Untitled note";
  const noteKind = getString(row.note_kind) ?? "unknown";
  const lens = getString(row.lens_id);
  const status = getString(row.candidate_status);
  const score = getNumber(row.score);
  const anchor = getString(row.anchor);
  const body =
    firstText(row, [
      "body_preview",
      "summary",
      "body",
      "note_text",
      "content_text",
      "metadata",
      "raw_json",
    ]) ?? "No note preview available.";

  return [
    `#${index + 1}`,
    `id: ${id}`,
    `title: ${title}`,
    `note_kind: ${noteKind}`,
    lens ? `lens: ${lens}` : null,
    status ? `candidate_status: ${status}` : null,
    score === null ? null : `score: ${score}`,
    anchor ? `anchor: ${anchor}` : null,
    `excerpt: ${body}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatManualMaterial(material: string | null): string {
  if (!material) return "No manual material supplied.";
  return truncate(material, 5000);
}

function buildDetectionPrompt(args: {
  reference: string;
  canonical_ref: string | null;
  verseText: string | null;
  lang: Lang;
  existingCards: AngleCardRow[];
  researchSources: Record<string, unknown>[];
  researchNotes: Record<string, unknown>[];
  manualMaterial: string | null;
  materialSelectionMode: MaterialSelectionMode;
  maxSignals: number;
}): string {
  const langLabel =
    args.lang === "ru" ? "Russian" : args.lang === "es" ? "Spanish" : "English";

  const activeAndReserve = args.existingCards.filter(
    (card) => card.status === "featured" || card.status === "reserve",
  );
  const rejectedOrHidden = args.existingCards.filter(
    (card) => card.status === "rejected" || card.status === "hidden",
  );

  const existingCardsBlock =
    activeAndReserve.length > 0
      ? activeAndReserve
          .map((card, index) => formatCardForPrompt(card, index))
          .join("\n\n---\n\n")
      : "No active/reserve cards found.";

  const rejectedBlock =
    rejectedOrHidden.length > 0
      ? rejectedOrHidden
          .slice(0, 24)
          .map((card, index) => formatCardForPrompt(card, index))
          .join("\n\n---\n\n")
      : "No rejected/hidden cards found.";

  const sourcesBlock =
    args.researchSources.length > 0
      ? args.researchSources
          .map((row, index) => formatResearchSource(row, index))
          .join("\n\n---\n\n")
      : "No Research Lake sources found.";

  const notesBlock =
    args.researchNotes.length > 0
      ? args.researchNotes
          .map((row, index) => formatResearchNote(row, index))
          .join("\n\n---\n\n")
      : "No Research Lake notes found.";

  return `
You are Scriptura AI's Discovery Signal Detector.

Your task is NOT to write cards.
Your task is NOT to write public commentary.
Your task is to map research signals that may later become cards, reserve ideas, editorial suggestions, or research-only notes.

CRITICAL ROLE BOUNDARY:
Do not become a second Word Lens.
Do not let lexical/original-language observations dominate.
Lexical signals are allowed, but only after you have seriously searched for structure, rhetoric, agency, context, meaningful absence, and argument logic.

A discovery signal is a precise research lead:
- a structural movement,
- a rhetorical reversal,
- an argument function,
- a meaningful absence,
- an agency/logic shift,
- a context tension,
- a translation tension,
- a textual image,
- a lexical detail,
- an intertextual echo,
- or a risky but interesting hypothesis.

Product philosophy:
Scriptura AI is an editorial-research product. It may preserve hypotheses and tentative lines of thought, but it must label them clearly.
Do not kill every risky idea. Instead classify it:
- firm: directly visible in the text and low risk.
- cautious: plausible and useful, but needs careful wording.
- hypothesis: interesting and potentially valuable, but not safe as a public claim without caveats.
- research_only: useful for editors or future research, but not a card yet.

Never present hypotheses as facts.
Never overclaim original-language, intertextual, historical, or rabbinic background.
Do not create cards here.

VERSE:
reference: ${args.reference}
canonical_ref: ${args.canonical_ref ?? "null"}
language: ${langLabel}
verse_text:
${args.verseText?.trim() ? args.verseText.trim() : "[Verse text was not supplied. Use reference and existing materials only.]"}

MATERIAL SELECTION MODE:
${args.materialSelectionMode}

EXISTING ACTIVE / RESERVE CARDS:
${existingCardsBlock}

REJECTED / HIDDEN CARDS TO AVOID REPEATING:
${rejectedBlock}

RESEARCH LAKE SOURCES:
${sourcesBlock}

RESEARCH LAKE NOTES:
${notesBlock}

MANUAL MATERIAL:
${formatManualMaterial(args.manualMaterial)}

DISCOVERY SEARCH ORDER — FOLLOW THIS ORDER:

1. STRUCTURE / SEQUENCE
Ask: Does the verse move through stages? command → reason → promise? image → explanation → result? What would be lost if reordered?

2. RHETORIC / PARADOX
Ask: Does the verse sound like one thing but function as another? Does it create tension, reversal, or surprise?

3. AGENCY / LOGIC
Ask: Who acts? Who receives? Who initiates? Who finds? Who gives? Does the subject or agent shift across the verse or immediate context?

4. MEANINGFUL ABSENCE / COVERAGE GAP
Ask: What is expected but not stated? Is there a missing mechanism, missing explanation, missing curriculum, missing object, missing subject, or missing reason?

5. CONTEXT TENSION
Ask: Does the previous or next verse change this verse's function? Does this verse explain, qualify, intensify, or complicate the immediate context?

6. TRANSLATION / RENDERING
Ask: Do renderings change what a reader notices? Use cautiously.

7. LEXICAL / ORIGINAL-LANGUAGE
Ask only after the above: is there one word whose force matters? Maximum 1–2 lexical signals unless the verse truly demands more.

8. INTERTEXTUAL / HISTORICAL / RABBINIC BACKGROUND
Use only when genuinely useful. Mark as hypothesis or research_only unless strongly supported.

MANDATORY NON-LEXICAL DOUBLE CHECK:
Before final output, explicitly check these two patterns:

A. UNSTATED CONTENT / CURRICULUM CHECK
If the verse says “learn / seek / follow / ask / believe / act” but does not name the content, mechanism, or curriculum, consider this as a meaningful absence signal.
For Matthew 11:29-type wording, “learn from me” names the Teacher but may leave the curriculum unstated.

B. REASON-AS-ARGUMENT CHECK
If the verse contains “because / for / ибо / потому что”, ask whether the reason functions as an argument that makes an invitation, command, or promise trustworthy, rather than as mere description.
For Matthew 11:29-type wording, “because I am mild-tempered and lowly in heart” may function as the reason to trust the yoke.

PORTFOLIO REQUIREMENT:
Try to return ${Math.min(args.maxSignals, 8)} signals.
Unless impossible, include:
- at least 1 structure signal,
- at least 1 rhetoric/paradox signal,
- at least 1 agency/logic or context signal,
- at least 1 meaningful absence / coverage_gap signal,
- no more than 2 lexical/original-language signals.

Instructions:
1. Find up to ${args.maxSignals} strong discovery signals.
2. Prefer signals that can make the verse feel newly seen to a serious Bible reader.
3. Compare every signal with existing active/reserve cards:
   - mark "covered" or "partially_covered" when it overlaps.
   - include already_covered_by_card_ids when possible.
4. Compare every signal with rejected/hidden cards:
   - if a signal repeats a rejected idea, either avoid it or mark rejected_related_card_ids.
5. Keep useful risky signals, but label risk and certainty honestly.
6. Include signals that should become:
   - craft_candidate,
   - reserve_only,
   - editorial_suggestion,
   - research_only,
   - or ignore.
7. If no new signals are found, return no signals and explain empty_reason. This is useful, not an error.

OUTPUT FORMAT:
Return ONLY this plain text block format.
Do NOT return JSON.
Do NOT use markdown fences.
Use exactly these labels.
For SOURCE_REFS, use one or more lines in this format:
source_type | id-or-null | title-or-null | excerpt

OVERALL_ASSESSMENT: brief assessment of the verse's discovery potential and the main risks
EMPTY_REASON: null

---SIGNAL---
SIGNAL_TYPE: lexical | grammar | structure | rhetorical | intertextual | translation | context_tension | coverage_gap | risk_warning | other
TITLE: short human-readable title
OBSERVATION: what was noticed
TEXTUAL_ANCHOR: exact word/phrase if available, otherwise null
WHY_IT_MAY_MATTER: why this could matter for cards or research
EVIDENCE_LEVEL: strong | medium | weak | unknown
RISK_LEVEL: low | medium | high | unknown
CERTAINTY: firm | cautious | hypothesis | research_only
NOVELTY_STATUS: new | partially_covered | covered | duplicate | unclear
ALREADY_COVERED_BY_CARD_IDS: comma-separated ids or empty
REJECTED_RELATED_CARD_IDS: comma-separated ids or empty
SOURCE_REFS: verse_text | null | ${args.reference} | short excerpt
SUGGESTED_NEXT_USE: craft_candidate | reserve_only | editorial_suggestion | research_only | ignore
REASONING_NOTE: short explanation of why it is classified this way
---END_SIGNAL---

Repeat ---SIGNAL--- blocks for each signal.
`.trim();
}

function buildCandidatePrompt(args: {
  reference: string;
  verseText: string | null;
  lang: Lang;
  signals: DiscoverySignal[];
  existingCards: AngleCardRow[];
  maxCandidates: number;
}): string {
  const langLabel =
    args.lang === "ru" ? "Russian" : args.lang === "es" ? "Spanish" : "English";

  const signalsBlock = args.signals
    .map((signal, index) => {
      return [
        `#${index + 1}`,
        `type: ${signal.signal_type}`,
        `title: ${signal.title}`,
        `certainty: ${signal.certainty}`,
        `evidence: ${signal.evidence_level}`,
        `risk: ${signal.risk_level}`,
        `novelty: ${signal.novelty_status}`,
        `suggested_next_use: ${signal.suggested_next_use}`,
        signal.textual_anchor ? `anchor: ${signal.textual_anchor}` : null,
        `observation: ${signal.observation}`,
        `why: ${signal.why_it_may_matter}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  const existingCardsBlock =
    args.existingCards.length > 0
      ? args.existingCards
          .map((card, index) => formatCardForPrompt(card, index))
          .join("\n\n---\n\n")
      : "No existing cards found.";

  return `
You are Scriptura AI's Pearl Crafter working from Discovery Signals.

Your task is to create candidate Pearl cards from the signal log.
Do not save anything. This is preview-only.

FINAL OUTPUT LANGUAGE:
${langLabel}

VERSE:
${args.reference}

VERSE TEXT:
${args.verseText?.trim() ? args.verseText.trim() : "[Verse text was not supplied.]"}

DISCOVERY SIGNALS:
${signalsBlock || "No signals supplied."}

EXISTING CARDS TO AVOID DUPLICATING:
${existingCardsBlock}

PRODUCT PHILOSOPHY:
Scriptura AI is not a dry encyclopedia. It is an editorial-research system that helps serious readers discover non-obvious angles.
Risky signals are allowed, but overclaim is not allowed.
A hypothesis may become a candidate only if it is clearly worded as a hypothesis.

CARD RULES:
- Do not write generic commentary.
- Do not preach.
- Do not summarize the verse.
- Do not create a card from every signal.
- Prefer fewer stronger cards.
- Do not duplicate existing cards.
- Preserve uncertainty: firm, cautious, hypothesis, or research_only.
- If a signal is only research_only, do not turn it into a public-style factual card.
- If two signals overlap, combine them into one stronger candidate rather than creating duplicates.

QUALITY BAR:
A good card should make a serious reader think: “I have read this verse before, but I never noticed THAT.”

Return up to ${args.maxCandidates} candidate cards.
If no signal deserves a card, return no candidate blocks.

OUTPUT FORMAT:
Return ONLY labeled blocks. Do NOT return JSON. Do NOT use markdown fences.

---CANDIDATE---
TITLE: sharp discovery-driven title, not a topic
ANCHOR: exact word/phrase/structure/context link, or null
TEASER: 2–3 sentences, starts with the discovery
WHY_IT_MATTERS: one sentence, perceptual shift, not moral lesson
SOURCE_SIGNAL_TITLES: comma-separated source signal titles
CERTAINTY: firm | cautious | hypothesis | research_only
ESTIMATED_SCORE: 0-100
RISK_LEVEL: low | medium | high | unknown
RECOMMENDED_STATUS: active | reserve | reject
STRENGTH_REASON: why this candidate is or is not strong
RISK: short risk note
---END_CANDIDATE---
`.trim();
}

function buildEvaluationPrompt(args: {
  reference: string;
  verseText: string | null;
  lang: Lang;
  candidates: CandidateCard[];
  existingCards: AngleCardRow[];
}): string {
  const langLabel =
    args.lang === "ru" ? "Russian" : args.lang === "es" ? "Spanish" : "English";

  const candidatesBlock = args.candidates
    .map((candidate, index) => {
      return [
        `#${index + 1}`,
        `title: ${candidate.title}`,
        candidate.anchor ? `anchor: ${candidate.anchor}` : null,
        `teaser: ${candidate.teaser}`,
        `why_it_matters: ${candidate.why_it_matters}`,
        `certainty: ${candidate.certainty}`,
        `estimated_score: ${candidate.estimated_score ?? "null"}`,
        `risk_level: ${candidate.risk_level}`,
        candidate.source_signal_titles.length > 0
          ? `source_signals: ${candidate.source_signal_titles.join(", ")}`
          : null,
        candidate.risk ? `candidate_risk_note: ${candidate.risk}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  const existingCardsBlock =
    args.existingCards.length > 0
      ? args.existingCards
          .map((card, index) => formatCardForPrompt(card, index))
          .join("\n\n---\n\n")
      : "No existing cards found.";

  return `
You are GPT-5.5-style Scriptura AI evaluator/verifier.

Evaluate candidate Pearl cards for one verse.
Do not rewrite cards.
Do not save anything.
Return preview decisions only.

OUTPUT LANGUAGE FOR REASONS:
${langLabel}

VERSE:
${args.reference}

VERSE TEXT:
${args.verseText?.trim() ? args.verseText.trim() : "[Verse text was not supplied.]"}

CANDIDATES:
${candidatesBlock || "No candidates supplied."}

EXISTING ACTIVE / RESERVE / HIDDEN / REJECTED CARDS:
${existingCardsBlock}

EVALUATION CRITERIA:
- discovery / wow effect;
- specific textual anchor;
- non-generic;
- not duplicate;
- not overclaim;
- risk level;
- relation to existing cards;
- whether it is safe to auto-add active, reserve, queue, or reject.

RELATIONSHIP VALUES:
- distinct_angle: genuinely new angle.
- safe_sibling_angle: related but safely distinct.
- sibling_angle: related and may need human review.
- stronger_version: may be better than an existing card.
- duplicate: same basic angle.
- uncertain: unclear relation.

ACTION RULES:
- auto_add_active: only if score >= 86, low risk, firm/cautious, distinct_angle, no matched card, safe for public.
- auto_add_reserve: score 74–85, low or medium-low risk, distinct_angle or safe_sibling_angle, useful but not top.
- editorial_suggestion: hypothesis, medium/high risk, stronger_version, matched existing card, uncertain duplicate, locked-card challenger, or needs human judgment.
- auto_reject: weak, generic, duplicate, too risky, or score below 74.

Return one DECISION block per candidate.
Do NOT return JSON. Do NOT use markdown fences.

---DECISION---
CANDIDATE_INDEX: 1-based candidate number
SCORE_TOTAL: 0-100
RISK_LEVEL: low | medium | high | unknown
ANGLE_RELATIONSHIP: distinct_angle | safe_sibling_angle | sibling_angle | stronger_version | duplicate | uncertain
MATCHED_CARD_ID: existing card id or null
RECOMMENDED_ACTION: auto_add_active | auto_add_reserve | editorial_suggestion | auto_reject
REASON: concise explanation
RISK_NOTE: short risk note or null
DUPLICATE_NOTE: duplicate/same-angle explanation or null
---END_DECISION---
`.trim();
}

function computePreviewAction(evaluation: CandidateEvaluation): PreviewAction {
  const score = evaluation.score_total ?? 0;

  if (
    evaluation.angle_relationship === "duplicate" ||
    evaluation.recommended_action === "auto_reject" ||
    score < 74
  ) {
    return "auto_reject_preview";
  }

  if (
    evaluation.recommended_action === "auto_add_active" &&
    score >= 86 &&
    evaluation.risk_level === "low" &&
    evaluation.angle_relationship === "distinct_angle" &&
    !evaluation.matched_card_id
  ) {
    return "auto_add_active_preview";
  }

  if (
    evaluation.recommended_action === "auto_add_reserve" &&
    score >= 74 &&
    score <= 85 &&
    (evaluation.risk_level === "low" || evaluation.risk_level === "unknown") &&
    (evaluation.angle_relationship === "distinct_angle" ||
      evaluation.angle_relationship === "safe_sibling_angle") &&
    !evaluation.matched_card_id
  ) {
    return "auto_add_reserve_preview";
  }

  return "editorial_suggestion_preview";
}

function fallbackEvaluation(candidate: CandidateCard, index: number): CandidateEvaluation {
  const score = candidate.estimated_score ?? 70;
  const relationship: AngleRelationship = "uncertain";

  let recommended_action: CandidateEvaluation["recommended_action"] = "editorial_suggestion";

  if (score < 74 || candidate.recommended_status === "reject") {
    recommended_action = "auto_reject";
  } else if (score >= 86 && candidate.risk_level === "low" && candidate.certainty === "firm") {
    recommended_action = "auto_add_active";
  } else if (score >= 74 && candidate.risk_level === "low") {
    recommended_action = "auto_add_reserve";
  }

  if (
    candidate.certainty === "hypothesis" ||
    candidate.risk_level === "medium" ||
    candidate.risk_level === "high"
  ) {
    recommended_action = score < 74 ? "auto_reject" : "editorial_suggestion";
  }

  return {
    candidate_index: index + 1,
    score_total: score,
    risk_level: candidate.risk_level,
    angle_relationship: relationship,
    matched_card_id: null,
    recommended_action,
    reason: "Fallback local routing because evaluator did not return a matching decision.",
    risk_note: candidate.risk,
    duplicate_note: null,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : null))
    .filter((item): item is string => Boolean(item));
}

function deriveVerseMeta(args: {
  reference: string;
  canonical_ref: string | null;
  normalized: ReturnType<typeof normalizeReference>;
  existingCards: AngleCardRow[];
}): {
  reference: string;
  canonical_ref: string | null;
  book_key: string | null;
  book: string;
  chapter: number;
  verse: number;
} | null {
  const firstCard = args.existingCards[0];

  if (firstCard) {
    return {
      reference: firstCard.reference || args.reference,
      canonical_ref: firstCard.canonical_ref ?? args.canonical_ref,
      book_key: firstCard.book_key ?? args.normalized.book_key ?? null,
      book: firstCard.book,
      chapter: firstCard.chapter,
      verse: firstCard.verse,
    };
  }

  const match = /^(.*?)[\s.]+(\d+)\s*[:.]\s*(\d+)\s*$/.exec(args.reference.trim());
  if (!match) return null;

  return {
    reference: args.reference,
    canonical_ref: args.canonical_ref,
    book_key: args.normalized.book_key ?? null,
    book: match[1].trim(),
    chapter: Number(match[2]),
    verse: Number(match[3]),
  };
}

function inferCoverageTypeFromSignals(
  candidate: CandidateCard,
  signals: DiscoverySignal[],
): AngleCardCoverageType {
  const titles = new Set(candidate.source_signal_titles.map((title) => title.toLowerCase()));
  const relatedSignals = signals.filter((signal) => titles.has(signal.title.toLowerCase()));
  const typeText = relatedSignals.map((signal) => signal.signal_type).join(" ").toLowerCase();

  if (/translation/.test(typeText)) return "translation";
  if (/grammar/.test(typeText)) return "grammatical";
  if (/structure/.test(typeText)) return "structural";
  if (/rhetoric|paradox/.test(typeText)) return "rhetorical";
  if (/context|agency|coverage_gap/.test(typeText)) return "contextual";
  if (/historical/.test(typeText)) return "historical";
  if (/lexical/.test(typeText)) return "lexical";

  return "conceptual";
}

function buildAngleSummary(candidate: CandidateCard, evaluation: CandidateEvaluation): string {
  return truncate(
    [
      candidate.strength_reason,
      evaluation.reason,
      candidate.source_signal_titles.length > 0
        ? `Signals: ${candidate.source_signal_titles.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    900,
  );
}

function getSuggestionType(evaluation: CandidateEvaluation): string {
  if (evaluation.angle_relationship === "stronger_version") return "replacement";
  if (evaluation.angle_relationship === "duplicate" || evaluation.angle_relationship === "uncertain") {
    return "duplicate_uncertain";
  }
  if (evaluation.risk_level === "high" || evaluation.risk_level === "medium") return "risk_review";
  if (evaluation.recommended_action === "auto_add_reserve") return "promote_candidate";
  return "needs_review";
}

function getMatchedCardScore(cards: AngleCardRow[], matchedCardId: string | null): number | null {
  if (!matchedCardId) return null;
  const card = cards.find((item) => item.id === matchedCardId);
  if (!card || typeof card.score_total !== "number") return null;
  return card.score_total + (card.moderator_boost ?? 0);
}

async function insertEditorialSuggestion(args: {
  reference: string;
  canonical_ref: string | null;
  normalized: ReturnType<typeof normalizeReference>;
  lang: Lang;
  candidate: CandidateCard;
  evaluation: CandidateEvaluation;
  existingCards: AngleCardRow[];
  signals: DiscoverySignal[];
  crafterProvider: Provider;
  crafterModel: string;
  evaluatorProvider: Provider;
  evaluatorModel: string;
}): Promise<{ id: string | null; error: string | null }> {
  const client = createAdminClient();
  if (!client) return { id: null, error: "Supabase admin client unavailable" };

  const meta = deriveVerseMeta({
    reference: args.reference,
    canonical_ref: args.canonical_ref,
    normalized: args.normalized,
    existingCards: args.existingCards,
  });

  if (!meta) return { id: null, error: "Could not derive verse metadata for suggestion" };

  const scoreCandidate = args.evaluation.score_total;
  const scoreExisting = getMatchedCardScore(args.existingCards, args.evaluation.matched_card_id);

  const payload = {
    reference: meta.reference,
    canonical_ref: meta.canonical_ref,
    book_key: meta.book_key,
    book: meta.book,
    chapter: meta.chapter,
    verse: meta.verse,
    lang: args.lang,
    suggestion_type: getSuggestionType(args.evaluation),
    status: "pending",
    existing_card_id: args.evaluation.matched_card_id,
    candidate_card_id: null,
    candidate_payload: {
      source: "discovery_enrichment_v1",
      candidate: args.candidate,
      evaluation: args.evaluation,
      source_signals: args.signals.filter((signal) =>
        args.candidate.source_signal_titles.includes(signal.title),
      ),
    },
    score_existing: scoreExisting,
    score_candidate: scoreCandidate,
    score_delta:
      typeof scoreCandidate === "number" && typeof scoreExisting === "number"
        ? scoreCandidate - scoreExisting
        : null,
    angle_relationship: args.evaluation.angle_relationship,
    relationship_confidence: null,
    same_angle_summary: args.evaluation.duplicate_note,
    matched_card_id: args.evaluation.matched_card_id,
    reason: args.evaluation.reason,
    risk: args.evaluation.risk_note ?? args.candidate.risk,
    risk_level: args.evaluation.risk_level,
    source_summary: args.candidate.source_signal_titles.join(", ") || null,
    source_id: null,
    note_id: null,
    provider: args.crafterProvider,
    model: args.crafterModel,
    evaluator_version: args.evaluatorModel,
    decision_engine_version: "discovery_enrichment_same_run_apply_v1",
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    moderator_decision: null,
  };

  const { data, error } = await client
    .from("editorial_suggestions")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: (data as { id?: string } | null)?.id ?? null, error: null };
}

async function insertAngleCardFromDecision(args: {
  reference: string;
  canonical_ref: string | null;
  normalized: ReturnType<typeof normalizeReference>;
  lang: Lang;
  status: "featured" | "reserve";
  candidate: CandidateCard;
  evaluation: CandidateEvaluation;
  existingCards: AngleCardRow[];
  signals: DiscoverySignal[];
  crafterProvider: Provider;
  crafterModel: string;
  evaluatorProvider: Provider;
  evaluatorModel: string;
}): Promise<{ id: string | null; error: string | null }> {
  const meta = deriveVerseMeta({
    reference: args.reference,
    canonical_ref: args.canonical_ref,
    normalized: args.normalized,
    existingCards: args.existingCards,
  });

  if (!meta) return { id: null, error: "Could not derive verse metadata for card insert" };

  const saved = await saveAngleCard({
    reference: meta.reference,
    book: meta.book,
    chapter: meta.chapter,
    verse: meta.verse,
    lang: args.lang,
    canonical_ref: meta.canonical_ref,
    book_key: meta.book_key,
    title: args.candidate.title,
    anchor: args.candidate.anchor,
    teaser: args.candidate.teaser,
    why_it_matters: args.candidate.why_it_matters,
    angle_summary: buildAngleSummary(args.candidate, args.evaluation),
    coverage_type: inferCoverageTypeFromSignals(args.candidate, args.signals),
    score_total: args.evaluation.score_total,
    scores: null,
    evaluation: {
      source: "discovery_enrichment_v1",
      candidate_certainty: args.candidate.certainty,
      candidate_estimated_score: args.candidate.estimated_score,
      evaluator: args.evaluation,
      source_signal_titles: args.candidate.source_signal_titles,
    },
    battle: {
      angle_relationship: args.evaluation.angle_relationship,
      matched_card_id: args.evaluation.matched_card_id,
      duplicate_note: args.evaluation.duplicate_note,
    },
    status: args.status,
    rank: args.status === "featured" ? 999 : null,
    is_locked: false,
    source_type: "discovery_enrichment",
    source_provider: args.crafterProvider,
    source_model: `discovery_enrichment:${args.crafterModel}`,
    editor_provider: args.evaluatorProvider,
    editor_model: args.evaluatorModel,
    original_card: {
      candidate: args.candidate,
      source_signals: args.signals.filter((signal) =>
        args.candidate.source_signal_titles.includes(signal.title),
      ),
    },
    prompt_version: "discovery_enrichment_v1",
  });

  return { id: saved.id, error: saved.error };
}

async function insertCuratorRun(args: {
  reference: string;
  canonical_ref: string | null;
  lang: Lang;
  signalProvider: Provider;
  signalModel: string;
  crafterProvider: Provider;
  crafterModel: string;
  evaluatorProvider: Provider;
  evaluatorModel: string;
  apply: boolean;
  counts: Record<string, number>;
}): Promise<string | null> {
  const client = createAdminClient();
  if (!client) return null;

  const now = new Date().toISOString();

  try {
    const { data, error } = await client
      .from("curator_runs")
      .insert({
        reference: args.reference,
        canonical_ref: args.canonical_ref,
        lang: args.lang,
        source_mode: "discovery_enrichment",
        generator_provider: args.crafterProvider,
        generator_model: args.crafterModel,
        evaluator_provider: args.evaluatorProvider,
        evaluator_model: args.evaluatorModel,
        mode: args.apply ? "apply" : "preview",
        status: args.apply ? "completed" : "preview_ready",
        auto_add_active_count: args.counts.inserted_active ?? args.counts.auto_add_active_preview ?? 0,
        auto_add_reserve_count: args.counts.inserted_reserve ?? args.counts.auto_add_reserve_preview ?? 0,
        editorial_suggestion_count:
          args.counts.inserted_editorial_suggestion ?? args.counts.editorial_suggestion_preview ?? 0,
        auto_reject_count: args.counts.rejected_logged ?? args.counts.auto_reject_preview ?? 0,
        error_count: args.counts.failed ?? 0,
        summary: `Discovery enrichment ${args.apply ? "apply" : "preview"}: ${JSON.stringify(args.counts)}`,
        started_at: now,
        completed_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) return null;
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function insertCuratorDecision(args: {
  runId: string | null;
  reference: string;
  canonical_ref: string | null;
  lang: Lang;
  decision: PreviewDecision;
  signals: DiscoverySignal[];
}): Promise<string | null> {
  if (!args.runId) return null;

  const client = createAdminClient();
  if (!client) return null;

  const sourceSignals = args.signals.filter((signal) =>
    args.decision.candidate.source_signal_titles.includes(signal.title),
  );

  const storedPayload: StoredDecisionPayload = {
    source: "discovery_enrichment_v1",
    candidate: args.decision.candidate,
    evaluation: args.decision.evaluation,
    preview_action: args.decision.preview_action,
    source_signals: sourceSignals,
  };

  try {
    const { data, error } = await client
      .from("curator_decisions")
      .insert({
        run_id: args.runId,
        reference: args.reference,
        canonical_ref: args.canonical_ref,
        lang: args.lang,
        candidate_payload: storedPayload,
        score_total: args.decision.evaluation.score_total,
        risk_level: args.decision.evaluation.risk_level,
        angle_relationship: args.decision.evaluation.angle_relationship,
        matched_card_id: args.decision.evaluation.matched_card_id,
        recommended_action: args.decision.evaluation.recommended_action,
        applied_action: args.decision.applied_action ?? "report_only",
        inserted_card_id: args.decision.inserted_card_id ?? null,
        inserted_suggestion_id: args.decision.inserted_suggestion_id ?? null,
        reason: args.decision.evaluation.reason,
        decision_reason: args.decision.evaluation.reason,
        error: args.decision.apply_error ?? null,
      })
      .select("id")
      .single();

    if (error) return null;
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function updateCuratorDecisionAfterApply(args: {
  decisionId: string;
  decision: PreviewDecision;
}): Promise<void> {
  const client = createAdminClient();
  if (!client) return;

  try {
    await client
      .from("curator_decisions")
      .update({
        applied_action: args.decision.applied_action ?? "skipped",
        inserted_card_id: args.decision.inserted_card_id ?? null,
        inserted_suggestion_id: args.decision.inserted_suggestion_id ?? null,
        error: args.decision.apply_error ?? null,
      })
      .eq("id", args.decisionId);
  } catch {
    // Audit update should not hide a successful card/suggestion insert.
  }
}

async function updateCuratorRunAfterStoredApply(args: {
  runId: string;
  counts: Record<string, number>;
}): Promise<void> {
  const client = createAdminClient();
  if (!client) return;

  const now = new Date().toISOString();

  try {
    await client
      .from("curator_runs")
      .update({
        mode: "apply",
        status: "applied",
        auto_add_active_count: args.counts.inserted_active ?? 0,
        auto_add_reserve_count: args.counts.inserted_reserve ?? 0,
        editorial_suggestion_count: args.counts.inserted_editorial_suggestion ?? 0,
        auto_reject_count: args.counts.rejected_logged ?? 0,
        error_count: args.counts.failed ?? 0,
        summary: `Discovery enrichment applied from preview run: ${JSON.stringify(args.counts)}`,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", args.runId);
  } catch {
    // Audit update should not hide successful application.
  }
}

async function applyPreviewDecision(args: {
  decision: PreviewDecision;
  reference: string;
  canonical_ref: string | null;
  normalized: ReturnType<typeof normalizeReference>;
  lang: Lang;
  existingCards: AngleCardRow[];
  signals: DiscoverySignal[];
  crafterProvider: Provider;
  crafterModel: string;
  evaluatorProvider: Provider;
  evaluatorModel: string;
}): Promise<PreviewDecision> {
  const decision: PreviewDecision = {
    ...args.decision,
    would_write_to_database: true,
    applied_action: "skipped",
    inserted_card_id: null,
    inserted_suggestion_id: null,
    apply_error: null,
  };

  if (decision.preview_action === "auto_add_active_preview") {
    const inserted = await insertAngleCardFromDecision({
      reference: args.reference,
      canonical_ref: args.canonical_ref,
      normalized: args.normalized,
      lang: args.lang,
      status: "featured",
      candidate: decision.candidate,
      evaluation: decision.evaluation,
      existingCards: args.existingCards,
      signals: args.signals,
      crafterProvider: args.crafterProvider,
      crafterModel: args.crafterModel,
      evaluatorProvider: args.evaluatorProvider,
      evaluatorModel: args.evaluatorModel,
    });

    if (inserted.error) {
      return { ...decision, applied_action: "failed", apply_error: inserted.error };
    }

    return { ...decision, applied_action: "inserted_active", inserted_card_id: inserted.id };
  }

  if (decision.preview_action === "auto_add_reserve_preview") {
    const inserted = await insertAngleCardFromDecision({
      reference: args.reference,
      canonical_ref: args.canonical_ref,
      normalized: args.normalized,
      lang: args.lang,
      status: "reserve",
      candidate: decision.candidate,
      evaluation: decision.evaluation,
      existingCards: args.existingCards,
      signals: args.signals,
      crafterProvider: args.crafterProvider,
      crafterModel: args.crafterModel,
      evaluatorProvider: args.evaluatorProvider,
      evaluatorModel: args.evaluatorModel,
    });

    if (inserted.error) {
      return { ...decision, applied_action: "failed", apply_error: inserted.error };
    }

    return { ...decision, applied_action: "inserted_reserve", inserted_card_id: inserted.id };
  }

  if (decision.preview_action === "editorial_suggestion_preview") {
    const inserted = await insertEditorialSuggestion({
      reference: args.reference,
      canonical_ref: args.canonical_ref,
      normalized: args.normalized,
      lang: args.lang,
      candidate: decision.candidate,
      evaluation: decision.evaluation,
      existingCards: args.existingCards,
      signals: args.signals,
      crafterProvider: args.crafterProvider,
      crafterModel: args.crafterModel,
      evaluatorProvider: args.evaluatorProvider,
      evaluatorModel: args.evaluatorModel,
    });

    if (inserted.error) {
      return { ...decision, applied_action: "failed", apply_error: inserted.error };
    }

    return {
      ...decision,
      applied_action: "inserted_editorial_suggestion",
      inserted_suggestion_id: inserted.id,
    };
  }

  if (decision.preview_action === "auto_reject_preview") {
    return { ...decision, applied_action: "rejected_logged" };
  }

  return decision;
}

function countDecisions(decisions: PreviewDecision[]) {
  return {
    candidates: decisions.length,
    auto_add_active_preview: decisions.filter(
      (decision) => decision.preview_action === "auto_add_active_preview",
    ).length,
    auto_add_reserve_preview: decisions.filter(
      (decision) => decision.preview_action === "auto_add_reserve_preview",
    ).length,
    editorial_suggestion_preview: decisions.filter(
      (decision) => decision.preview_action === "editorial_suggestion_preview",
    ).length,
    auto_reject_preview: decisions.filter(
      (decision) => decision.preview_action === "auto_reject_preview",
    ).length,
    inserted_active: decisions.filter((decision) => decision.applied_action === "inserted_active").length,
    inserted_reserve: decisions.filter((decision) => decision.applied_action === "inserted_reserve").length,
    inserted_editorial_suggestion: decisions.filter(
      (decision) => decision.applied_action === "inserted_editorial_suggestion",
    ).length,
    rejected_logged: decisions.filter((decision) => decision.applied_action === "rejected_logged").length,
    failed: decisions.filter((decision) => decision.applied_action === "failed").length,
  };
}

async function applyStoredPreviewRun(args: {
  runId: string;
  fallbackReference?: string | null;
  fallbackCanonicalRef?: string | null;
  fallbackLang?: Lang | null;
}): Promise<NextResponse> {
  const client = createAdminClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin client unavailable" },
      { status: 500 },
    );
  }

  const { data: runData, error: runError } = await client
    .from("curator_runs")
    .select("*")
    .eq("id", args.runId)
    .maybeSingle();

  if (runError || !runData) {
    return NextResponse.json(
      { ok: false, error: runError?.message ?? "Preview run not found" },
      { status: 404 },
    );
  }

  const run = runData as Record<string, unknown>;
  const reference = getString(run.reference) ?? args.fallbackReference ?? null;
  const canonicalRef = getString(run.canonical_ref) ?? args.fallbackCanonicalRef ?? null;
  const langFromRun = run.lang;
  const lang = isLang(langFromRun) ? langFromRun : args.fallbackLang ?? null;

  if (!reference || !lang) {
    return NextResponse.json(
      { ok: false, error: "Stored preview run does not include reference/lang" },
      { status: 400 },
    );
  }

  const { data: decisionRows, error: decisionsError } = await client
    .from("curator_decisions")
    .select("*")
    .eq("run_id", args.runId)
    .order("created_at", { ascending: true });

  if (decisionsError) {
    return NextResponse.json(
      { ok: false, error: decisionsError.message },
      { status: 500 },
    );
  }

  const rows = Array.isArray(decisionRows)
    ? (decisionRows as Record<string, unknown>[])
    : [];

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Preview run has no stored decisions to apply" },
      { status: 400 },
    );
  }

  const normalized = normalizeReference(reference);

  const cardsResult = await getAllStudioCardsForVerse({
    reference,
    canonical_ref: canonicalRef,
    lang,
    limit: 140,
  });

  if (!cardsResult.ok) {
    return NextResponse.json(
      { ok: false, error: cardsResult.error ?? "Failed to read existing cards" },
      { status: 500 },
    );
  }

  const crafterProvider = isProvider(run.generator_provider) ? run.generator_provider : "claude";
  const evaluatorProvider = isProvider(run.evaluator_provider) ? run.evaluator_provider : "openai";
  const crafterModel = getString(run.generator_model) ?? getModelName(crafterProvider);
  const evaluatorModel = getString(run.evaluator_model) ?? getModelName(evaluatorProvider);

  const appliedDecisions: PreviewDecision[] = [];

  for (const row of rows) {
    const rowId = getString(row.id);
    const existingAppliedAction = getString(row.applied_action);
    const previewDecision = previewDecisionFromCuratorRow(row);

    if (!previewDecision) {
      const failed: PreviewDecision = {
        candidate: {
          title: "Unparseable stored decision",
          anchor: null,
          teaser: "Stored preview decision could not be parsed.",
          why_it_matters: "This row was skipped because it could not be safely applied.",
          source_signal_titles: [],
          certainty: "research_only",
          estimated_score: null,
          risk_level: "unknown",
          recommended_status: "reject",
          strength_reason: null,
          risk: "Could not parse stored candidate payload.",
        },
        evaluation: {
          candidate_index: appliedDecisions.length + 1,
          score_total: null,
          risk_level: "unknown",
          angle_relationship: "uncertain",
          matched_card_id: null,
          recommended_action: "auto_reject",
          reason: "Stored decision could not be parsed.",
          risk_note: null,
          duplicate_note: null,
        },
        preview_action: "auto_reject_preview",
        would_write_to_database: true,
        applied_action: "failed",
        inserted_card_id: null,
        inserted_suggestion_id: null,
        apply_error: "Could not parse stored decision payload.",
      };

      appliedDecisions.push(failed);
      if (rowId) await updateCuratorDecisionAfterApply({ decisionId: rowId, decision: failed });
      continue;
    }

    if (existingAppliedAction && existingAppliedAction !== "report_only") {
      const skipped: PreviewDecision = {
        ...previewDecision,
        applied_action: "skipped",
        apply_error: `Decision already has applied_action=${existingAppliedAction}`,
      };

      appliedDecisions.push(skipped);
      continue;
    }

    const signals = signalsFromStoredCandidatePayload(row.candidate_payload);

    const applied = await applyPreviewDecision({
      decision: previewDecision,
      reference,
      canonical_ref: canonicalRef,
      normalized,
      lang,
      existingCards: cardsResult.cards,
      signals,
      crafterProvider,
      crafterModel,
      evaluatorProvider,
      evaluatorModel,
    });

    appliedDecisions.push(applied);
    if (rowId) await updateCuratorDecisionAfterApply({ decisionId: rowId, decision: applied });
  }

  const counts = countDecisions(appliedDecisions);
  await updateCuratorRunAfterStoredApply({ runId: args.runId, counts });

  return NextResponse.json({
    ok: true,
    mode: "apply_stored_preview_run",
    changed_database: true,
    would_write_to_database: true,
    applied_from_curator_run_id: args.runId,
    curator_run_id: args.runId,
    reference,
    canonical_ref: canonicalRef,
    book_key: normalized.book_key ?? null,
    lang,
    providers: {
      crafter_provider: crafterProvider,
      crafter_model: crafterModel,
      evaluator_provider: evaluatorProvider,
      evaluator_model: evaluatorModel,
    },
    existing_card_count: cardsResult.cards.length,
    active_or_reserve_count: cardsResult.cards.filter(
      (card) => card.status === "featured" || card.status === "reserve",
    ).length,
    counts,
    decisions: appliedDecisions,
  });
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json();
    const shouldApply = isRecord(body) ? getBoolean(body.apply) === true : false;
    const previewRunId = isRecord(body)
      ? getString(body.preview_run_id ?? body.previewRunId ?? body.curator_run_id ?? body.curatorRunId)
      : null;

    const reference = isRecord(body) ? getString(body.reference) : null;
    const lang = isRecord(body) && isLang(body.lang) ? body.lang : null;
    const normalizedFromBody = isRecord(body) ? getString(body.canonical_ref) : null;

    if (shouldApply && previewRunId) {
      return applyStoredPreviewRun({
        runId: previewRunId,
        fallbackReference: reference,
        fallbackCanonicalRef: normalizedFromBody,
        fallbackLang: lang,
      });
    }

    const verseText = isRecord(body) ? getString(body.verseText ?? body.verse_text) : null;
    const manualMaterial = isRecord(body)
      ? getString(body.manual_material ?? body.manualMaterial)
      : null;
    const includeRaw = isRecord(body) ? getBoolean(body.include_raw) ?? false : false;

    const materialSelectionMode =
      isRecord(body) && isMaterialSelectionMode(body.material_selection_mode)
        ? body.material_selection_mode
        : isRecord(body) && isMaterialSelectionMode(body.materialSelectionMode)
          ? body.materialSelectionMode
          : "recent";

    const maxSources = isRecord(body)
      ? clampInt(body.maxSources ?? body.max_sources, 10, 0, 30)
      : 10;
    const maxNotes = isRecord(body)
      ? clampInt(body.maxNotes ?? body.max_notes, 18, 0, 50)
      : 18;
    const maxSignals = isRecord(body)
      ? clampInt(body.maxSignals ?? body.max_signals, 8, 1, 16)
      : 8;
    const maxCandidates = isRecord(body)
      ? clampInt(body.maxCandidates ?? body.max_candidates, 6, 1, 10)
      : 6;

    const selectedSourceIds =
      isRecord(body) && Array.isArray(body.selected_source_ids)
        ? normalizeStringArray(body.selected_source_ids)
        : isRecord(body) && Array.isArray(body.selectedSourceIds)
          ? normalizeStringArray(body.selectedSourceIds)
          : [];

    if (!reference || !lang) {
      return NextResponse.json(
        {
          ok: false,
          error: "reference and lang are required",
        },
        { status: 400 },
      );
    }

    const signalProvider = chooseProvider(body, "DISCOVERY_SIGNAL_PROVIDER", "claude");
    const crafterProvider = chooseProvider(body, "DISCOVERY_CRAFTER_PROVIDER", "claude");
    const evaluatorProvider = chooseProvider(body, "DISCOVERY_EVALUATOR_PROVIDER", "openai");

    const normalized = normalizeReference(reference);
    const canonicalRef = normalizedFromBody ?? normalized.canonical_ref ?? null;

    const cardsResult = await getAllStudioCardsForVerse({
      reference,
      canonical_ref: canonicalRef,
      lang,
      limit: 140,
    });

    if (!cardsResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: cardsResult.error ?? "Failed to read existing cards",
        },
        { status: 500 },
      );
    }

    const [sourcesResult, notesResult] = await Promise.all([
      readResearchRows({
        table: "research_sources",
        reference,
        canonical_ref: canonicalRef,
        lang,
        limit: maxSources,
        mode: materialSelectionMode,
        selectedIds: selectedSourceIds,
      }),
      readResearchRows({
        table: "research_notes",
        reference,
        canonical_ref: canonicalRef,
        lang,
        limit: maxNotes,
        mode: materialSelectionMode,
        selectedIds: selectedSourceIds,
      }),
    ]);

    const detectionPrompt = buildDetectionPrompt({
      reference,
      canonical_ref: canonicalRef,
      verseText,
      lang,
      existingCards: cardsResult.cards,
      researchSources: sourcesResult.rows,
      researchNotes: notesResult.rows,
      manualMaterial,
      materialSelectionMode,
      maxSignals,
    });

    const signalRaw = await runAI(signalProvider, detectionPrompt, lang, true);
    const signalResult = parseSignalResponse(signalRaw);

    const craftableSignals = signalResult.signals.filter((signal) => {
      if (signal.suggested_next_use === "ignore") return false;
      if (signal.certainty === "research_only" && signal.risk_level === "high") return false;
      return (
        signal.suggested_next_use === "craft_candidate" ||
        signal.suggested_next_use === "reserve_only" ||
        signal.suggested_next_use === "editorial_suggestion" ||
        signal.certainty === "firm" ||
        signal.certainty === "cautious" ||
        signal.certainty === "hypothesis"
      );
    });

    let candidateRaw: string | null = null;
    let candidates: CandidateCard[] = [];

    if (craftableSignals.length > 0) {
      const candidatePrompt = buildCandidatePrompt({
        reference,
        verseText,
        lang,
        signals: craftableSignals,
        existingCards: cardsResult.cards,
        maxCandidates,
      });

      candidateRaw = await runAI(crafterProvider, candidatePrompt, lang, true);
      candidates = parseCandidateResponse(candidateRaw);
    }

    let evaluationRaw: string | null = null;
    let evaluations: CandidateEvaluation[] = [];

    if (candidates.length > 0) {
      const evaluationPrompt = buildEvaluationPrompt({
        reference,
        verseText,
        lang,
        candidates,
        existingCards: cardsResult.cards,
      });

      evaluationRaw = await runAI(evaluatorProvider, evaluationPrompt, lang, true);
      evaluations = parseEvaluationResponse(evaluationRaw);
    }

    const previewDecisions: PreviewDecision[] = candidates.map((candidate, index) => {
      const evaluation =
        evaluations.find((item) => item.candidate_index === index + 1) ??
        fallbackEvaluation(candidate, index);

      return {
        candidate,
        evaluation,
        preview_action: computePreviewAction(evaluation),
        would_write_to_database: shouldApply,
        applied_action: null,
        inserted_card_id: null,
        inserted_suggestion_id: null,
        apply_error: null,
      };
    });

    const decisions = shouldApply
      ? await Promise.all(
          previewDecisions.map((decision) =>
            applyPreviewDecision({
              decision,
              reference,
              canonical_ref: canonicalRef,
              normalized,
              lang,
              existingCards: cardsResult.cards,
              signals: signalResult.signals,
              crafterProvider,
              crafterModel: getModelName(crafterProvider),
              evaluatorProvider,
              evaluatorModel: getModelName(evaluatorProvider),
            }),
          ),
        )
      : previewDecisions;

    const counts = {
      signals: signalResult.signals.length,
      craftable_signals: craftableSignals.length,
      ...countDecisions(decisions),
    };

    const curatorRunId = await insertCuratorRun({
      reference,
      canonical_ref: canonicalRef,
      lang,
      signalProvider,
      signalModel: getModelName(signalProvider),
      crafterProvider,
      crafterModel: getModelName(crafterProvider),
      evaluatorProvider,
      evaluatorModel: getModelName(evaluatorProvider),
      apply: shouldApply,
      counts,
    });

    await Promise.all(
      decisions.map((decision) =>
        insertCuratorDecision({
          runId: curatorRunId,
          reference,
          canonical_ref: canonicalRef,
          lang,
          decision,
          signals: signalResult.signals,
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      mode: shouldApply ? "apply_legacy_recomputed" : "preview_only",
      changed_database: shouldApply,
      would_write_to_database: shouldApply,
      curator_run_id: curatorRunId,
      apply_requires_same_run_id: true,
      apply_note: shouldApply && !previewRunId
        ? "Legacy apply recomputed the run because no preview_run_id/curator_run_id was supplied. Update Studio UI to pass curator_run_id from preview."
        : null,
      reference,
      canonical_ref: canonicalRef,
      book_key: normalized.book_key ?? null,
      lang,
      material_selection_mode: materialSelectionMode,
      providers: {
        signal_provider: signalProvider,
        signal_model: getModelName(signalProvider),
        crafter_provider: crafterProvider,
        crafter_model: getModelName(crafterProvider),
        evaluator_provider: evaluatorProvider,
        evaluator_model: getModelName(evaluatorProvider),
      },
      source_count: sourcesResult.rows.length,
      note_count: notesResult.rows.length,
      existing_card_count: cardsResult.cards.length,
      active_or_reserve_count: cardsResult.cards.filter(
        (card) => card.status === "featured" || card.status === "reserve",
      ).length,
      read_errors: {
        research_sources: sourcesResult.error,
        research_notes: notesResult.error,
      },
      counts,
      signals: signalResult.signals,
      empty_reason: signalResult.empty_reason,
      overall_assessment: signalResult.overall_assessment,
      candidates,
      decisions,
      raw: includeRaw
        ? {
            signal_raw: signalRaw,
            candidate_raw: candidateRaw,
            evaluation_raw: evaluationRaw,
          }
        : undefined,
    });
  } catch (error) {
    console.error("[DISCOVERY_ENRICHMENT] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to run discovery enrichment preview",
      },
      { status: 500 },
    );
  }
}
