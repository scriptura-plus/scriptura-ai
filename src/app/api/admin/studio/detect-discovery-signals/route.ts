import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import {
  getAngleCards,
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

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
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

function firstText(row: Record<string, unknown>, keys: string[], max = 1100): string | null {
  for (const key of keys) {
    const value = row[key];
    const text = stringifyPreview(value, max);
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

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const sourceType = getString(item.source_type) ?? "unknown";
      const id = getString(item.id);
      const title = getString(item.title);
      const excerpt = getString(item.excerpt);

      if (!excerpt && !title && !id) return null;

      return {
        source_type: sourceType,
        id,
        title,
        excerpt,
      };
    })
    .filter((item): item is SourceRef => item !== null);
}

function normalizeSignal(value: unknown, index: number): DiscoverySignal | null {
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
      getString(value.signal_type ?? value.type ?? value["тип"]) ?? `signal_${index + 1}`,
    title,
    observation,
    textual_anchor:
      getString(value.textual_anchor ?? value.anchor ?? value["текстовая_опора"]) ?? null,
    why_it_may_matter: why,
    evidence_level: normalizeEvidenceLevel(value.evidence_level ?? value["уровень_опоры"]),
    risk_level: normalizeRiskLevel(value.risk_level ?? value["уровень_риска"]),
    certainty: normalizeCertainty(value.certainty ?? value["уверенность"]),
    novelty_status: normalizeNoveltyStatus(value.novelty_status ?? value["новизна"]),
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
      getString(value.reasoning_note ?? value.reason ?? value["пояснение"]) ?? null,
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
    let query = args.supabase.from(args.table).select("*").eq("lang", args.lang);

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

    if (rows.length > 0 || !args.canonical_ref || args.mode === "selected_sources") {
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
        error instanceof Error
          ? error.message
          : `Failed to read ${args.table}`,
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
    card.why_it_matters ? `why_it_matters: ${truncate(card.why_it_matters, 420)}` : null,
    card.angle_summary ? `angle_summary: ${truncate(card.angle_summary, 360)}` : null,
    card.coverage_type ? `coverage_type: ${card.coverage_type}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}

function formatResearchSource(row: Record<string, unknown>, index: number): string {
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

function formatResearchNote(row: Record<string, unknown>, index: number): string {
  const id = getString(row.id) ?? `note_${index + 1}`;
  const title = getString(row.title) ?? getString(row.kicker) ?? "Untitled note";
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
Your task is to map research signals that may later become cards, reserve ideas, editorial suggestions, or research-only notes.

A discovery signal is a precise research lead:
- a textual surprise,
- a lexical or structural detail,
- a meaningful absence,
- a translation tension,
- an intertextual echo,
- an agency/logic shift,
- a rhetoric/argument move,
- or a risky but interesting hypothesis.

Important product philosophy:
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
7. If no new signals are found, return signals: [] and explain empty_reason. This is a useful result, not an error.

Return ONLY valid JSON with this exact shape:
{
  "signals": [
    {
      "signal_type": "lexical | grammar | structure | rhetorical | intertextual | translation | context_tension | coverage_gap | risk_warning | other",
      "title": "short human-readable title",
      "observation": "what was noticed",
      "textual_anchor": "exact word/phrase if available, otherwise null",
      "why_it_may_matter": "why this could matter for cards or research",
      "evidence_level": "strong | medium | weak | unknown",
      "risk_level": "low | medium | high | unknown",
      "certainty": "firm | cautious | hypothesis | research_only",
      "novelty_status": "new | partially_covered | covered | duplicate | unclear",
      "already_covered_by_card_ids": ["card id if known"],
      "rejected_related_card_ids": ["card id if known"],
      "source_refs": [
        {
          "source_type": "verse_text | existing_card | rejected_card | research_source | research_note | manual_material | context_observation | translation_observation | original_language_observation",
          "id": "source/card/note id or null",
          "title": "source title or null",
          "excerpt": "short excerpt"
        }
      ],
      "suggested_next_use": "craft_candidate | reserve_only | editorial_suggestion | research_only | ignore",
      "reasoning_note": "short explanation of why it is classified this way"
    }
  ],
  "empty_reason": null,
  "overall_assessment": "brief assessment of the verse's discovery potential and the main risks"
}
`.trim();
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
    const manualMaterial = getString(body?.manual_material ?? body?.manualMaterial);
    const includeRaw = getBoolean(body?.include_raw) ?? false;

    const materialSelectionMode = isMaterialSelectionMode(body?.material_selection_mode)
      ? body.material_selection_mode
      : isMaterialSelectionMode(body?.materialSelectionMode)
        ? body.materialSelectionMode
        : "recent";

    const maxSources = clampInt(body?.maxSources ?? body?.max_sources, 10, 0, 30);
    const maxNotes = clampInt(body?.maxNotes ?? body?.max_notes, 18, 0, 50);
    const maxSignals = clampInt(body?.maxSignals ?? body?.max_signals, 10, 1, 16);

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
    const parsed = extractJsonObject(raw);
    const normalizedResponse = normalizeDetectionResponse(parsed);

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
      signals: normalizedResponse.signals,
      empty_reason: normalizedResponse.empty_reason,
      overall_assessment: normalizedResponse.overall_assessment,
      raw_response: includeRaw ? raw : undefined,
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
