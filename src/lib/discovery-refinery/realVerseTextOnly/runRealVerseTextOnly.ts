import { runAI } from "@/lib/ai/runAI";
import type { Provider } from "@/lib/ai/providers";
import {
  createAngleFingerprint,
  createDeterministicId,
} from "../fingerprint";
import { buildSameAngleJudgePrompt } from "../prompts";
import type {
  AngleFingerprint,
  DiscoverySignal,
  ExistingCoverageCard,
  ModeratorQueueItem,
  RiskFlag,
  SameAngleVerdict,
  VerifierVerdict,
} from "../types";

type JsonRecord = Record<string, unknown>;

type DetectorOutputStatus =
  | "detector_failed"
  | "declared_no_signals"
  | "signals_parsed"
  | "unparseable_text";

type SignalFlow = {
  detector_output_status: DetectorOutputStatus;
  detector_declared_no_signals: boolean;
  parsed_signal_count: number;
  queue_item_count: number;
  discarded_count: number;
  rewrite_count: number;
  approved_count: number;
  all_parsed_signals_discarded: boolean;
  no_signals_reason: string | null;
};

type TextDetectorSignalSeed = {
  anchor: string;
  specificWords: string[];
  observation: string;
  surprise: string;
  evidenceLevel: DiscoverySignal["evidence_level"];
  angleFamily: AngleFingerprint["angle_family"];
  riskFlags: RiskFlag[];
  phenomenon: string;
  interpretiveMove: string;
};

export type RealVerseDiagnosticItem = {
  signal_id: string;
  reader_surprise_ru: string | null;
  core_observation: string;
  existing_cards_count: number;
  nearest_existing_cards: ExistingCoverageCard[];
  hash_duplicate_card: ExistingCoverageCard | null;
  judge_raw_response: string | null;
  verifier_raw_response: string | null;
  normalized_same_angle_verdict: SameAngleVerdict;
  normalized_verifier_verdict: VerifierVerdict;
};

export type RealVerseTextOnlyResult = {
  ok: boolean;
  mode: "real_text_only";
  reference: string;
  canonical_ref: string;
  passage_id: string;

  lang: "ru";
  surface_lang: "ru";
  surface_translation: "rstj_yahweh";
  pipeline_language_mode: "russian_first_text_only_v1";
  experiment_id: "real_studio_10_runs_text_only_v1";

  detector_provider: Provider;
  judge_provider: Provider;
  verifier_provider: Provider;

  detector_raw_text: string | null;
  detector_output_status: DetectorOutputStatus;
  detector_declared_no_signals: boolean;
  detector_signal_count: number;

  signal_flow: SignalFlow;
  scope_decision: Record<string, unknown>;
  input_context_snapshot: Record<string, unknown>;

  queue: ModeratorQueueItem[];
  diagnostics: RealVerseDiagnosticItem[];

  action_counts: {
    approve_reserve: number;
    approve_active: number;
    rewrite: number;
    replace_existing: number;
    discard: number;
    send_back: number;
    mark_for_external_research: number;
  };

  tier_counts: {
    A_routine: number;
    B_conflict: number;
    C_risk_escalation: number;
  };

  errors: string[];
  created_at: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function stringifyForPrompt(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json|text)?\s*/i, "")
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

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    } catch {
      // Continue to object extraction.
    }
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    } catch {
      // Ignore.
    }
  }

  return null;
}

function parseJsonObject(text: string): JsonRecord | null {
  const parsed = extractFirstJson(text);
  return isRecord(parsed) ? parsed : null;
}

function parseJsonArray(text: string): unknown[] | null {
  const parsed = extractFirstJson(text);
  return Array.isArray(parsed) ? parsed : null;
}

function getNestedRecord(
  record: JsonRecord | null | undefined,
  key: string,
): JsonRecord | null {
  if (!record) return null;
  const value = record[key];
  return isRecord(value) ? value : null;
}

function normalizeRiskFlags(value: unknown): RiskFlag[] {
  const allowed = new Set<RiskFlag>([
    "lexical_overclaim",
    "intertext_speculative",
    "historical_overclaim",
    "theological_overreach",
    "meaningful_absence_unsafe",
    "self_generated_echo",
    "pretty_but_empty",
  ]);

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is RiskFlag => allowed.has(item as RiskFlag));
  }

  if (typeof value !== "string") return [];

  const lower = value.toLowerCase();

  if (
    lower === "none" ||
    lower === "no" ||
    lower === "нет" ||
    lower === "без" ||
    lower === "-"
  ) {
    return [];
  }

  const flags = new Set<RiskFlag>();

  if (lower.includes("lexical_overclaim") || lower.includes("лекс")) {
    flags.add("lexical_overclaim");
  }

  if (lower.includes("intertext") || lower.includes("межтекст")) {
    flags.add("intertext_speculative");
  }

  if (lower.includes("historical") || lower.includes("истор")) {
    flags.add("historical_overclaim");
  }

  if (lower.includes("theological") || lower.includes("богослов")) {
    flags.add("theological_overreach");
  }

  if (
    lower.includes("meaningful_absence") ||
    lower.includes("absence") ||
    lower.includes("отсутств")
  ) {
    flags.add("meaningful_absence_unsafe");
  }

  if (lower.includes("self_generated") || lower.includes("echo")) {
    flags.add("self_generated_echo");
  }

  if (lower.includes("pretty_but_empty") || lower.includes("пуст")) {
    flags.add("pretty_but_empty");
  }

  return Array.from(flags);
}

function normalizeEvidenceLevel(
  value: unknown,
): DiscoverySignal["evidence_level"] {
  const text = typeof value === "string" ? value.trim().toLowerCase() : value;

  if (text === "strong" || text === "сильная" || text === "сильный") {
    return "strong";
  }

  if (
    text === "plausible" ||
    text === "moderate" ||
    text === "medium" ||
    text === "средняя" ||
    text === "вероятная" ||
    text === "правдоподобная"
  ) {
    return "plausible";
  }

  if (text === "weak" || text === "слабая" || text === "слабый") {
    return "weak";
  }

  return "plausible";
}

function normalizeAngleFamily(
  value: unknown,
): AngleFingerprint["angle_family"] {
  const allowed = new Set<AngleFingerprint["angle_family"]>([
    "lexical",
    "rhetorical",
    "structural",
    "translation",
    "intertextual",
    "historical",
    "paradox_tension",
    "meaningful_absence",
    "contextual",
    "discourse_function",
    "metaphor_image",
    "other",
  ]);

  if (
    typeof value === "string" &&
    allowed.has(value.trim() as AngleFingerprint["angle_family"])
  ) {
    return value.trim() as AngleFingerprint["angle_family"];
  }

  const lower = typeof value === "string" ? value.toLowerCase() : "";

  if (lower.includes("лекс")) return "lexical";
  if (lower.includes("ритор")) return "rhetorical";
  if (lower.includes("структ")) return "structural";
  if (lower.includes("перевод")) return "translation";
  if (lower.includes("межтекст")) return "intertextual";
  if (lower.includes("истор")) return "historical";
  if (lower.includes("парадокс") || lower.includes("напряж")) {
    return "paradox_tension";
  }
  if (lower.includes("отсутств")) return "meaningful_absence";
  if (lower.includes("контекст")) return "contextual";
  if (lower.includes("дискурс")) return "discourse_function";
  if (lower.includes("метафор") || lower.includes("образ")) {
    return "metaphor_image";
  }

  return "other";
}

function inferAngleFamilyFromObservation(
  observation: string,
): AngleFingerprint["angle_family"] {
  const lower = observation.toLowerCase();

  if (lower.includes("слово") || lower.includes("лекс")) return "lexical";
  if (lower.includes("союз") || lower.includes("ритор")) return "rhetorical";
  if (lower.includes("структ") || lower.includes("повтор")) {
    return "structural";
  }
  if (lower.includes("перевод")) return "translation";
  if (lower.includes("другим стих") || lower.includes("межтекст")) {
    return "intertextual";
  }
  if (lower.includes("истор")) return "historical";
  if (lower.includes("парадокс") || lower.includes("напряж")) {
    return "paradox_tension";
  }
  if (lower.includes("отсутств")) return "meaningful_absence";
  if (lower.includes("контекст")) return "contextual";
  if (lower.includes("переход") || lower.includes("дискурс")) {
    return "discourse_function";
  }
  if (lower.includes("образ") || lower.includes("метафор")) {
    return "metaphor_image";
  }

  return "rhetorical";
}

function inferPhenomenon(observation: string, anchor: string): string {
  const lower = `${observation} ${anchor}`.toLowerCase();

  if (
    lower.includes("ибо") ||
    lower.includes("потому") ||
    lower.includes("союз")
  ) {
    return "causal_connector_as_argument_signal";
  }

  if (lower.includes("повтор") || lower.includes("повторяется")) {
    return "repetition_as_structural_signal";
  }

  if (lower.includes("список") || lower.includes("перечень")) {
    return "list_logic_as_rhetorical_structure";
  }

  if (lower.includes("контраст") || lower.includes("противопостав")) {
    return "contrast_as_argument_structure";
  }

  if (lower.includes("агент") || lower.includes("субъект")) {
    return "agency_shift_in_textual_structure";
  }

  if (lower.includes("отсутств")) {
    return "meaningful_absence_in_surface_text";
  }

  if (lower.includes("вопрос") || lower.includes("ответ")) {
    return "question_answer_structure";
  }

  return "textual_detail_creates_discovery";
}

function inferInterpretiveMove(observation: string, surprise: string): string {
  const lower = `${observation} ${surprise}`.toLowerCase();

  if (lower.includes("довер")) {
    return "textual_detail_reframes_trust_basis";
  }

  if (lower.includes("команд") || lower.includes("повел")) {
    return "textual_detail_reframes_command_logic";
  }

  if (lower.includes("покой")) {
    return "textual_detail_reframes_rest_result";
  }

  if (lower.includes("симуляц") || lower.includes("видимость")) {
    return "textual_detail_separates_appearance_from_reality";
  }

  if (lower.includes("отец") || lower.includes("сын")) {
    return "textual_detail_creates_narrative_tension";
  }

  if (lower.includes("не слабость") || lower.includes("слабост")) {
    return "wording_expands_reader_semantic_assumption";
  }

  return "specific_wording_changes_reader_assumption";
}

function parseSpecificWords(text: string, anchor: string): string[] {
  const raw = text.trim();

  if (!raw || raw.toLowerCase() === "none" || raw.toLowerCase() === "нет") {
    return anchor
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return raw
    .split(/[,;·|]/)
    .map((item) => item.trim().replace(/^["«]+|["»]+$/g, ""))
    .filter(Boolean);
}

function normalizeSurprise(text: string, observation: string): string {
  const trimmed = text.trim();

  if (trimmed) {
    if (trimmed.toLowerCase().startsWith("я не замечал")) {
      return trimmed;
    }

    return `Я не замечал, что ${trimmed.replace(/^что\s+/i, "")}`;
  }

  return `Я не замечал, что ${observation}`;
}

function parseLabeledTextBlock(block: string): Record<string, string> {
  const labels: Record<string, string> = {
    якорь: "anchor",
    anchor: "anchor",
    "textual anchor": "anchor",

    слова: "specificWords",
    "specific words": "specificWords",
    words: "specificWords",

    наблюдение: "observation",
    observation: "observation",
    "core observation": "observation",

    открытие: "surprise",
    surprise: "surprise",
    "reader surprise": "surprise",

    доказательность: "evidenceLevel",
    evidence: "evidenceLevel",
    "evidence level": "evidenceLevel",

    семья: "angleFamily",
    family: "angleFamily",
    "angle family": "angleFamily",

    риск: "riskFlags",
    риски: "riskFlags",
    risk: "riskFlags",
    "risk flags": "riskFlags",

    феномен: "phenomenon",
    phenomenon: "phenomenon",

    ход: "interpretiveMove",
    "interpretive move": "interpretiveMove",
    move: "interpretiveMove",
  };

  const result: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) continue;

    const match = line.match(/^([^:：]{2,40})[:：]\s*(.*)$/);

    if (match) {
      const rawLabel = match[1].trim().toLowerCase();
      const mapped = labels[rawLabel];

      if (mapped) {
        currentKey = mapped;
        result[currentKey] = match[2].trim();
        continue;
      }
    }

    if (currentKey) {
      result[currentKey] = `${result[currentKey] ?? ""} ${line}`.trim();
    }
  }

  return result;
}

function detectorDeclaredNoSignals(text: string | null): boolean {
  if (!text) return false;

  const cleaned = stripCodeFence(text);

  return (
    /^NO_SIGNALS\s*$/i.test(cleaned) ||
    /^НЕТ_СИГНАЛОВ\s*$/i.test(cleaned) ||
    /^НЕТ СИГНАЛОВ\s*$/i.test(cleaned)
  );
}

function parseTextDetectorBlocks(text: string): string[] {
  const cleaned = stripCodeFence(text);

  if (detectorDeclaredNoSignals(cleaned)) {
    return [];
  }

  const withMarkers = cleaned.replace(
    /(^|\n)\s*(СИГНАЛ|SIGNAL)\s*\d*\s*[:\-—]?\s*/gi,
    "\n<<<SIGNAL_BLOCK>>>",
  );

  const parts = withMarkers
    .split("<<<SIGNAL_BLOCK>>>")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts;

  return cleaned.trim() ? [cleaned.trim()] : [];
}

function parseTextDetectorSignals(text: string): TextDetectorSignalSeed[] {
  const blocks = parseTextDetectorBlocks(text);
  const seeds: TextDetectorSignalSeed[] = [];

  for (const block of blocks) {
    const fields = parseLabeledTextBlock(block);

    const anchor = (fields.anchor ?? "").trim();
    const observation = (fields.observation ?? "").trim();

    if (!anchor || !observation) continue;

    const surprise = normalizeSurprise(fields.surprise ?? "", observation);
    const angleFamily =
      normalizeAngleFamily(fields.angleFamily) ||
      inferAngleFamilyFromObservation(observation);

    const finalFamily =
      angleFamily === "other"
        ? inferAngleFamilyFromObservation(observation)
        : angleFamily;

    const phenomenon =
      fields.phenomenon?.trim() || inferPhenomenon(observation, anchor);

    const interpretiveMove =
      fields.interpretiveMove?.trim() ||
      inferInterpretiveMove(observation, surprise);

    seeds.push({
      anchor,
      specificWords: parseSpecificWords(fields.specificWords ?? "", anchor),
      observation,
      surprise,
      evidenceLevel: normalizeEvidenceLevel(fields.evidenceLevel),
      angleFamily: finalFamily,
      riskFlags: normalizeRiskFlags(fields.riskFlags),
      phenomenon,
      interpretiveMove,
    });
  }

  return seeds;
}

function normalizeDetectorSignal(
  value: unknown,
  index: number,
  runId: string,
  context: {
    reference: string;
    canonicalRef: string;
    passageId: string;
  },
): DiscoverySignal | null {
  if (!isRecord(value)) return null;

  const textualAnchor = getNestedRecord(value, "textual_anchor");
  const canonical = getNestedRecord(textualAnchor, "canonical");
  const surfaces = getNestedRecord(textualAnchor, "surfaces");
  const surfaceRu = getNestedRecord(surfaces, "ru");

  const angleFingerprint = getNestedRecord(value, "angle_fingerprint");

  const canonicalQuote =
    toString(canonical?.quote) ||
    toString(canonical?.text) ||
    toString(surfaceRu?.quote);

  const surfaceQuote = toString(surfaceRu?.quote) || canonicalQuote;

  const surfaceWords = toStringArray(surfaceRu?.specific_words);
  const canonicalWords = toStringArray(canonical?.specific_words);
  const specificWords = surfaceWords.length > 0 ? surfaceWords : canonicalWords;

  const coreObservation = toString(value.core_observation);

  const readerSurprise = getNestedRecord(value, "reader_surprise_sentence");
  const readerSurpriseRu =
    toString(readerSurprise?.ru) || toString(value.reader_surprise_sentence);

  const phenomenon = toString(angleFingerprint?.phenomenon);
  const interpretiveMove = toString(angleFingerprint?.interpretive_move);
  const angleFamily = normalizeAngleFamily(angleFingerprint?.angle_family);

  if (
    !canonicalQuote ||
    !surfaceQuote ||
    !coreObservation ||
    !readerSurpriseRu ||
    !phenomenon ||
    !interpretiveMove
  ) {
    return null;
  }

  const fingerprint = createAngleFingerprint({
    anchor_canonical: {
      lang: "ru",
      text: canonicalQuote,
      canonical_pending: true,
    },
    phenomenon,
    phenomenon_status:
      angleFingerprint?.phenomenon_status === "approved_vocab"
        ? "approved_vocab"
        : "proposed_new",
    interpretive_move: interpretiveMove,
    interpretive_move_status:
      angleFingerprint?.interpretive_move_status === "approved_vocab"
        ? "approved_vocab"
        : "proposed_new",
    angle_family: angleFamily,
  });

  const signalSeed = {
    reference: context.reference,
    canonicalRef: context.canonicalRef,
    passageId: context.passageId,
    index,
    runId,
    fingerprint_hash: fingerprint.hash,
    coreObservation,
    readerSurpriseRu,
  };

  const rawSignalId = toString(value.signal_id);

  return {
    signal_id:
      rawSignalId && rawSignalId !== "temporary_detector_id_ok"
        ? rawSignalId
        : createDeterministicId("sig", signalSeed),

    reference: context.reference,
    canonical_ref: context.canonicalRef,
    passage_id: context.passageId,

    primary_lang: "ru",

    textual_anchor: {
      canonical: {
        lang: "ru",
        quote: canonicalQuote,
        specific_words: specificWords,
        canonical_pending: true,
      },
      surfaces: {
        ru: {
          quote: surfaceQuote,
          specific_words: specificWords,
          translation_source: "RSTJ 1876 / Synodal Yahweh Edition",
        },
        en: null,
        es: null,
      },
    },

    core_observation: coreObservation,

    reader_surprise_sentence: {
      ru: readerSurpriseRu,
      en: null,
      es: null,
    },

    angle_fingerprint: fingerprint,

    source_basis: {
      primary: "verse_text_only",
      has_self_generated_context: false,
    },

    evidence_level: normalizeEvidenceLevel(value.evidence_level),
    risk_flags: normalizeRiskFlags(value.risk_flags),

    relation_to_existing: null,
    verifier_verdict: null,
    suggested_next_action: null,

    detector_id: "real_text_only_argument_structure_mapping_v1",
    run_id: runId,
    created_at: new Date().toISOString(),

    metadata: {
      normalized_from_detector: true,
      detector_index: index,
      detector_format: "json",
      experiment_id: "real_studio_10_runs_text_only_v1",
      pipeline_language_mode: "russian_first_text_only_v1",
      language_scope: "surface_only",
      cross_lingual_status: "not_assessed",
      original_text_consulted: false,
      surface_translation: "rstj_yahweh",
      fingerprint_version: 1,
      anchor_canonical_strategy: "surface_word",
      canonical_source_lang: "ru",
      canonical_pending: true,
    },
  };
}

function createSignalFromTextSeed(args: {
  seed: TextDetectorSignalSeed;
  index: number;
  runId: string;
  context: {
    reference: string;
    canonicalRef: string;
    passageId: string;
  };
}): DiscoverySignal {
  const fingerprint = createAngleFingerprint({
    anchor_canonical: {
      lang: "ru",
      text: args.seed.anchor,
      canonical_pending: true,
    },
    phenomenon: args.seed.phenomenon,
    phenomenon_status: "proposed_new",
    interpretive_move: args.seed.interpretiveMove,
    interpretive_move_status: "proposed_new",
    angle_family: args.seed.angleFamily,
  });

  const signalSeed = {
    reference: args.context.reference,
    canonicalRef: args.context.canonicalRef,
    passageId: args.context.passageId,
    index: args.index,
    runId: args.runId,
    fingerprint_hash: fingerprint.hash,
    coreObservation: args.seed.observation,
    readerSurpriseRu: args.seed.surprise,
  };

  return {
    signal_id: createDeterministicId("sig", signalSeed),

    reference: args.context.reference,
    canonical_ref: args.context.canonicalRef,
    passage_id: args.context.passageId,

    primary_lang: "ru",

    textual_anchor: {
      canonical: {
        lang: "ru",
        quote: args.seed.anchor,
        specific_words: args.seed.specificWords,
        canonical_pending: true,
      },
      surfaces: {
        ru: {
          quote: args.seed.anchor,
          specific_words: args.seed.specificWords,
          translation_source: "RSTJ 1876 / Synodal Yahweh Edition",
        },
        en: null,
        es: null,
      },
    },

    core_observation: args.seed.observation,

    reader_surprise_sentence: {
      ru: args.seed.surprise,
      en: null,
      es: null,
    },

    angle_fingerprint: fingerprint,

    source_basis: {
      primary: "verse_text_only",
      has_self_generated_context: false,
    },

    evidence_level: args.seed.evidenceLevel,
    risk_flags: args.seed.riskFlags,

    relation_to_existing: null,
    verifier_verdict: null,
    suggested_next_action: null,

    detector_id: "real_text_only_argument_structure_mapping_v1",
    run_id: args.runId,
    created_at: new Date().toISOString(),

    metadata: {
      normalized_from_detector: true,
      detector_index: args.index,
      detector_format: "text_first",
      experiment_id: "real_studio_10_runs_text_only_v1",
      pipeline_language_mode: "russian_first_text_only_v1",
      language_scope: "surface_only",
      cross_lingual_status: "not_assessed",
      original_text_consulted: false,
      surface_translation: "rstj_yahweh",
      fingerprint_version: 1,
      anchor_canonical_strategy: "surface_word",
      canonical_source_lang: "ru",
      canonical_pending: true,
    },
  };
}

function parseDetectorOutputToSignals(args: {
  detectorRawText: string;
  runId: string;
  context: {
    reference: string;
    canonicalRef: string;
    passageId: string;
  };
}): DiscoverySignal[] {
  const parsedArray = parseJsonArray(args.detectorRawText);

  if (parsedArray) {
    return parsedArray
      .map((item, index) =>
        normalizeDetectorSignal(item, index, args.runId, args.context),
      )
      .filter((item): item is DiscoverySignal => item !== null);
  }

  const seeds = parseTextDetectorSignals(args.detectorRawText);

  return seeds.map((seed, index) =>
    createSignalFromTextSeed({
      seed,
      index,
      runId: args.runId,
      context: args.context,
    }),
  );
}

function findHashDuplicate(
  signal: DiscoverySignal,
  existingCards: ExistingCoverageCard[],
): ExistingCoverageCard | null {
  return (
    existingCards.find(
      (card) => card.fingerprint_hash === signal.angle_fingerprint.hash,
    ) ?? null
  );
}

function selectNearestExistingCards(
  signal: DiscoverySignal,
  existingCards: ExistingCoverageCard[],
  limit = 5,
): ExistingCoverageCard[] {
  const ruSurface = signal.textual_anchor.surfaces.ru;
  const anchorCandidates = [
    ruSurface?.quote,
    ...(ruSurface?.specific_words ?? []),
    signal.angle_fingerprint.anchor_canonical.text,
  ];

  const anchorWords = new Set(
    anchorCandidates
      .filter(Boolean)
      .map((item) => String(item).toLowerCase()),
  );

  return existingCards
    .map((card) => {
      let score = 0;

      const cardAnchor = `${card.anchor_surface ?? ""} ${
        card.anchor_canonical ?? ""
      }`.toLowerCase();

      for (const word of anchorWords) {
        if (word && cardAnchor.includes(word)) score += 3;
      }

      if (card.angle_family === signal.angle_fingerprint.angle_family) {
        score += 2;
      }

      if (
        card.fingerprint_components?.phenomenon ===
        signal.angle_fingerprint.phenomenon
      ) {
        score += 2;
      }

      if (
        card.fingerprint_components?.interpretive_move ===
        signal.angle_fingerprint.interpretive_move
      ) {
        score += 2;
      }

      if (card.status === "featured") score += 1;

      return { card, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.card);
}

function normalizeSameAngleVerdict(
  value: JsonRecord | null,
  signal: DiscoverySignal,
  fallbackVerdict: SameAngleVerdict["verdict"],
  comparedAgainst: string[],
): SameAngleVerdict {
  const verdict = toString(value?.verdict);

  const allowed = new Set<SameAngleVerdict["verdict"]>([
    "same_angle",
    "partial_overlap",
    "new_angle",
    "stronger_version",
    "pretty_but_empty",
    "risky_overclaim",
  ]);

  const confidence = toString(value?.judge_confidence);

  return {
    signal_id: signal.signal_id,
    verdict: allowed.has(verdict as SameAngleVerdict["verdict"])
      ? (verdict as SameAngleVerdict["verdict"])
      : fallbackVerdict,
    compared_against:
      toStringArray(value?.compared_against).length > 0
        ? toStringArray(value?.compared_against)
        : comparedAgainst,
    overlap_explanation: toString(value?.overlap_explanation) || null,
    differentiation_required: toString(value?.differentiation_required) || null,
    judge_confidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : "medium",
  };
}

function normalizeVerifierVerdict(
  value: JsonRecord | null,
  signal: DiscoverySignal,
): VerifierVerdict {
  const risk = isRecord(value?.risk_assessment) ? value.risk_assessment : {};

  const overall = toString(value?.overall);

  return {
    signal_id: signal.signal_id,
    discovery_present: value?.discovery_present === true,
    anchor_precise: value?.anchor_precise === true,
    evidence_supports_claim: value?.evidence_supports_claim === true,
    consistency_check: value?.consistency_check === true,
    risk_assessment: {
      lexical_overclaim: risk.lexical_overclaim === true,
      intertext_speculative: risk.intertext_speculative === true,
      historical_overclaim: risk.historical_overclaim === true,
      theological_overreach: risk.theological_overreach === true,
      meaningful_absence_unsafe: risk.meaningful_absence_unsafe === true,
      self_generated_echo: risk.self_generated_echo === true,
    },
    pretty_but_empty: value?.pretty_but_empty === true,
    overall:
      overall === "pass" || overall === "fail" || overall === "needs_patch"
        ? overall
        : "fail",
    patch_instruction: toString(value?.patch_instruction) || null,
    rejection_reason: toString(value?.rejection_reason) || null,
  };
}

function createDeterministicVerifierVerdict(args: {
  signal: DiscoverySignal;
  kind: "lexical_overclaim" | "pretty_but_empty" | "hash_duplicate";
}): VerifierVerdict {
  if (args.kind === "lexical_overclaim") {
    return {
      signal_id: args.signal.signal_id,
      discovery_present: true,
      anchor_precise: true,
      evidence_supports_claim: false,
      consistency_check: true,
      risk_assessment: {
        lexical_overclaim: true,
        intertext_speculative: false,
        historical_overclaim: false,
        theological_overreach: false,
        meaningful_absence_unsafe: false,
        self_generated_echo: false,
      },
      pretty_but_empty: false,
      overall: "fail",
      patch_instruction: null,
      rejection_reason:
        "Code decision: lexical overclaim risk was already present on the signal.",
    };
  }

  if (args.kind === "pretty_but_empty") {
    return {
      signal_id: args.signal.signal_id,
      discovery_present: false,
      anchor_precise: true,
      evidence_supports_claim: false,
      consistency_check: true,
      risk_assessment: {
        lexical_overclaim: false,
        intertext_speculative: false,
        historical_overclaim: false,
        theological_overreach: false,
        meaningful_absence_unsafe: false,
        self_generated_echo: false,
      },
      pretty_but_empty: true,
      overall: "fail",
      patch_instruction: null,
      rejection_reason:
        "Code decision: signal was already classified as pretty-but-empty.",
    };
  }

  return {
    signal_id: args.signal.signal_id,
    discovery_present: true,
    anchor_precise: true,
    evidence_supports_claim: true,
    consistency_check: true,
    risk_assessment: {
      lexical_overclaim: false,
      intertext_speculative: false,
      historical_overclaim: false,
      theological_overreach: false,
      meaningful_absence_unsafe: false,
      self_generated_echo: false,
    },
    pretty_but_empty: false,
    overall: "pass",
    patch_instruction: null,
    rejection_reason: null,
  };
}

function hasAnyRisk(verdict: VerifierVerdict): boolean {
  return Object.values(verdict.risk_assessment).some(Boolean);
}

function getTier(args: {
  sameAngleVerdict: SameAngleVerdict;
  verifierVerdict: VerifierVerdict;
  signal: DiscoverySignal;
}): ModeratorQueueItem["tier"] {
  if (
    args.signal.risk_flags.length > 0 ||
    hasAnyRisk(args.verifierVerdict) ||
    args.sameAngleVerdict.verdict === "risky_overclaim"
  ) {
    return "C_risk_escalation";
  }

  if (
    args.sameAngleVerdict.verdict === "partial_overlap" ||
    args.sameAngleVerdict.verdict === "stronger_version"
  ) {
    return "B_conflict";
  }

  return "A_routine";
}

function getSuggestedAction(args: {
  sameAngleVerdict: SameAngleVerdict;
  verifierVerdict: VerifierVerdict;
  signal: DiscoverySignal;
}): ModeratorQueueItem["suggested_action"] {
  if (
    args.verifierVerdict.pretty_but_empty ||
    args.sameAngleVerdict.verdict === "pretty_but_empty"
  ) {
    return "discard";
  }

  if (args.sameAngleVerdict.verdict === "same_angle") {
    return "discard";
  }

  if (args.verifierVerdict.overall === "fail") {
    return "discard";
  }

  if (args.verifierVerdict.overall === "needs_patch") {
    return "rewrite";
  }

  if (hasAnyRisk(args.verifierVerdict)) {
    return "rewrite";
  }

  if (args.sameAngleVerdict.verdict === "risky_overclaim") {
    return "rewrite";
  }

  if (args.sameAngleVerdict.verdict === "stronger_version") {
    return "replace_existing";
  }

  if (args.sameAngleVerdict.verdict === "partial_overlap") {
    return "rewrite";
  }

  if (
    args.sameAngleVerdict.verdict === "new_angle" &&
    args.verifierVerdict.overall === "pass" &&
    (args.signal.evidence_level === "strong" ||
      args.signal.evidence_level === "plausible")
  ) {
    return "approve_reserve";
  }

  return "discard";
}

function createQueueItem(args: {
  signal: DiscoverySignal;
  nearestExistingCards: ExistingCoverageCard[];
  sameAngleVerdict: SameAngleVerdict;
  verifierVerdict: VerifierVerdict;
  verseTextRu: string;
}): ModeratorQueueItem {
  const tier = getTier({
    sameAngleVerdict: args.sameAngleVerdict,
    verifierVerdict: args.verifierVerdict,
    signal: args.signal,
  });

  const suggestedAction = getSuggestedAction({
    sameAngleVerdict: args.sameAngleVerdict,
    verifierVerdict: args.verifierVerdict,
    signal: args.signal,
  });

  const availableActions: ModeratorQueueItem["available_actions"] =
    tier === "A_routine"
      ? ["approve_active", "approve_reserve", "send_back", "discard"]
      : tier === "B_conflict"
        ? ["approve_reserve", "replace_existing", "rewrite", "discard"]
        : ["rewrite", "discard", "mark_for_external_research"];

  return {
    queue_item_id: createDeterministicId("q", {
      signal_id: args.signal.signal_id,
      same_angle: args.sameAngleVerdict.verdict,
      verifier: args.verifierVerdict.overall,
    }),
    decision_type: "angle_approval",
    tier,

    signal: {
      ...args.signal,
      relation_to_existing: args.sameAngleVerdict,
      verifier_verdict: args.verifierVerdict,
      suggested_next_action: suggestedAction,
    },

    card_draft: null,

    context: {
      verse_with_anchor_highlighted: args.verseTextRu,
      nearest_existing_cards: args.nearestExistingCards,
      fingerprint_diff: null,
      existing_language_versions: null,
    },

    verdicts: {
      same_angle: args.sameAngleVerdict,
      verifier: args.verifierVerdict,
    },

    suggested_action: suggestedAction,
    suggested_action_confidence:
      args.verifierVerdict.overall === "pass" &&
      args.sameAngleVerdict.judge_confidence === "high"
        ? "high"
        : "medium",

    available_actions: availableActions,

    moderator_decision: null,
    moderator_reasoning: null,
    moderator_decision_time_seconds: null,

    created_at: new Date().toISOString(),
    priority: tier === "C_risk_escalation" ? 5 : tier === "B_conflict" ? 4 : 3,
  };
}

function buildScopedVerifierPrompt(args: {
  signal: DiscoverySignal;
  sameAngleVerdict: SameAngleVerdict;
  verseTextRu: string;
  passageTextRu: string;
}): string {
  return [
    "You are the Verifier for Scriptura AI Discovery Refinery v1.",
    "",
    "YOUR TASK:",
    "Independently evaluate a DiscoverySignal across seven dimensions.",
    "You evaluate AFTER Same-Angle Judge has assigned a verdict.",
    "",
    "AUTHORIZED TEXTUAL SCOPE:",
    "Use only the supplied verse text and supplied passage text below.",
    "Do not use other verses from the chapter, cross-references, later/earlier events, historical background, Greek/Hebrew claims, or theology unless supplied explicitly below.",
    "",
    "SUPPLIED VERSE TEXT RU:",
    args.verseTextRu,
    "",
    "SUPPLIED PASSAGE TEXT RU:",
    args.passageTextRu,
    "",
    "INPUT — DISCOVERY SIGNAL:",
    stringifyForPrompt(args.signal),
    "",
    "INPUT — SAME-ANGLE VERDICT:",
    stringifyForPrompt(args.sameAngleVerdict),
    "",
    "EVALUATION DIMENSIONS:",
    "",
    "1. discovery_present:",
    "Does core_observation describe a specific, observable textual phenomenon?",
    "Or is it paraphrase, summary, devotional impression, or general explanation?",
    "",
    "2. anchor_precise:",
    "Is textual_anchor.surfaces.ru a citable phrase from the supplied verse/passage?",
    "Is it specific enough that one could underline it?",
    "",
    "3. evidence_supports_claim:",
    "Does the supplied text support core_observation?",
    "Or does the claim require external knowledge, original-language work, theological inference, or speculation?",
    "",
    "4. consistency_check:",
    "Is reader_surprise_sentence.ru a faithful reformulation of core_observation?",
    "Or does it introduce a new claim, sentiment, or angle?",
    "",
    "5. risk_assessment:",
    "- lexical_overclaim: claims about word meanings beyond what the supplied text shows.",
    "- intertext_speculative: pulls in other passages without explicit supplied evidence.",
    "- historical_overclaim: assumes historical context not evidenced in supplied text.",
    "- theological_overreach: makes doctrinal/theological claims beyond textual scope.",
    "- meaningful_absence_unsafe: claims author intentionally omitted something without evidence.",
    "- self_generated_echo: novelty appears to come from existing Scriptura output rather than the supplied text.",
    "",
    "6. pretty_but_empty:",
    "This is a separate explicit flag.",
    'Ask: "What specifically would a reader newly notice in the words of the supplied text?"',
    "If the answer is vague, sentimental, cosmetic, or general, set true.",
    "",
    "7. overall:",
    "pass | fail | needs_patch",
    "",
    "CRITICAL FAIL VS NEEDS_PATCH RULES:",
    "- Use fail when there is no real observable textual mechanism.",
    "- Use fail for unsupported Greek/Hebrew/original-language claims.",
    "- Use fail for theological or lexical interpretation that cannot be grounded in the supplied text.",
    "- Use fail for pretty-but-empty wording even if it sounds beautiful.",
    "- Use needs_patch when a real observable mechanism exists, but the wording is too absolute, too broad, or overstates the conclusion.",
    "- A real mechanism with overstrong wording should normally be needs_patch, not fail, if a safer wording could preserve the same mechanism.",
    "- A signal with any true risk_assessment flag cannot have overall: pass.",
    "- Day-1 forbids Greek lexical claims because Greek canonical anchor/source work is deferred.",
    "- If core_observation and reader_surprise_sentence.ru are not aligned, consistency_check must be false.",
    "",
    "OUTPUT JSON ONLY:",
    stringifyForPrompt({
      signal_id: args.signal.signal_id,
      discovery_present: true,
      anchor_precise: true,
      evidence_supports_claim: true,
      consistency_check: true,
      risk_assessment: {
        lexical_overclaim: false,
        intertext_speculative: false,
        historical_overclaim: false,
        theological_overreach: false,
        meaningful_absence_unsafe: false,
        self_generated_echo: false,
      },
      pretty_but_empty: false,
      overall: "pass | fail | needs_patch",
      patch_instruction: null,
      rejection_reason: null,
    }),
  ].join("\n");
}

async function processSignal(args: {
  signal: DiscoverySignal;
  existingCards: ExistingCoverageCard[];
  judgeProvider: Provider;
  verifierProvider: Provider;
  verseTextRu: string;
  passageTextRu: string;
}): Promise<{
  queueItem: ModeratorQueueItem;
  diagnostic: RealVerseDiagnosticItem;
}> {
  const hashDuplicate = findHashDuplicate(args.signal, args.existingCards);
  const nearestExistingCards = selectNearestExistingCards(
    args.signal,
    args.existingCards,
  );

  let sameAngleVerdict: SameAngleVerdict;
  let verifierVerdict: VerifierVerdict | null = null;
  let judgeRawResponse: string | null = null;
  let verifierRawResponse: string | null = null;

  if (args.signal.risk_flags.includes("lexical_overclaim")) {
    judgeRawResponse =
      "CODE_DECISION: signal was pre-flagged as lexical_overclaim. Same-Angle Judge was not called.";

    sameAngleVerdict = {
      signal_id: args.signal.signal_id,
      verdict: "risky_overclaim",
      compared_against: nearestExistingCards.map((card) => card.card_id),
      overlap_explanation:
        "Code decision: signal was pre-flagged as lexical_overclaim before Same-Angle Judge.",
      differentiation_required: null,
      judge_confidence: "high",
    };

    verifierRawResponse =
      "CODE_DECISION: deterministic verifier verdict for pre-flagged lexical_overclaim.";

    verifierVerdict = createDeterministicVerifierVerdict({
      signal: args.signal,
      kind: "lexical_overclaim",
    });
  } else if (args.signal.risk_flags.includes("pretty_but_empty")) {
    judgeRawResponse =
      "CODE_DECISION: signal was pre-flagged as pretty_but_empty. Same-Angle Judge was not called.";

    sameAngleVerdict = {
      signal_id: args.signal.signal_id,
      verdict: "pretty_but_empty",
      compared_against: nearestExistingCards.map((card) => card.card_id),
      overlap_explanation:
        "Code decision: signal was pre-flagged as pretty_but_empty before Same-Angle Judge.",
      differentiation_required: null,
      judge_confidence: "high",
    };

    verifierRawResponse =
      "CODE_DECISION: deterministic verifier verdict for pre-flagged pretty_but_empty.";

    verifierVerdict = createDeterministicVerifierVerdict({
      signal: args.signal,
      kind: "pretty_but_empty",
    });
  } else if (hashDuplicate) {
    judgeRawResponse =
      "CODE_DECISION: deterministic fingerprint hash matched an existing card. Same-Angle Judge was not called.";

    sameAngleVerdict = {
      signal_id: args.signal.signal_id,
      verdict: "same_angle",
      compared_against: [hashDuplicate.card_id],
      overlap_explanation:
        "Deterministic fingerprint hash matched an existing card before LLM judge.",
      differentiation_required: null,
      judge_confidence: "high",
    };

    verifierRawResponse =
      "CODE_DECISION: deterministic verifier pass for intrinsic signal quality; duplicate routing is handled by Same-Angle verdict.";

    verifierVerdict = createDeterministicVerifierVerdict({
      signal: args.signal,
      kind: "hash_duplicate",
    });
  } else {
    const judgePrompt = buildSameAngleJudgePrompt({
      signal: args.signal,
      nearestExistingCards,
    });

    judgeRawResponse = await runAI(args.judgeProvider, judgePrompt, "en", true);

    sameAngleVerdict = normalizeSameAngleVerdict(
      parseJsonObject(judgeRawResponse),
      args.signal,
      "new_angle",
      nearestExistingCards.map((card) => card.card_id),
    );

    if (sameAngleVerdict.verdict === "same_angle") {
      const signalFingerprint = args.signal.angle_fingerprint;

      const exactComponentMatch = nearestExistingCards.some((card) => {
        const components = card.fingerprint_components;
        if (!components) return false;

        return (
          components.anchor === signalFingerprint.anchor_canonical.text &&
          components.phenomenon === signalFingerprint.phenomenon &&
          components.interpretive_move === signalFingerprint.interpretive_move &&
          components.angle_family === signalFingerprint.angle_family
        );
      });

      if (!exactComponentMatch) {
        sameAngleVerdict = {
          ...sameAngleVerdict,
          verdict: "partial_overlap",
          overlap_explanation:
            sameAngleVerdict.overlap_explanation ??
            "Code guard: Judge said same_angle, but no exact fingerprint component match was found.",
          differentiation_required:
            sameAngleVerdict.differentiation_required ??
            "Moderator should check whether this shares only the anchor or actually repeats the same interpretive move.",
          judge_confidence:
            sameAngleVerdict.judge_confidence === "high"
              ? "medium"
              : sameAngleVerdict.judge_confidence,
        };
      }
    }
  }

  if (!verifierVerdict) {
    const verifierPrompt = buildScopedVerifierPrompt({
      signal: args.signal,
      sameAngleVerdict,
      verseTextRu: args.verseTextRu,
      passageTextRu: args.passageTextRu,
    });

    verifierRawResponse = await runAI(
      args.verifierProvider,
      verifierPrompt,
      "en",
      true,
    );

    verifierVerdict = normalizeVerifierVerdict(
      parseJsonObject(verifierRawResponse),
      args.signal,
    );
  }

  const queueItem = createQueueItem({
    signal: args.signal,
    nearestExistingCards,
    sameAngleVerdict,
    verifierVerdict,
    verseTextRu: args.verseTextRu,
  });

  const diagnostic: RealVerseDiagnosticItem = {
    signal_id: args.signal.signal_id,
    reader_surprise_ru: args.signal.reader_surprise_sentence.ru,
    core_observation: args.signal.core_observation,
    existing_cards_count: args.existingCards.length,
    nearest_existing_cards: nearestExistingCards,
    hash_duplicate_card: hashDuplicate,
    judge_raw_response: judgeRawResponse,
    verifier_raw_response: verifierRawResponse,
    normalized_same_angle_verdict: sameAngleVerdict,
    normalized_verifier_verdict: verifierVerdict,
  };

  return {
    queueItem,
    diagnostic,
  };
}

function countActions(
  queue: ModeratorQueueItem[],
): RealVerseTextOnlyResult["action_counts"] {
  return {
    approve_reserve: queue.filter(
      (item) => item.suggested_action === "approve_reserve",
    ).length,
    approve_active: queue.filter(
      (item) => item.suggested_action === "approve_active",
    ).length,
    rewrite: queue.filter((item) => item.suggested_action === "rewrite")
      .length,
    replace_existing: queue.filter(
      (item) => item.suggested_action === "replace_existing",
    ).length,
    discard: queue.filter((item) => item.suggested_action === "discard")
      .length,
    send_back: queue.filter((item) => item.suggested_action === "send_back")
      .length,
    mark_for_external_research: queue.filter(
      (item) => item.suggested_action === "mark_for_external_research",
    ).length,
  };
}

function countTiers(
  queue: ModeratorQueueItem[],
): RealVerseTextOnlyResult["tier_counts"] {
  return {
    A_routine: queue.filter((item) => item.tier === "A_routine").length,
    B_conflict: queue.filter((item) => item.tier === "B_conflict").length,
    C_risk_escalation: queue.filter(
      (item) => item.tier === "C_risk_escalation",
    ).length,
  };
}

function createSignalFlow(args: {
  detectorOutputStatus: DetectorOutputStatus;
  detectorDeclaredNoSignals: boolean;
  parsedSignalCount: number;
  queue: ModeratorQueueItem[];
  noSignalsReason?: string | null;
}): SignalFlow {
  const actionCounts = countActions(args.queue);

  return {
    detector_output_status: args.detectorOutputStatus,
    detector_declared_no_signals: args.detectorDeclaredNoSignals,
    parsed_signal_count: args.parsedSignalCount,
    queue_item_count: args.queue.length,
    discarded_count: actionCounts.discard,
    rewrite_count: actionCounts.rewrite,
    approved_count: actionCounts.approve_reserve + actionCounts.approve_active,
    all_parsed_signals_discarded:
      args.parsedSignalCount > 0 &&
      args.queue.length > 0 &&
      actionCounts.discard === args.queue.length,
    no_signals_reason: args.noSignalsReason ?? null,
  };
}

function getDetectorOutputStatus(args: {
  detectorRawText: string | null;
  detectorFailed?: boolean;
  signalCount: number;
}): DetectorOutputStatus {
  if (args.detectorFailed) return "detector_failed";
  if (args.detectorRawText && detectorDeclaredNoSignals(args.detectorRawText)) {
    return "declared_no_signals";
  }
  if (args.signalCount > 0) return "signals_parsed";
  return "unparseable_text";
}

function buildTextFirstDetectorPrompt(args: {
  reference: string;
  verseTextRu: string;
  passageTextRu: string;
  genre?: string | null;
}): string {
  return [
    "Ты — детектор Discovery Refinery для Scriptura AI.",
    "",
    "ЭКСПЕРИМЕНТ:",
    "Это один из 10 реальных text-only прогонов из Studio.",
    "Цель — проверить, достаточно ли Russian-first text-only pipeline до возврата к Source Packet / Original-Translation-Evidence архитектуре.",
    "",
    "Твоя задача — найти 0–3 настоящих текстовых сигнала, из которых позже можно сделать карточки-открытия.",
    "Не пиши готовые карточки.",
    "Не пиши проповедь.",
    "Не объясняй стих в целом.",
    "Ищи только конкретные текстовые механизмы: союз, повтор, контраст, порядок слов, список, переход агентности, вопрос-ответ, риторическую асимметрию, значимое отсутствие, напряжение повествования.",
    "",
    "ЖЁСТКАЯ ГРАНИЦА МАТЕРИАЛА:",
    "Используй только текст стиха и контекст/отрывок, которые даны ниже.",
    "Не используй Research Lake.",
    "Не используй существующие карточки Scriptura.",
    "Не используй прошлые AI-выводы.",
    "Не используй Source Packet.",
    "Не используй original-language packet.",
    "Не используй другие стихи из главы, если они не входят в данный ниже контекст/отрывок.",
    "Не используй общие библейские знания, перекрёстные ссылки, будущие/предыдущие события, исторический фон или греческий/еврейский язык, если это не дано явно ниже.",
    "Если мысль зависит от материала за пределами данного текста, не выдавай её.",
    "Если для бедного/формульного стиха нет сигнала внутри данного текста, верни НЕТ_СИГНАЛОВ.",
    "",
    "ВАЖНО:",
    "Не возвращай JSON.",
    "Не используй markdown-таблицу.",
    "Верни обычный текст в строгих блоках.",
    "Если сильных сигналов нет, верни ровно одну строку: НЕТ_СИГНАЛОВ",
    "",
    "Формат каждого сигнала:",
    "",
    "СИГНАЛ 1",
    "Якорь: короткая точная фраза из русского текста",
    "Слова: слово1, слово2",
    "Наблюдение: точное объяснение текстового механизма; не sermon",
    "Открытие: Я не замечал, что ...",
    "Доказательность: strong | plausible | weak",
    "Семья: rhetorical | structural | lexical | meaningful_absence | discourse_function | metaphor_image | contextual | other",
    "Риск: none | lexical_overclaim | intertext_speculative | historical_overclaim | theological_overreach | meaningful_absence_unsafe | self_generated_echo | pretty_but_empty",
    "Феномен: short_snake_case_english_phrase",
    "Ход: short_snake_case_english_phrase",
    "",
    "Требования к качеству:",
    "- Якорь должен быть виден прямо в данном тексте.",
    "- Наблюдение должно показывать механизм, а не просто красивую мысль.",
    "- Открытие должно звучать как: «Я не замечал, что...»",
    "- Не делай утверждений о греческом/еврейском, если они не даны в тексте.",
    "- Для бедных/формульных стихов лучше 0–1 сигнал, чем натянутые открытия.",
    "- Для narrative не выдумывай психологию персонажей сверх текста.",
    "- Для meaningful absence будь осторожен: отсутствие должно быть видимым внутри данного текста и не превращаться в догадку об авторском намерении.",
    "- Не сравнивай с персонажем/событием/исключением, которого нет в данном ниже тексте.",
    "",
    "Данные стиха:",
    `Reference: ${args.reference}`,
    args.genre ? `Genre: ${args.genre}` : "",
    "",
    "Текст стиха:",
    args.verseTextRu,
    "",
    "Контекст/отрывок:",
    args.passageTextRu,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildScopeDecision(args: {
  reference: string;
  canonicalRef: string;
  passageId: string;
}): Record<string, unknown> {
  return {
    mode: "text_only",
    experiment_id: "real_studio_10_runs_text_only_v1",
    reference: args.reference,
    canonical_ref: args.canonicalRef,
    passage_id: args.passageId,
    included_verses: [args.reference],
    detector_may_use: [
      "verse_text",
      "allowed_passage",
      "genre_scope_metadata",
    ],
    detector_may_not_use: [
      "Research Lake",
      "existing cards",
      "prior Claude outputs",
      "active/reserve cards for the same verse",
      "Source Packet",
      "original-language packet",
      "translation comparison packet",
    ],
    rationale:
      "10-run forcing function: test Russian-first text-only pipeline before returning to Source Packet / Original-Translation-Evidence architecture.",
  };
}

function buildInputContextSnapshot(args: {
  reference: string;
  canonicalRef: string;
  passageId: string;
  verseTextRu: string;
  passageTextRu: string;
  existingCards: ExistingCoverageCard[];
}): Record<string, unknown> {
  return {
    reference: args.reference,
    canonical_ref: args.canonicalRef,
    passage_id: args.passageId,

    verse_text_source: "ru-rstj.json via server getVerseText(local-first)",
    surface_lang: "ru",
    surface_translation: "rstj_yahweh",
    pipeline_language_mode: "russian_first_text_only_v1",

    passage_scope: "verse_only_v1",
    verse_text_ru: args.verseTextRu,
    passage_text_ru: args.passageTextRu,

    existing_cards_snapshot: {
      used_by_detector: false,
      used_by_judge: true,
      existing_cards_count: args.existingCards.length,
      cards: args.existingCards,
      note:
        "Detector did not see existing cards. Existing cards are only supplied to Same-Angle Judge.",
    },

    research_lake_snapshot: {
      available: null,
      used_by_detector: false,
      note: "Research Lake intentionally excluded for this 10-run test.",
    },

    source_packet_snapshot: {
      used_by_detector: false,
      note:
        "Source Packet / Original-Translation-Evidence architecture is parked until 10 real text-only runs are reviewed.",
    },
  };
}

export async function runRealVerseTextOnlyPreview(args: {
  reference: string;
  canonicalRef: string;
  passageId: string;
  verseTextRu: string;
  passageTextRu: string;
  existingCards: ExistingCoverageCard[];
  detectorProvider?: Provider;
  judgeProvider?: Provider;
  verifierProvider?: Provider;
  genre?: string | null;
}): Promise<RealVerseTextOnlyResult> {
  const detectorProvider = args.detectorProvider ?? "claude";
  const judgeProvider = args.judgeProvider ?? "openai";
  const verifierProvider = args.verifierProvider ?? "openai";

  const runId = createDeterministicId("run", {
    reference: args.reference,
    canonicalRef: args.canonicalRef,
    passageId: args.passageId,
    mode: "real_text_only",
    created_at: new Date().toISOString(),
  });

  const prompt = buildTextFirstDetectorPrompt({
    reference: args.reference,
    verseTextRu: args.verseTextRu,
    passageTextRu: args.passageTextRu,
    genre: args.genre,
  });

  const errors: string[] = [];
  let detectorRawText: string | null = null;

  try {
    detectorRawText = await runAI(detectorProvider, prompt, "ru", false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const detectorOutputStatus: DetectorOutputStatus = "detector_failed";

    return {
      ok: false,
      mode: "real_text_only",
      reference: args.reference,
      canonical_ref: args.canonicalRef,
      passage_id: args.passageId,

      lang: "ru",
      surface_lang: "ru",
      surface_translation: "rstj_yahweh",
      pipeline_language_mode: "russian_first_text_only_v1",
      experiment_id: "real_studio_10_runs_text_only_v1",

      detector_provider: detectorProvider,
      judge_provider: judgeProvider,
      verifier_provider: verifierProvider,

      detector_raw_text: null,
      detector_output_status: detectorOutputStatus,
      detector_declared_no_signals: false,
      detector_signal_count: 0,

      signal_flow: createSignalFlow({
        detectorOutputStatus,
        detectorDeclaredNoSignals: false,
        parsedSignalCount: 0,
        queue: [],
        noSignalsReason: `Detector failed: ${message}`,
      }),
      scope_decision: buildScopeDecision({
        reference: args.reference,
        canonicalRef: args.canonicalRef,
        passageId: args.passageId,
      }),
      input_context_snapshot: buildInputContextSnapshot({
        reference: args.reference,
        canonicalRef: args.canonicalRef,
        passageId: args.passageId,
        verseTextRu: args.verseTextRu,
        passageTextRu: args.passageTextRu,
        existingCards: args.existingCards,
      }),

      queue: [],
      diagnostics: [],
      action_counts: countActions([]),
      tier_counts: countTiers([]),
      errors: [`Detector failed: ${message}`],
      created_at: new Date().toISOString(),
    };
  }

  const signals = parseDetectorOutputToSignals({
    detectorRawText,
    runId,
    context: {
      reference: args.reference,
      canonicalRef: args.canonicalRef,
      passageId: args.passageId,
    },
  });

  const queue: ModeratorQueueItem[] = [];
  const diagnostics: RealVerseDiagnosticItem[] = [];

  for (const signal of signals) {
    try {
      const processed = await processSignal({
        signal,
        existingCards: args.existingCards,
        judgeProvider,
        verifierProvider,
        verseTextRu: args.verseTextRu,
        passageTextRu: args.passageTextRu,
      });

      queue.push(processed.queueItem);
      diagnostics.push(processed.diagnostic);
    } catch (error) {
      errors.push(
        `${signal.signal_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const declaredNoSignals = detectorDeclaredNoSignals(detectorRawText);

  if (signals.length === 0 && !declaredNoSignals) {
    errors.push(
      "Detector returned text, but no parseable signal blocks were found.",
    );
  }

  const detectorOutputStatus = getDetectorOutputStatus({
    detectorRawText,
    signalCount: signals.length,
  });

  return {
    ok: errors.length === 0,
    mode: "real_text_only",
    reference: args.reference,
    canonical_ref: args.canonicalRef,
    passage_id: args.passageId,

    lang: "ru",
    surface_lang: "ru",
    surface_translation: "rstj_yahweh",
    pipeline_language_mode: "russian_first_text_only_v1",
    experiment_id: "real_studio_10_runs_text_only_v1",

    detector_provider: detectorProvider,
    judge_provider: judgeProvider,
    verifier_provider: verifierProvider,

    detector_raw_text: detectorRawText,
    detector_output_status: detectorOutputStatus,
    detector_declared_no_signals: declaredNoSignals,
    detector_signal_count: signals.length,

    signal_flow: createSignalFlow({
      detectorOutputStatus,
      detectorDeclaredNoSignals: declaredNoSignals,
      parsedSignalCount: signals.length,
      queue,
      noSignalsReason: declaredNoSignals
        ? "Detector explicitly returned НЕТ_СИГНАЛОВ."
        : null,
    }),
    scope_decision: buildScopeDecision({
      reference: args.reference,
      canonicalRef: args.canonicalRef,
      passageId: args.passageId,
    }),
    input_context_snapshot: buildInputContextSnapshot({
      reference: args.reference,
      canonicalRef: args.canonicalRef,
      passageId: args.passageId,
      verseTextRu: args.verseTextRu,
      passageTextRu: args.passageTextRu,
      existingCards: args.existingCards,
    }),

    queue,
    diagnostics,
    action_counts: countActions(queue),
    tier_counts: countTiers(queue),
    errors,
    created_at: new Date().toISOString(),
  };
}
