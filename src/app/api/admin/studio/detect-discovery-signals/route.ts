import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { getAngleCards, type AngleCardRow } from "@/lib/cache/angleCards";

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
type SignalCertainty = "firm" | "cautious" | "hypothesis" | "research_only";
type NoveltyStatus =
  | "new"
  | "partially_covered"
  | "covered"
  | "duplicate"
  | "unclear";

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
  certainty: SignalCertainty;
  novelty_status: NoveltyStatus;
  already_covered_by_card_ids: string[];
  rejected_related_card_ids: string[];
  source_refs: SourceRef[];
  suggested_next_use:
    | "craft_candidate"
    | "reserve_only"
    | "editorial_suggestion"
    | "research_only"
    | "ignore";
  reasoning_note: string | null;
};

type SignalDetectionResponse = {
  signals?: unknown;
  empty_reason?: unknown;
  overall_assessment?: unknown;
};

type ResearchReadResult = {
  rows: Record<string, unknown>[];
  error: string | null;
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

function isMaterialSelectionMode(
  value: unknown,
): value is MaterialSelectionMode {
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
    console.error("[DISCOVERY_SIGNALS] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getModelName(provider: string): string {
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-5.5";
  if (provider === "claude") return process.env.ANTHROPIC_MODEL || "claude";
  if (provider === "gemini") return process.env.GEMINI_MODEL || "gemini";
  return provider;
}

function chooseSignalProvider(body: unknown): Provider {
  if (isRecord(body) && isProvider(body.provider)) {
    return body.provider;
  }

  const envProvider = process.env.DISCOVERY_SIGNAL_PROVIDER;

  if (isProvider(envProvider)) {
    return envProvider;
  }

  return "claude";
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.warn("[DISCOVERY_SIGNALS] Supabase admin env is not configured");
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = getNumber(value);
  if (raw === null) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonCandidate(text: string): string {
  const stripped = stripCodeFence(text);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1).trim();
  }

  return stripped;
}

function lightlyRepairJsonSyntax(text: string): string {
  let repaired = extractJsonCandidate(text);

  // Claude sometimes returns almost-valid JSON with one missing comma between
  // adjacent array items or object properties. These replacements are intentionally
  // conservative: they only act across real line breaks, so normal Russian prose
  // inside quoted strings is not affected.
  repaired = repaired
    .replace(/}\s*\n\s*{/g, "},\n{")
    .replace(/}\s*\n\s*"/g, '},\n"')
    .replace(/]\s*\n\s*"/g, '],\n"')
    .replace(/"\s*\n\s*"(?=[A-Za-z_А-Яа-яёЁ-]+"\s*:)/g, '",\n"')
    .replace(/(true|false|null)\s*\n\s*"/g, '$1,\n"')
    .replace(/(-?\d+(?:\.\d+)?)\s*\n\s*"/g, '$1,\n"')
    .replace(/,\s*([}\]])/g, "$1");

  return repaired;
}

function extractJsonObject(text: string): unknown {
  const candidate = extractJsonCandidate(text);

  try {
    return JSON.parse(candidate);
  } catch (firstError) {
    const repaired = lightlyRepairJsonSyntax(candidate);

    try {
      return JSON.parse(repaired);
    } catch {
      throw firstError;
    }
  }
}

function extractJsonStringField(
  text: string,
  fieldName: string,
): string | null {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"`, "g");
  const match = pattern.exec(text);
  if (!match) return null;

  let result = "";
  let escaped = false;

  for (let index = pattern.lastIndex; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      try {
        return JSON.parse(`"${result}"`) as string;
      } catch {
        return result;
      }
    }

    result += char;
  }

  return null;
}

function extractJsonNullableStringField(
  text: string,
  fieldName: string,
): string | null {
  const nullPattern = new RegExp(`"${fieldName}"\\s*:\\s*null`);
  if (nullPattern.test(text)) return null;
  return extractJsonStringField(text, fieldName);
}

function findMatchingArrayEnd(text: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function splitTopLevelJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function salvageDiscoverySignalJson(text: string): unknown | null {
  const candidate = extractJsonCandidate(text);
  const signalsKeyIndex = candidate.indexOf('"signals"');
  if (signalsKeyIndex === -1) return null;

  const arrayStart = candidate.indexOf("[", signalsKeyIndex);
  if (arrayStart === -1) return null;

  const arrayEnd = findMatchingArrayEnd(candidate, arrayStart);
  if (arrayEnd === -1) return null;

  const arrayBody = candidate.slice(arrayStart + 1, arrayEnd);
  const objectTexts = splitTopLevelJsonObjects(arrayBody);
  const signals: unknown[] = [];

  for (const objectText of objectTexts) {
    const repairedObject = lightlyRepairJsonSyntax(objectText);
    try {
      signals.push(JSON.parse(repairedObject));
    } catch {
      // Keep the salvage path best-effort. One malformed signal should not hide
      // all other usable signals from Studio.
    }
  }

  if (signals.length === 0 && objectTexts.length > 0) return null;

  return {
    signals,
    empty_reason: extractJsonNullableStringField(candidate, "empty_reason"),
    overall_assessment: extractJsonStringField(candidate, "overall_assessment"),
  };
}

function truncate(value: string, max = 900): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function stringifyPreview(value: unknown, max = 900): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return truncate(value, max);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return truncate(JSON.stringify(value), max);
  } catch {
    return null;
  }
}

function firstText(
  row: Record<string, unknown>,
  keys: string[],
  max = 1100,
): string | null {
  for (const key of keys) {
    const value = row[key];
    const text = stringifyPreview(value, max);
    if (text) return text;
  }

  return null;
}

function normalizeEvidenceLevel(value: unknown): EvidenceLevel {
  if (value === "strong" || value === "medium" || value === "weak")
    return value;
  return "unknown";
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "unknown";
}

function normalizeCertainty(value: unknown): SignalCertainty {
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

function normalizeSuggestedNextUse(
  value: unknown,
): DiscoverySignal["suggested_next_use"] {
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : null))
    .filter((item): item is string => Boolean(item));
}

function normalizeSourceRefs(value: unknown): SourceRef[] {
  if (!Array.isArray(value)) return [];

  const refs: SourceRef[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;

    const sourceType = getString(item.source_type) ?? "unknown";
    const id = getString(item.id);
    const title = getString(item.title);
    const excerpt = getString(item.excerpt);

    if (!excerpt && !title && !id) continue;

    refs.push({
      source_type: sourceType,
      id,
      title,
      excerpt,
    });
  }

  return refs;
}

function normalizeSignal(
  value: unknown,
  index: number,
): DiscoverySignal | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title ?? value["заголовок"]);
  const observation = getString(value.observation ?? value["наблюдение"]);
  const why = getString(
    value.why_it_may_matter ??
      value.why_it_matters ??
      value["почему_важно"] ??
      value["почему_может_быть_важно"],
  );

  if (!title || !observation || !why) return null;

  return {
    signal_type:
      getString(value.signal_type ?? value.type ?? value["тип"]) ??
      `signal_${index + 1}`,
    title,
    observation,
    textual_anchor:
      getString(
        value.textual_anchor ?? value.anchor ?? value["текстовая_опора"],
      ) ?? null,
    why_it_may_matter: why,
    evidence_level: normalizeEvidenceLevel(
      value.evidence_level ?? value["уровень_опоры"],
    ),
    risk_level: normalizeRiskLevel(value.risk_level ?? value["уровень_риска"]),
    certainty: normalizeCertainty(value.certainty ?? value["уверенность"]),
    novelty_status: normalizeNoveltyStatus(
      value.novelty_status ?? value["новизна"],
    ),
    already_covered_by_card_ids: normalizeStringArray(
      value.already_covered_by_card_ids ?? value.covered_by_card_ids,
    ),
    rejected_related_card_ids: normalizeStringArray(
      value.rejected_related_card_ids ?? value.related_rejected_card_ids,
    ),
    source_refs: normalizeSourceRefs(value.source_refs ?? value.sources),
    suggested_next_use: normalizeSuggestedNextUse(
      value.suggested_next_use ?? value.next_use,
    ),
    reasoning_note:
      getString(value.reasoning_note ?? value.reason ?? value["пояснение"]) ??
      null,
  };
}

function normalizeDetectionResponse(parsed: unknown): {
  signals: DiscoverySignal[];
  empty_reason: string | null;
  overall_assessment: string | null;
} {
  if (!isRecord(parsed)) {
    return {
      signals: [],
      empty_reason: "AI returned a non-object JSON value.",
      overall_assessment: null,
    };
  }

  const response = parsed as SignalDetectionResponse;
  const rawSignals = Array.isArray(response.signals) ? response.signals : [];

  return {
    signals: rawSignals
      .map((item, index) => normalizeSignal(item, index))
      .filter((item): item is DiscoverySignal => item !== null),
    empty_reason: getString(response.empty_reason) ?? null,
    overall_assessment: getString(response.overall_assessment) ?? null,
  };
}

async function readResearchRows(args: {
  supabase: SupabaseClient | null;
  table: "research_sources" | "research_notes";
  reference: string;
  canonical_ref: string | null;
  lang: Lang;
  limit: number;
  mode: MaterialSelectionMode;
  selectedIds: string[];
}): Promise<ResearchReadResult> {
  if (!args.supabase) return { rows: [], error: "supabase_not_configured" };
  if (args.mode === "manual_only") return { rows: [], error: null };

  try {
    let query = args.supabase
      .from(args.table)
      .select("*")
      .eq("lang", args.lang);

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

    if (error) {
      return { rows: [], error: error.message };
    }

    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

    if (
      rows.length > 0 ||
      !args.canonical_ref ||
      args.mode === "selected_sources"
    ) {
      return { rows, error: null };
    }

    const fallbackQuery = args.supabase
      .from(args.table)
      .select("*")
      .eq("lang", args.lang)
      .eq("reference", args.reference)
      .order("updated_at", { ascending: false })
      .limit(args.limit);

    const fallback = await fallbackQuery;

    if (fallback.error) {
      return { rows, error: fallback.error.message };
    }

    return {
      rows: Array.isArray(fallback.data)
        ? (fallback.data as Record<string, unknown>[])
        : rows,
      error: null,
    };
  } catch (error) {
    return {
      rows: [],
      error:
        error instanceof Error ? error.message : `Failed to read ${args.table}`,
    };
  }
}

function formatCardForPrompt(card: AngleCardRow, index: number): string {
  const row = card as AngleCardRow & Record<string, unknown>;
  const effectiveScore =
    typeof card.score_total === "number" && Number.isFinite(card.score_total)
      ? card.score_total
      : null;

  const parts = [
    `#${index + 1}`,
    `id: ${card.id}`,
    `status: ${card.status}`,
    effectiveScore === null ? null : `score: ${effectiveScore}`,
    row.is_locked ? "locked: true" : null,
    getString(row.moderator_note)
      ? `moderator_note: ${getString(row.moderator_note)}`
      : null,
    `title: ${card.title}`,
    card.anchor ? `anchor: ${card.anchor}` : null,
    `teaser: ${truncate(card.teaser, 650)}`,
    card.why_it_matters
      ? `why_it_matters: ${truncate(card.why_it_matters, 420)}`
      : null,
    card.angle_summary
      ? `angle_summary: ${truncate(card.angle_summary, 360)}`
      : null,
    card.coverage_type ? `coverage_type: ${card.coverage_type}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}

function formatResearchSource(
  row: Record<string, unknown>,
  index: number,
): string {
  const id = getString(row.id) ?? `source_${index + 1}`;
  const title = getString(row.title) ?? "Untitled source";
  const kind = getString(row.source_kind) ?? "unknown";
  const type = getString(row.source_type);
  const status = getString(row.status);
  const extractionStatus = getString(row.extraction_status);
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
    status ? `status: ${status}` : null,
    extractionStatus ? `extraction_status: ${extractionStatus}` : null,
    `excerpt: ${body}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatResearchNote(
  row: Record<string, unknown>,
  index: number,
): string {
  const id = getString(row.id) ?? `note_${index + 1}`;
  const title =
    getString(row.title) ?? getString(row.kicker) ?? "Untitled note";
  const noteKind = getString(row.note_kind) ?? "unknown";
  const lens = getString(row.lens_id);
  const candidateStatus = getString(row.candidate_status);
  const score = getNumber(row.score);
  const confidence = getString(row.confidence);
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
    candidateStatus ? `candidate_status: ${candidateStatus}` : null,
    score === null ? null : `score: ${score}`,
    confidence ? `confidence: ${confidence}` : null,
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
Your task is NOT to behave like Word Lens.
Your task is to map research signals that may later become cards, reserve ideas, editorial suggestions, or research-only notes.

CORE DISTINCTION:
Auto Curator asks: "What cards can be made from this material?"
Discovery Signals asks: "What clues, tensions, absences, structures, risks, and possible leads exist here, even if they are not cards yet?"

A discovery signal is a precise research lead:
- a structure or sequence that changes the logic of the verse,
- a rhetorical pressure point,
- a paradox or expectation reversal,
- a meaningful absence,
- an agency shift,
- a contextual tension,
- a translation tension,
- an intertextual echo,
- a lexical detail,
- a risk warning,
- or a risky but interesting hypothesis.

IMPORTANT PRODUCT PHILOSOPHY:
Scriptura AI is an editorial-research product. It may preserve hypotheses and tentative lines of thought, but it must label them clearly.
Do not kill every risky idea. Instead classify it:
- firm: directly visible in the text and low risk.
- cautious: plausible and useful, but needs careful wording.
- hypothesis: interesting and potentially valuable, but not safe as a public claim without caveats.
- research_only: useful for editors or future research, but not a card yet.

Never present hypotheses as facts.
Never overclaim original-language, intertextual, historical, or rabbinic background.
Do not create cards here.

CRITICAL PORTFOLIO RULE — DO NOT MAKE A SECOND WORD LENS:
The first technical test showed a failure mode: the detector can over-focus on Greek forms, lexical claims, or rabbinic background.
Avoid that.
This signal pass must be broad.

Before producing output, silently scan the verse in this order:
1. STRUCTURE / SEQUENCE — how the clauses are arranged; what comes before/after what.
2. RHETORIC / PARADOX — where the wording reverses expectation or creates tension.
3. AGENCY / LOGIC — who acts, receives, initiates, finds, gives, bears, learns, or responds.
4. MEANINGFUL ABSENCE / COVERAGE GAP — what the verse does not say that a reader might expect.
5. CONTEXT TENSION — how the previous/next verse changes the target verse.
6. TRANSLATION / RENDERING — where wording choices change perception.
7. LEXICAL / ORIGINAL LANGUAGE — only after the above, and only when the word-level detail is truly useful.
8. INTERTEXTUAL / HISTORICAL BACKGROUND — only if it creates a real research lead, not decoration.

Required portfolio target:
- Return ${Math.min(args.maxSignals, 8)} to ${args.maxSignals} signals if the material supports it.
- Include at least 1 structure signal if any structure is visible.
- Include at least 1 rhetorical/paradox signal if any tension is visible.
- Include at least 1 agency/logic signal if agent roles differ or shift.
- Include at least 1 meaningful absence or coverage_gap signal if the verse omits an expected explanation, subject, reason, or content.
- Include at least 1 context_tension signal if nearby context is available from the verse, cards, or materials.
- Include no more than 2 lexical/original-language signals unless the verse genuinely has no other signal types.
- Include no more than 1 rabbinic/historical-background signal unless the evidence is unusually strong.

MANDATORY NON-LEXICAL DOUBLE CHECK — DO THIS BEFORE OUTPUT:
After the broad scan, explicitly check these two high-yield questions. They are examples of the type of non-lexical signal we want across verses; do not force them if the verse does not support them, but do not skip the check.
1. UNSTATED CONTENT / CURRICULUM CHECK:
   Does the verse tell the reader to learn, follow, seek, ask, believe, or act, while leaving the exact content, mechanism, curriculum, reason, or explanation unstated?
   If yes, this may be a meaningful absence / coverage_gap signal.
   For Matthew 11:29 specifically: check whether “learn from me” names the Teacher but leaves the curriculum unstated.
2. REASON-AS-ARGUMENT CHECK:
   Does a “because / for / since / ибо / потому что” clause function not as background information, but as the argument that makes the command, promise, or invitation credible?
   If yes, this may be a structure/rhetoric signal.
   For Matthew 11:29 specifically: check whether “because I am mild-tempered and lowly in heart” functions as the reason to trust the yoke, not merely as a character description.

If either check produces a real signal, include it unless it is already fully covered by an existing card. If it overlaps with an existing card, mark novelty_status as covered or partially_covered and explain the overlap.

If a lexical signal is interesting but would mostly belong to Word Lens, mark it as research_only or reserve_only unless it also changes the larger reading of the verse.
If a rabbinic, historical, or intertextual signal is interesting but not verified, keep it as hypothesis or research_only.

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

WHAT TO LOOK FOR:
1. Structure / sequence:
   Does the verse move through steps? command → reason → result? question → answer? image → explanation? promise → condition?

2. Rhetoric / paradox:
   Does the verse sound like one thing but function as another? Does comfort come through pressure, rest through burden, command through invitation, or relief through obligation?

3. Agency / logic:
   Who is the subject of each action? Does agency shift between nearby clauses or nearby verses? Does one person give while another finds, receives, bears, learns, or responds?

4. Meaningful absence:
   What would the reader expect the verse to explain, but it does not? Is there missing content, missing mechanism, missing reason, missing subject, missing condition, missing curriculum, or missing emotional reaction?
   Special check: if the verse says “learn / seek / follow / ask / believe / act” but does not state the content or mechanism, treat that as a possible meaningful absence signal.

4b. Reason-as-argument:
   If the verse contains a causal phrase such as “because,” “for,” “ибо,” or “потому что,” ask whether that phrase is doing argumentative work. Is it a reason to accept the invitation, trust the promise, or obey the command, rather than a mere descriptive aside?

5. Context tension:
   If nearby context is visible or already known from the materials, does the target verse explain, modify, sharpen, condition, or complete the surrounding thought?

6. Translation / rendering:
   Does a familiar translation flatten a key image, object, agency, or target of the promise? Keep this as a signal, not as a translation-card.

7. Lexical / original-language:
   Only include a word-level signal when it affects the whole reading. Do not fill the output with Greek/Hebrew vocabulary. Do not use original-language forms for decoration.

8. Intertextual / historical / rabbinic:
   Preserve promising leads, but classify them honestly as cautious/hypothesis/research_only unless the evidence is strong.

Instructions:
1. Find up to ${args.maxSignals} strong discovery signals.
2. Prefer non-lexical signals first: structure, rhetoric, paradox, agency, meaningful absence, context, translation.
3. Prefer signals that can make the verse feel newly seen to a serious Bible reader.
4. Compare every signal with existing active/reserve cards:
   - mark "covered" or "partially_covered" when it overlaps.
   - include already_covered_by_card_ids when possible.
   - if an existing card already covers the signal, the signal may still be useful as "covered" or "partially_covered" for audit, but do not call it new.
5. Compare every signal with rejected/hidden cards:
   - if a signal repeats a rejected idea, either avoid it or mark rejected_related_card_ids.
6. Keep useful risky signals, but label risk and certainty honestly.
7. Include signals that should become:
   - craft_candidate,
   - reserve_only,
   - editorial_suggestion,
   - research_only,
   - or ignore.
8. If no new signals are found, return no signal blocks and explain EMPTY_REASON. This is useful, not an error.

QUALITY CHECK BEFORE OUTPUT:
Ask yourself:
- Did I produce a portfolio, or did I drift into Word Lens?
- Are there at least three non-lexical signals?
- Did I include structure/rhetoric/agency/absence when available?
- Did I mark existing-card overlap honestly?
- Did I preserve hypotheses without pretending they are facts?
- Did I avoid overconfident claims about Greek, Hebrew, rabbinic background, or intertextual echoes?

Return ONLY this plain text block format.
Do NOT return JSON.
Do NOT use markdown fences.
This route intentionally uses a labeled format because JSON from long signal lists is fragile.
Use exactly these labels.
For SOURCE_REFS, use one or more lines in this format:
source_type | id-or-null | title-or-null | excerpt

OVERALL_ASSESSMENT: brief assessment of the verse's discovery potential, portfolio balance, and the main risks
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

function cleanLabeledValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (
    !cleaned ||
    cleaned.toLowerCase() === "null" ||
    cleaned === "—" ||
    cleaned === "-"
  )
    return null;
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
          title:
            parts[2] && parts[2].toLowerCase() !== "null" ? parts[2] : null,
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

function parseSignalBlock(
  block: string,
  index: number,
): DiscoverySignal | null {
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
    evidence_level: normalizeEvidenceLevel(
      cleanLabeledValue(fields.EVIDENCE_LEVEL),
    ),
    risk_level: normalizeRiskLevel(cleanLabeledValue(fields.RISK_LEVEL)),
    certainty: normalizeCertainty(cleanLabeledValue(fields.CERTAINTY)),
    novelty_status: normalizeNoveltyStatus(
      cleanLabeledValue(fields.NOVELTY_STATUS),
    ),
    already_covered_by_card_ids: parseCommaList(
      fields.ALREADY_COVERED_BY_CARD_IDS,
    ),
    rejected_related_card_ids: parseCommaList(fields.REJECTED_RELATED_CARD_IDS),
    source_refs: parseSourceRefsText(fields.SOURCE_REFS),
    suggested_next_use: normalizeSuggestedNextUse(
      cleanLabeledValue(fields.SUGGESTED_NEXT_USE),
    ),
    reasoning_note: cleanLabeledValue(fields.REASONING_NOTE),
  };
}

function parseLabeledSignalResponse(raw: string): {
  signals: DiscoverySignal[];
  empty_reason: string | null;
  overall_assessment: string | null;
  parsed_from_labeled_blocks: boolean;
} {
  const text = stripCodeFence(raw);
  const overallMatch =
    /OVERALL_ASSESSMENT\s*:\s*([\s\S]*?)(?=\nEMPTY_REASON\s*:|\n---SIGNAL---|$)/i.exec(
      text,
    );
  const emptyMatch =
    /EMPTY_REASON\s*:\s*([\s\S]*?)(?=\nOVERALL_ASSESSMENT\s*:|\n---SIGNAL---|$)/i.exec(
      text,
    );
  const blocks = [
    ...text.matchAll(/---SIGNAL---([\s\S]*?)---END_SIGNAL---/g),
  ].map((match) => match[1]);

  const signals = blocks
    .map((block, index) => parseSignalBlock(block, index))
    .filter((signal): signal is DiscoverySignal => signal !== null);

  return {
    signals,
    empty_reason: cleanLabeledValue(emptyMatch?.[1]),
    overall_assessment: cleanLabeledValue(overallMatch?.[1]),
    parsed_from_labeled_blocks: signals.length > 0 || blocks.length > 0,
  };
}

type JsonParseResult = {
  parsed: unknown;
  repaired: boolean;
  parse_error: string | null;
  repaired_raw: string | null;
};

async function parseDiscoveryJsonWithRepair(args: {
  provider: Provider;
  lang: Lang;
  raw: string;
}): Promise<JsonParseResult> {
  try {
    return {
      parsed: extractJsonObject(args.raw),
      repaired: false,
      parse_error: null,
      repaired_raw: null,
    };
  } catch (firstError) {
    const firstMessage =
      firstError instanceof Error
        ? firstError.message
        : "Initial JSON parse failed";

    const salvaged = salvageDiscoverySignalJson(args.raw);
    if (salvaged) {
      return {
        parsed: salvaged,
        repaired: true,
        parse_error: firstMessage,
        repaired_raw: "salvaged_locally_from_broken_json",
      };
    }

    const repairPrompt = `
You are a strict JSON repair utility.

The following AI response was intended to be a JSON object for Scriptura AI Discovery Signals, but it contains a syntax error.

Repair ONLY the JSON syntax.
Do not add new signals.
Do not remove meaningful fields unless they are impossible to repair.
Do not translate or rewrite content.
Do not add markdown fences.
Return ONLY one valid JSON object. No markdown. No explanation.
Use this top-level shape and preserve all meaningful signal content:
{"signals":[],"empty_reason":null,"overall_assessment":""}

Broken JSON response:
${args.raw}
`.trim();

    const repairedRaw = await runAI(
      args.provider,
      repairPrompt,
      args.lang,
      true,
    );

    try {
      return {
        parsed: extractJsonObject(repairedRaw),
        repaired: true,
        parse_error: firstMessage,
        repaired_raw: repairedRaw,
      };
    } catch (secondError) {
      const repairedSalvaged = salvageDiscoverySignalJson(repairedRaw);
      if (repairedSalvaged) {
        return {
          parsed: repairedSalvaged,
          repaired: true,
          parse_error: firstMessage,
          repaired_raw: "salvaged_locally_from_ai_repair",
        };
      }

      const secondMessage =
        secondError instanceof Error
          ? secondError.message
          : "Repair JSON parse failed";

      throw new Error(
        `AI returned invalid JSON. Initial parse error: ${firstMessage}. Repair parse error: ${secondMessage}`,
      );
    }
  }
}

async function loadExistingCards(args: {
  reference: string;
  lang: Lang;
}): Promise<{
  cards: AngleCardRow[];
  error: string | null;
}> {
  const result = await getAngleCards({
    reference: args.reference,
    lang: args.lang,
    statuses: ["featured", "reserve", "hidden", "rejected", "rewrite"],
    limit: 120,
  });

  if (!result.ok) {
    return {
      cards: [],
      error: result.error ?? "Failed to read existing angle cards",
    };
  }

  return {
    cards: result.cards ?? [],
    error: null,
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const reference = getString(body?.reference);
    const lang = isLang(body?.lang) ? body.lang : null;
    const provider = chooseSignalProvider(body);
    const normalizedFromBody = getString(body?.canonical_ref);
    const verseText = getString(body?.verseText ?? body?.verse_text);
    const manualMaterial = getString(
      body?.manual_material ?? body?.manualMaterial,
    );
    const includeRaw = getBoolean(body?.include_raw) ?? false;

    const materialSelectionMode = isMaterialSelectionMode(
      body?.material_selection_mode,
    )
      ? body.material_selection_mode
      : isMaterialSelectionMode(body?.materialSelectionMode)
        ? body.materialSelectionMode
        : "recent";

    const maxSources = clampInt(
      body?.maxSources ?? body?.max_sources,
      10,
      0,
      30,
    );
    const maxNotes = clampInt(body?.maxNotes ?? body?.max_notes, 18, 0, 50);
    const maxSignals = clampInt(
      body?.maxSignals ?? body?.max_signals,
      10,
      1,
      16,
    );

    const selectedSourceIds = Array.isArray(body?.selected_source_ids)
      ? normalizeStringArray(body.selected_source_ids)
      : Array.isArray(body?.selectedSourceIds)
        ? normalizeStringArray(body.selectedSourceIds)
        : [];

    if (!reference || !lang) {
      return NextResponse.json(
        {
          error: "reference and lang are required",
        },
        { status: 400 },
      );
    }

    const normalized = normalizeReference(reference);
    const canonicalRef = normalizedFromBody ?? normalized.canonical_ref ?? null;

    const [existingCardsResult] = await Promise.all([
      loadExistingCards({ reference, lang }),
    ]);

    const supabase = getSupabaseAdmin();

    const [sourcesResult, notesResult] = await Promise.all([
      readResearchRows({
        supabase,
        table: "research_sources",
        reference,
        canonical_ref: canonicalRef,
        lang,
        limit: maxSources,
        mode: materialSelectionMode,
        selectedIds: selectedSourceIds,
      }),
      readResearchRows({
        supabase,
        table: "research_notes",
        reference,
        canonical_ref: canonicalRef,
        lang,
        limit: maxNotes,
        mode: materialSelectionMode,
        selectedIds: selectedSourceIds,
      }),
    ]);

    const prompt = buildDetectionPrompt({
      reference,
      canonical_ref: canonicalRef,
      verseText,
      lang,
      existingCards: existingCardsResult.cards,
      researchSources: sourcesResult.rows,
      researchNotes: notesResult.rows,
      manualMaterial,
      materialSelectionMode,
      maxSignals,
    });

    const raw = await runAI(provider, prompt, lang, true);
    const labeledResponse = parseLabeledSignalResponse(raw);
    let parseResult: JsonParseResult | null = null;
    let normalizedResponse: {
      signals: DiscoverySignal[];
      empty_reason: string | null;
      overall_assessment: string | null;
    };

    if (labeledResponse.parsed_from_labeled_blocks) {
      normalizedResponse = {
        signals: labeledResponse.signals,
        empty_reason: labeledResponse.empty_reason,
        overall_assessment: labeledResponse.overall_assessment,
      };
    } else {
      parseResult = await parseDiscoveryJsonWithRepair({ provider, lang, raw });
      normalizedResponse = normalizeDetectionResponse(parseResult.parsed);
    }

    return NextResponse.json({
      ok: true,
      mode: "preview_only",
      changed_database: false,
      reference,
      canonical_ref: canonicalRef,
      book_key: normalized.book_key ?? null,
      lang,
      provider,
      model: getModelName(provider),
      material_selection_mode: materialSelectionMode,
      source_count: sourcesResult.rows.length,
      note_count: notesResult.rows.length,
      existing_card_count: existingCardsResult.cards.length,
      active_or_reserve_count: existingCardsResult.cards.filter(
        (card) => card.status === "featured" || card.status === "reserve",
      ).length,
      rejected_or_hidden_count: existingCardsResult.cards.filter(
        (card) => card.status === "rejected" || card.status === "hidden",
      ).length,
      read_errors: {
        angle_cards: existingCardsResult.error,
        research_sources: sourcesResult.error,
        research_notes: notesResult.error,
      },
      output_format: labeledResponse.parsed_from_labeled_blocks
        ? "labeled_blocks"
        : "json",
      json_repaired: parseResult?.repaired ?? false,
      json_parse_error: parseResult?.parse_error ?? null,
      signals: normalizedResponse.signals,
      empty_reason: normalizedResponse.empty_reason,
      overall_assessment: normalizedResponse.overall_assessment,
      raw_response: includeRaw ? raw : undefined,
      repaired_raw_response:
        includeRaw && parseResult?.repaired
          ? parseResult.repaired_raw
          : undefined,
    });
  } catch (error) {
    console.error("[DISCOVERY_SIGNALS] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to detect discovery signals",
      },
      { status: 500 },
    );
  }
}
