import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import {
  getAllStudioCardsForVerse,
  type AngleCardRow,
} from "@/lib/cache/angleCards";
import {
  runRealVerseTextOnlyPreview,
  type RealVerseTextOnlyResult,
} from "@/lib/discovery-refinery/realVerseTextOnly/runRealVerseTextOnly";
import type { ExistingCoverageCard } from "@/lib/discovery-refinery/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

type Lang = "ru";

type JsonRecord = Record<string, unknown>;

type RequestBody = {
  reference?: unknown;
  canonical_ref?: unknown;
  canonicalRef?: unknown;
  lang?: unknown;
  detectorProvider?: unknown;
  detector_provider?: unknown;
  crafterProvider?: unknown;
  crafter_provider?: unknown;
  judgeProvider?: unknown;
  judge_provider?: unknown;
  verifierProvider?: unknown;
  verifier_provider?: unknown;
  genre?: unknown;
  maxCards?: unknown;
};

type SignalSummary = {
  signal_id: string;
  intake_status: string;
  tier: string | null;
  evidence_level: string | null;
  reader_surprise_ru: string;
  core_observation: string;
  anchor_text: string | null;
  risk_flags: string[];
  suggested_lane: "public_preview_ok" | "research_only" | "discarded" | "unknown";
  raw: unknown;
};

type DraftPearlCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  source_signal_id: string | null;
  score_estimate: number | null;
  editor_note: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[TWO_STAGE_PEARLS_PREVIEW] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function chooseProvider(
  value: unknown,
  envName: string,
  fallback: Provider,
): Provider {
  if (isProvider(value)) return value;

  const envProvider = process.env[envName];
  if (isProvider(envProvider)) return envProvider;

  return fallback;
}

function buildPassageId(canonicalRef: string): string {
  return canonicalRef
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJson(text: string): unknown | null {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    // Continue to best-effort extraction.
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    } catch {
      // Continue to array extraction.
    }
  }

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    } catch {
      // Ignore.
    }
  }

  return null;
}

function getNestedRecord(value: unknown, key: string): JsonRecord {
  return asRecord(asRecord(value)[key]);
}

function getNestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  const text = getString(current);
  return text || null;
}

function getFingerprintHash(card: AngleCardRow): string | null {
  return (
    getNestedString(card.evaluation, ["angle_fingerprint", "hash"]) ||
    getNestedString(card.evaluation, ["fingerprint", "hash"]) ||
    getNestedString(card.battle, ["angle_fingerprint", "hash"]) ||
    getNestedString(card.original_card, ["angle_fingerprint", "hash"]) ||
    getNestedString(card.original_card, ["signal", "angle_fingerprint", "hash"])
  );
}

function getFingerprintComponents(card: AngleCardRow): Record<string, unknown> | null {
  const evaluation = asRecord(card.evaluation);
  const battle = asRecord(card.battle);
  const originalCard = asRecord(card.original_card);
  const originalSignal = getNestedRecord(card.original_card, "signal");

  const candidates = [
    asRecord(evaluation.angle_fingerprint),
    asRecord(battle.angle_fingerprint),
    asRecord(originalCard.angle_fingerprint),
    asRecord(originalSignal.angle_fingerprint),
  ];

  const fingerprint = candidates.find((item) => getString(item.hash));

  if (fingerprint) {
    return {
      anchor:
        getNestedString(fingerprint, ["anchor_canonical", "text"]) ??
        card.anchor ??
        null,
      phenomenon: getString(fingerprint.phenomenon) || null,
      interpretive_move: getString(fingerprint.interpretive_move) || null,
      angle_family: getString(fingerprint.angle_family) || null,
    };
  }

  return {
    anchor: card.anchor,
    phenomenon: null,
    interpretive_move: card.angle_summary ?? card.title,
    angle_family: card.coverage_type ?? "other",
  };
}

function toExistingCoverageCard(card: AngleCardRow): ExistingCoverageCard {
  const fingerprintComponents = getFingerprintComponents(card);

  return {
    card_id: card.id,
    id: card.id,

    reference: card.reference,
    canonical_ref: card.canonical_ref,
    lang: card.lang,

    status: card.status,
    title: card.title,
    anchor_surface: card.anchor,
    anchor_canonical: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    angle_summary: card.angle_summary,
    coverage_type: card.coverage_type,

    score_total: card.score_total,
    effective_score: (card.score_total ?? 0) + (card.moderator_boost ?? 0),

    angle_family:
      getString(fingerprintComponents?.angle_family) ??
      card.coverage_type ??
      "other",
    fingerprint_hash: getFingerprintHash(card),
    fingerprint_components: fingerprintComponents,

    source_type: card.source_type,
    source_model: card.source_model,

    created_at: card.created_at,
    updated_at: card.updated_at,
  } as unknown as ExistingCoverageCard;
}

function summarizeExistingCard(card: AngleCardRow) {
  return {
    id: card.id,
    status: card.status,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    score_total: card.score_total,
    coverage_type: card.coverage_type,
    source_type: card.source_type,
    updated_at: card.updated_at,
  };
}

function getReaderSurprise(signal: JsonRecord): string {
  const readerSurprise = asRecord(signal.reader_surprise_sentence);

  return (
    getString(readerSurprise.ru) ||
    getString(signal.reader_surprise_sentence) ||
    ""
  );
}

function getAnchorText(signal: JsonRecord): string | null {
  const textualAnchor = asRecord(signal.textual_anchor);
  const canonical = asRecord(textualAnchor.canonical);
  const surfaces = asRecord(textualAnchor.surfaces);
  const ru = asRecord(surfaces.ru);

  return (
    getString(canonical.quote) ||
    getString(canonical.text) ||
    getString(ru.quote) ||
    null
  );
}

function getRiskFlags(signal: JsonRecord): string[] {
  const riskFlags = signal.risk_flags;

  if (!Array.isArray(riskFlags)) return [];

  return riskFlags
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function getIntakeStatus(queueItem: JsonRecord, signal: JsonRecord): string {
  const direct =
    getString(queueItem.intake_status) ||
    getString(queueItem.suggested_action) ||
    getString(signal.suggested_next_action);

  if (direct) return direct;

  const directClassification = asRecord(queueItem.intake_classification);
  const signalClassification = asRecord(signal.intake_classification);
  const metadata = asRecord(signal.metadata);
  const metadataClassification = asRecord(metadata.intake_classification);

  return (
    getString(directClassification.intake_status) ||
    getString(directClassification.status) ||
    getString(signalClassification.intake_status) ||
    getString(signalClassification.status) ||
    getString(metadataClassification.intake_status) ||
    getString(metadataClassification.status) ||
    "unknown"
  );
}

function getTier(queueItem: JsonRecord): string | null {
  return getString(queueItem.tier) || null;
}

function getSuggestedLane(status: string): SignalSummary["suggested_lane"] {
  if (status === "keep_raw" || status === "keep_cautious") {
    return "public_preview_ok";
  }

  if (
    status === "keep_surface_hypothesis" ||
    status === "keep_needs_evidence" ||
    status === "keep_possible_duplicate"
  ) {
    return "research_only";
  }

  if (status.startsWith("discard")) {
    return "discarded";
  }

  return "unknown";
}

function summarizeSignal(queueItemRaw: unknown): SignalSummary {
  const queueItem = asRecord(queueItemRaw);
  const signal = asRecord(queueItem.signal);
  const status = getIntakeStatus(queueItem, signal);

  return {
    signal_id: getString(signal.signal_id, "unknown_signal"),
    intake_status: status,
    tier: getTier(queueItem),
    evidence_level: getString(signal.evidence_level) || null,
    reader_surprise_ru: getReaderSurprise(signal),
    core_observation: getString(signal.core_observation),
    anchor_text: getAnchorText(signal),
    risk_flags: getRiskFlags(signal),
    suggested_lane: getSuggestedLane(status),
    raw: {
      queue_item_id: getString(queueItem.queue_item_id) || null,
      signal,
      intake_classification:
        queueItem.intake_classification ??
        signal.intake_classification ??
        asRecord(signal.metadata).intake_classification ??
        null,
    },
  };
}

function buildCrafterPrompt(args: {
  reference: string;
  verseTextRu: string;
  eligibleSignals: SignalSummary[];
  researchOnlySignals: SignalSummary[];
  existingCards: ReturnType<typeof summarizeExistingCard>[];
  maxCards: number;
}): string {
  return [
    "Ты — Card Crafter для Scriptura AI.",
    "",
    "Задача Scriptura:",
    "показать читателю короткие «Жемчужины» по стиху — не комментарий, не проповедь, а открытие: «Я раньше этого не замечал».",
    "",
    "ВАЖНО:",
    "Углы уже найдены другим этапом. Ты НЕ ищешь новые углы.",
    "Ты превращаешь только разрешённые сигналы в красивые карточки.",
    "",
    "СТРОГОЕ ПРАВИЛО:",
    "Пиши публичные draft-карточки ТОЛЬКО из ELIGIBLE SIGNALS.",
    "Не делай карточки из RESEARCH ONLY SIGNALS.",
    "Research-only сигналы могут быть сильными, но требуют проверки оригинала, синтаксиса, перевода или модератора.",
    "",
    "ТОН:",
    "- спокойное точное наблюдение;",
    "- без академической тяжести;",
    "- без церковных клише;",
    "- без фраз «в оригинале означает», если этого нет в eligible signal;",
    "- без новых утверждений, которых нет в сигнале;",
    "- не превращай карточку в объяснение всего стиха.",
    "",
    "ФОРМАТ КАРТОЧКИ:",
    "- title: короткий заголовок, 4–9 слов;",
    "- anchor: короткая фраза из стиха;",
    "- teaser: 1–2 предложения, желательно с духом «Я не замечал, что...»;",
    "- why_it_matters: почему это меняет чтение стиха, без проповеди;",
    "- source_signal_id: id сигнала;",
    "- score_estimate: примерная сила открытия от 1 до 100;",
    "- editor_note: коротко, почему карточка пригодна для preview.",
    "",
    "НЕ ДЕЛАЙ ДУБЛИ существующих карточек.",
    "Если eligible signal повторяет existing card, лучше не пиши по нему карточку.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ СТИХА:",
    args.verseTextRu,
    "",
    "EXISTING SCRIPTURA CARDS / OLD QUALITY REFERENCE:",
    JSON.stringify(args.existingCards, null, 2),
    "",
    "ELIGIBLE SIGNALS — можно делать публичные draft-карточки для редакционного preview:",
    JSON.stringify(args.eligibleSignals, null, 2),
    "",
    "RESEARCH ONLY SIGNALS — НЕ писать из них публичные карточки сейчас:",
    JSON.stringify(args.researchOnlySignals, null, 2),
    "",
    "ВЕРНИ JSON ONLY:",
    JSON.stringify(
      {
        cards: [
          {
            title: "short title",
            anchor: "short verse phrase",
            teaser: "Я не замечал, что ...",
            why_it_matters: "why this changes how the verse is read",
            source_signal_id: "signal_id",
            score_estimate: 85,
            editor_note: "why this is safe enough for preview",
          },
        ],
        skipped_eligible_signals: [
          {
            signal_id: "signal_id",
            reason: "duplicate / too weak / not enough substance",
          },
        ],
      },
      null,
      2,
    ),
    "",
    `Верни максимум ${args.maxCards} карточек.`,
  ].join("\n");
}

function normalizeDraftCard(value: unknown): DraftPearlCard | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) return null;

  return {
    title,
    anchor: getString(value.anchor) || null,
    teaser,
    why_it_matters: getString(value.why_it_matters) || null,
    source_signal_id: getString(value.source_signal_id) || null,
    score_estimate: getOptionalNumber(value.score_estimate),
    editor_note: getString(value.editor_note) || null,
  };
}

function parseCrafterCards(text: string): {
  cards: DraftPearlCard[];
  parsed_json: unknown;
  parse_error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return {
      cards: [],
      parsed_json: null,
      parse_error: "Crafter returned no parseable JSON.",
    };
  }

  const cardsRaw = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.cards)
      ? parsed.cards
      : [];

  const cards = cardsRaw
    .map(normalizeDraftCard)
    .filter((card): card is DraftPearlCard => card !== null);

  return {
    cards,
    parsed_json: parsed,
    parse_error: null,
  };
}

function countByStatus(signals: SignalSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const signal of signals) {
    counts[signal.intake_status] = (counts[signal.intake_status] ?? 0) + 1;
  }

  return counts;
}

function getDetectorSummary(result: RealVerseTextOnlyResult, signals: SignalSummary[]) {
  return {
    detector_signal_count: result.detector_signal_count,
    queue_item_count: result.queue.length,
    action_counts: result.action_counts,
    tier_counts: result.tier_counts,
    errors: result.errors,
    status_counts: countByStatus(signals),
    keep_total: signals.filter((signal) => signal.intake_status.startsWith("keep_"))
      .length,
    discard_total: signals.filter((signal) => signal.intake_status.startsWith("discard"))
      .length,
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const bodyRaw = (await req.json().catch(() => ({}))) as RequestBody;
    const body = asRecord(bodyRaw);

    const reference = getString(body.reference);
    const lang: Lang = "ru";

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "reference is required." },
        { status: 400 },
      );
    }

    if (body.lang && body.lang !== "ru") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only lang=ru is supported in the current two-stage Pearls preview.",
        },
        { status: 400 },
      );
    }

    const detectorProvider = chooseProvider(
      body.detectorProvider ?? body.detector_provider,
      "DISCOVERY_SIGNAL_PROVIDER",
      "claude",
    );

    const crafterProvider = chooseProvider(
      body.crafterProvider ?? body.crafter_provider,
      "DISCOVERY_CRAFTER_PROVIDER",
      "claude",
    );

    const judgeProvider = chooseProvider(
      body.judgeProvider ?? body.judge_provider,
      "DISCOVERY_JUDGE_PROVIDER",
      "openai",
    );

    const verifierProvider = chooseProvider(
      body.verifierProvider ?? body.verifier_provider,
      "DISCOVERY_VERIFIER_PROVIDER",
      "openai",
    );

    const normalized = normalizeReference(reference);
    const canonicalRef =
      getString(body.canonical_ref) ||
      getString(body.canonicalRef) ||
      normalized.canonical_ref ||
      reference;

    const passageId = buildPassageId(canonicalRef);
    const genre = getString(body.genre);
    const maxCards = Math.min(Math.max(getNumber(body.maxCards, 6), 1), 12);

    const verseResult = await getVerseText(reference, lang, detectorProvider);
    const verseTextRu = verseResult.text.trim();

    if (!verseTextRu) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not load Russian verse text.",
          reference,
          canonical_ref: canonicalRef,
        },
        { status: 500 },
      );
    }

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
          error: cardsResult.error ?? "Failed to read existing Studio cards.",
          reference,
          canonical_ref: canonicalRef,
        },
        { status: 500 },
      );
    }

    const existingCards = cardsResult.cards.map(toExistingCoverageCard);

    const detectorResult = await runRealVerseTextOnlyPreview({
      reference,
      canonicalRef,
      passageId,
      verseTextRu,
      passageTextRu: verseTextRu,
      existingCards,
      detectorProvider,
      judgeProvider,
      verifierProvider,
      genre,
    });

    const signals = detectorResult.queue.map(summarizeSignal);
    const eligibleSignals = signals.filter(
      (signal) => signal.suggested_lane === "public_preview_ok",
    );
    const researchOnlySignals = signals.filter(
      (signal) => signal.suggested_lane === "research_only",
    );
    const discardedSignals = signals.filter(
      (signal) => signal.suggested_lane === "discarded",
    );
    const unknownSignals = signals.filter(
      (signal) => signal.suggested_lane === "unknown",
    );

    let crafterPrompt: string | null = null;
    let crafterRawText: string | null = null;
    let draftCards: DraftPearlCard[] = [];
    let parsedCrafterJson: unknown = null;
    let crafterParseError: string | null = null;

    if (eligibleSignals.length > 0) {
      crafterPrompt = buildCrafterPrompt({
        reference,
        verseTextRu,
        eligibleSignals,
        researchOnlySignals,
        existingCards: cardsResult.cards.map(summarizeExistingCard),
        maxCards,
      });

      crafterRawText = await runAI(crafterProvider, crafterPrompt, "ru", true);

      const parsed = parseCrafterCards(crafterRawText);
      draftCards = parsed.cards;
      parsedCrafterJson = parsed.parsed_json;
      crafterParseError = parsed.parse_error;
    }

    return NextResponse.json({
      ok: detectorResult.ok && !crafterParseError,
      mode: "two_stage_pearls_editorial_preview",
      changed_database: false,

      reference,
      canonical_ref: canonicalRef,
      book_key: normalized.book_key ?? null,
      passage_id: passageId,
      lang,

      providers: {
        detector: detectorProvider,
        crafter: crafterProvider,
        judge: judgeProvider,
        verifier: verifierProvider,
      },

      source: {
        verse_text_source: "getVerseText ru local-first",
        verse_reference_returned: verseResult.reference,
        surface_translation: "rstj_yahweh",
      },

      existing_card_count: cardsResult.cards.length,
      active_or_reserve_count: cardsResult.cards.filter(
        (card) => card.status === "featured" || card.status === "reserve",
      ).length,

      detector_summary: getDetectorSummary(detectorResult, signals),

      editorial_preview: {
        draft_cards: draftCards,
        eligible_signals: eligibleSignals,
        research_only_signals: researchOnlySignals,
        discarded_signals: discardedSignals,
        unknown_signals: unknownSignals,
        existing_cards: cardsResult.cards.map(summarizeExistingCard),
      },

      raw: {
        detector_result: detectorResult,
        crafter_prompt: crafterPrompt,
        crafter_raw_text: crafterRawText,
        crafter_parsed_json: parsedCrafterJson,
        crafter_parse_error: crafterParseError,
      },
    });
  } catch (error) {
    console.error("[TWO_STAGE_PEARLS_PREVIEW] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to run two-stage Pearls preview.",
      },
      { status: 500 },
    );
  }
}
