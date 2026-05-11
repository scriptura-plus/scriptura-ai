import { runAI } from "@/lib/ai/runAI";
import type { Provider } from "@/lib/ai/providers";
import {
  classifySignal,
  type IntakeClassification,
  type IntakeStatus,
} from "../intake/classifySignal";
import {
  createAngleFingerprint,
  createDeterministicId,
} from "../fingerprint";
import type {
  AngleFingerprint,
  DiscoverySignal,
  ExistingCoverageCard,
  RiskFlag,
} from "../types";

type JsonRecord = Record<string, unknown>;

type DetectorOutputStatus =
  | "not_run"
  | "detector_failed"
  | "declared_no_signals"
  | "signals_parsed"
  | "unparseable_text";

type IntakeTier = "A_routine" | "B_conflict" | "C_risk_escalation";

type SignalFlow = {
  detector_output_status: DetectorOutputStatus;
  detector_declared_no_signals: boolean;
  parsed_signal_count: number;
  queue_item_count: number;

  keep_raw_count: number;
  keep_cautious_count: number;
  keep_needs_evidence_count: number;
  keep_possible_duplicate_count: number;
  keep_surface_hypothesis_count: number;
  discard_pretty_empty_count: number;
  discard_clear_fail_count: number;

  stored_signal_count: number;
  discarded_signal_count: number;

  no_signals_reason: string | null;
  notes: string[];
};

type ScopeDecision = {
  passage_id: string;
  included_verses: string[];
  authorized_scope: string;
  excluded_context: string;
  rationale: string;
  detector_may_use: string[];
  detector_may_not_use: string[];
};

type InputContextSnapshot = {
  reference: string;
  canonical_ref: string;
  passage_id: string;
  lang: "ru";
  surface_translation: "rstj_yahweh";
  pipeline_language_mode: "russian_first_mvp";
  experiment_id: "real_text_only_rule_based_intake_v0";
  genre: string | null;
  verse_text_ru: string;
  passage_text_ru: string;
  existing_cards_snapshot: {
    existing_cards_count: number;
    nearest_existing_cards: ExistingCoverageCard[];
    note: string;
  };
  research_lake_snapshot: {
    used_by_detector: false;
    available: null;
    source_count: null;
    source_types: [];
  };
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
  signal_index: number;
  reader_surprise_ru: string | null;
  core_observation: string;
  anchor_text: string | null;
  evidence_level: DiscoverySignal["evidence_level"];
  risk_flags: string[];
  intake_classification: IntakeClassification;
};

export type RealVerseIntakeQueueItem = {
  queue_item_id: string;
  decision_type: "signal_intake_classification";
  tier: IntakeTier;

  signal: DiscoverySignal & {
    intake_classification: IntakeClassification;
  };

  card_draft: null;

  context: {
    verse_with_anchor_highlighted: string;
    nearest_existing_cards: ExistingCoverageCard[];
    fingerprint_diff: null;
    existing_language_versions: null;
  };

  verdicts: {
    same_angle: {
      verdict: "not_run";
      judge_confidence: "not_applicable";
      overlap_explanation: string | null;
      compared_against: string[];
      differentiation_required: string | null;
    };
    verifier: {
      overall: "not_run";
      pretty_but_empty: boolean;
      rejection_reason: string | null;
      patch_instruction: string | null;
    };
    intake_classification: IntakeClassification;
  };

  suggested_action: IntakeStatus;
  suggested_action_confidence: "high" | "medium" | "low";

  available_actions: Array<
    | "keep_raw"
    | "keep_cautious"
    | "keep_needs_evidence"
    | "keep_possible_duplicate"
    | "keep_surface_hypothesis"
    | "discard_pretty_empty"
    | "discard_clear_fail"
    | "send_to_promotion_review"
  >;

  moderator_decision: null;
  moderator_reasoning: null;
  moderator_decision_time_seconds: null;

  created_at: string;
  priority: number;
};

export type RealVerseTextOnlyResult = {
  ok: boolean;
  mode: "real_text_only";

  reference: string;
  canonical_ref: string;
  passage_id: string;

  lang: "ru";
  surface_translation: "rstj_yahweh";
  pipeline_language_mode: "russian_first_mvp";
  experiment_id: "real_text_only_rule_based_intake_v0";

  detector_provider: Provider;
  judge_provider: "not_used_rule_based_intake_v0";
  verifier_provider: "not_used_rule_based_intake_v0";

  detector_raw_text: string | null;
  detector_output_status: DetectorOutputStatus;
  detector_declared_no_signals: boolean;
  detector_signal_count: number;
  queue_item_count: number;

  signal_flow: SignalFlow;
  scope_decision: ScopeDecision;
  input_context_snapshot: InputContextSnapshot;

  queue: RealVerseIntakeQueueItem[];
  diagnostics: RealVerseDiagnosticItem[];

  action_counts: Record<string, number>;
  tier_counts: Record<IntakeTier, number>;

  errors: string[];
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

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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
  const allowed = new Set([
    "lexical_overclaim",
    "intertext_speculative",
    "historical_overclaim",
    "theological_overreach",
    "meaningful_absence_unsafe",
    "self_generated_echo",
    "pretty_but_empty",

    // Forward-compatible evidence-demand flags. Existing RiskFlag may not list
    // all of these yet, so the final return is intentionally cast.
    "requires_lexical_evidence",
    "requires_historical_evidence",
    "requires_intertextual_evidence",
    "requires_theological_evidence",
    "requires_syntactic_evidence",
    "requires_original_check",
    "translation_surface_artifact_suspected",
    "russian_synodal_archaism_suspected",
  ]);

  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;|]+/)
      : [];

  const flags = new Set<string>();

  for (const item of rawItems) {
    const raw = typeof item === "string" ? item.trim() : "";
    const lower = raw.toLowerCase();

    if (
      !lower ||
      lower === "none" ||
      lower === "no" ||
      lower === "нет" ||
      lower === "без" ||
      lower === "-"
    ) {
      continue;
    }

    if (allowed.has(lower)) {
      flags.add(lower);
      continue;
    }

    if (lower.includes("pretty") || lower.includes("пуст")) {
      flags.add("pretty_but_empty");
    }

    if (lower.includes("lexical") || lower.includes("лекс")) {
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
      lower.includes("absence") ||
      lower.includes("meaningful_absence") ||
      lower.includes("отсутств")
    ) {
      flags.add("meaningful_absence_unsafe");
    }

    if (lower.includes("original") || lower.includes("оригинал")) {
      flags.add("requires_original_check");
    }

    if (lower.includes("translation") || lower.includes("перевод")) {
      flags.add("translation_surface_artifact_suspected");
    }

    if (lower.includes("archaic") || lower.includes("синод") || lower.includes("арха")) {
      flags.add("russian_synodal_archaism_suspected");
    }
  }

  return Array.from(flags) as RiskFlag[];
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

    const match = line.match(/^([^:：]{2,50})[:：]\s*(.*)$/);

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

    detector_id: "text_only_detector_rule_based_intake_v0",
    run_id: args.runId,
    created_at: new Date().toISOString(),

    metadata: {
      normalized_from_detector: true,
      detector_index: args.index,
      detector_format: "text_first",
      language_scope: "surface_only",
      cross_lingual_status: "not_assessed",
      surface_translation: "rstj_yahweh",
      fingerprint_strategy: "russian_surface_v1",
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

function getSignalAnchorText(signal: DiscoverySignal): string | null {
  const textualAnchor = getNestedRecord(signal as unknown as JsonRecord, "textual_anchor");
  const canonical = getNestedRecord(textualAnchor, "canonical");
  const surfaces = getNestedRecord(textualAnchor, "surfaces");
  const ru = getNestedRecord(surfaces, "ru");

  return (
    toString(canonical?.quote) ||
    toString(canonical?.text) ||
    toString(ru?.quote) ||
    null
  );
}

function getReaderSurpriseRu(signal: DiscoverySignal): string | null {
  const readerSurprise = getNestedRecord(
    signal as unknown as JsonRecord,
    "reader_surprise_sentence",
  );

  return (
    toString(readerSurprise?.ru) ||
    toString((signal as unknown as JsonRecord).reader_surprise_sentence) ||
    null
  );
}

function getRiskFlags(signal: DiscoverySignal): string[] {
  return Array.isArray(signal.risk_flags)
    ? signal.risk_flags.map((item) => String(item))
    : [];
}

function getDetectorOutputStatus(args: {
  detectorRawText: string | null;
  detectorFailed?: boolean;
  signalCount: number;
}): DetectorOutputStatus {
  if (args.detectorFailed) return "detector_failed";
  if (!args.detectorRawText) return "not_run";
  if (detectorDeclaredNoSignals(args.detectorRawText)) {
    return "declared_no_signals";
  }
  if (args.signalCount > 0) return "signals_parsed";
  return "unparseable_text";
}

function inferIncludedVersesFromPassageId(passageId: string): string[] {
  const match = passageId.match(/_(\d+)_(\d+)-(\d+)$/);
  if (!match) return [];

  const chapter = match[1];
  const start = Number(match[2]);
  const end = Number(match[3]);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return [];
  }

  const verses: string[] = [];

  for (let verse = start; verse <= end; verse += 1) {
    verses.push(`${chapter}:${verse}`);
  }

  return verses;
}

function createScopeDecision(passageId: string): ScopeDecision {
  return {
    passage_id: passageId,
    included_verses: inferIncludedVersesFromPassageId(passageId),
    authorized_scope:
      "Detector may use only the supplied Russian verse text and supplied passage text.",
    excluded_context:
      "Research Lake, existing cards, previous AI outputs, Source Packet, original-language packet, translation comparison packet, historical background, and cross-references are excluded from Detector input.",
    rationale:
      "Intake is intentionally cheap and generous. Text-only Detector extracts raw research signals; rule-based classifier labels status/risk; heavy reviewer is deferred to promotion/public decisions.",
    detector_may_use: ["verse_text_ru", "passage_text_ru", "genre_scope_metadata"],
    detector_may_not_use: [
      "Research Lake",
      "existing cards",
      "prior AI outputs",
      "Source Packet",
      "original-language packet",
      "translation comparison packet",
      "historical background",
      "cross-references outside supplied passage",
    ],
  };
}

function createInputContextSnapshot(args: {
  reference: string;
  canonicalRef: string;
  passageId: string;
  verseTextRu: string;
  passageTextRu: string;
  genre?: string | null;
  existingCards: ExistingCoverageCard[];
}): InputContextSnapshot {
  return {
    reference: args.reference,
    canonical_ref: args.canonicalRef,
    passage_id: args.passageId,
    lang: "ru",
    surface_translation: "rstj_yahweh",
    pipeline_language_mode: "russian_first_mvp",
    experiment_id: "real_text_only_rule_based_intake_v0",
    genre: args.genre ?? null,
    verse_text_ru: args.verseTextRu,
    passage_text_ru: args.passageTextRu,
    existing_cards_snapshot: {
      existing_cards_count: args.existingCards.length,
      nearest_existing_cards: args.existingCards.slice(0, 20),
      note:
        "Detector did not use existing cards. Existing cards were used only by deterministic duplicate guard in rule-based intake classifier.",
    },
    research_lake_snapshot: {
      used_by_detector: false,
      available: null,
      source_count: null,
      source_types: [],
    },
  };
}

function getTierFromClassification(
  classification: IntakeClassification,
): IntakeTier {
  if (
    classification.intake_status === "discard_pretty_empty" ||
    classification.intake_status === "discard_clear_fail" ||
    classification.intake_status === "keep_needs_evidence" ||
    classification.intake_status === "keep_surface_hypothesis" ||
    classification.reviewer_required === "full_before_public"
  ) {
    return "C_risk_escalation";
  }

  if (
    classification.intake_status === "keep_possible_duplicate" ||
    classification.possible_duplicate
  ) {
    return "B_conflict";
  }

  return "A_routine";
}

function getPriorityFromTier(tier: IntakeTier): number {
  if (tier === "C_risk_escalation") return 5;
  if (tier === "B_conflict") return 4;
  return 3;
}

function getSuggestedActionConfidence(
  classification: IntakeClassification,
): "high" | "medium" | "low" {
  if (
    classification.intake_status === "discard_pretty_empty" ||
    classification.duplicate_guard.duplicate_confidence === "exact"
  ) {
    return "high";
  }

  if (classification.intake_status === "keep_raw") return "high";
  if (classification.intake_status === "discard_clear_fail") return "medium";

  return "medium";
}

function getAvailableActions(
  classification: IntakeClassification,
): RealVerseIntakeQueueItem["available_actions"] {
  if (
    classification.intake_status === "discard_pretty_empty" ||
    classification.intake_status === "discard_clear_fail"
  ) {
    return [
      "discard_pretty_empty",
      "discard_clear_fail",
      "keep_cautious",
      "send_to_promotion_review",
    ];
  }

  if (classification.intake_status === "keep_possible_duplicate") {
    return [
      "keep_possible_duplicate",
      "keep_cautious",
      "keep_raw",
      "send_to_promotion_review",
    ];
  }

  if (
    classification.intake_status === "keep_needs_evidence" ||
    classification.intake_status === "keep_surface_hypothesis"
  ) {
    return [
      classification.intake_status,
      "keep_cautious",
      "send_to_promotion_review",
    ];
  }

  return [
    "keep_raw",
    "keep_cautious",
    "keep_needs_evidence",
    "keep_possible_duplicate",
    "keep_surface_hypothesis",
    "send_to_promotion_review",
  ];
}

function createQueueItem(args: {
  signal: DiscoverySignal;
  classification: IntakeClassification;
  verseTextRu: string;
  existingCards: ExistingCoverageCard[];
}): RealVerseIntakeQueueItem {
  const tier = getTierFromClassification(args.classification);
  const signalWithClassification = {
    ...args.signal,
    suggested_next_action: args.classification.intake_status,
    intake_classification: args.classification,
    metadata: {
      ...(isRecord((args.signal as unknown as JsonRecord).metadata)
        ? ((args.signal as unknown as JsonRecord).metadata as JsonRecord)
        : {}),
      intake_classification: args.classification,
    },
  } as DiscoverySignal & { intake_classification: IntakeClassification };

  return {
    queue_item_id: createDeterministicId("q", {
      signal_id: args.signal.signal_id,
      intake_status: args.classification.intake_status,
      duplicate_confidence:
        args.classification.duplicate_guard.duplicate_confidence,
    }),
    decision_type: "signal_intake_classification",
    tier,

    signal: signalWithClassification,

    card_draft: null,

    context: {
      verse_with_anchor_highlighted: args.verseTextRu,
      nearest_existing_cards: args.existingCards.slice(0, 5),
      fingerprint_diff: null,
      existing_language_versions: null,
    },

    verdicts: {
      same_angle: {
        verdict: "not_run",
        judge_confidence: "not_applicable",
        overlap_explanation:
          "Heavy Same-Angle Judge was not run at intake. Duplicate detection used rule-based duplicate guard only.",
        compared_against: args.classification.duplicate_guard.matched_card_ids,
        differentiation_required: args.classification.possible_duplicate
          ? "Review possible duplicate before crafting or promotion."
          : null,
      },
      verifier: {
        overall: "not_run",
        pretty_but_empty:
          args.classification.intake_status === "discard_pretty_empty",
        rejection_reason:
          args.classification.intake_status === "discard_clear_fail" ||
          args.classification.intake_status === "discard_pretty_empty"
            ? args.classification.reason
            : null,
        patch_instruction:
          args.classification.intake_status === "keep_cautious"
            ? "Use cautious wording if this signal becomes a candidate."
            : null,
      },
      intake_classification: args.classification,
    },

    suggested_action: args.classification.intake_status,
    suggested_action_confidence: getSuggestedActionConfidence(args.classification),

    available_actions: getAvailableActions(args.classification),

    moderator_decision: null,
    moderator_reasoning: null,
    moderator_decision_time_seconds: null,

    created_at: new Date().toISOString(),
    priority: getPriorityFromTier(tier),
  };
}

function countActions(queue: RealVerseIntakeQueueItem[]): Record<string, number> {
  const statuses: IntakeStatus[] = [
    "keep_raw",
    "keep_cautious",
    "keep_needs_evidence",
    "keep_possible_duplicate",
    "keep_surface_hypothesis",
    "discard_pretty_empty",
    "discard_clear_fail",
  ];

  const counts: Record<string, number> = {
    // Legacy counters kept for older UI/run-log summary code.
    approve_reserve: 0,
    approve_active: 0,
    rewrite: 0,
    replace_existing: 0,
    discard: queue.filter(
      (item) =>
        item.suggested_action === "discard_pretty_empty" ||
        item.suggested_action === "discard_clear_fail",
    ).length,
    send_back: 0,
    mark_for_external_research: 0,
  };

  for (const status of statuses) {
    counts[status] = queue.filter((item) => item.suggested_action === status)
      .length;
  }

  counts.keep_total = queue.filter((item) =>
    String(item.suggested_action).startsWith("keep_"),
  ).length;
  counts.discard_total = counts.discard_pretty_empty + counts.discard_clear_fail;

  return counts;
}

function countTiers(queue: RealVerseIntakeQueueItem[]): Record<IntakeTier, number> {
  return {
    A_routine: queue.filter((item) => item.tier === "A_routine").length,
    B_conflict: queue.filter((item) => item.tier === "B_conflict").length,
    C_risk_escalation: queue.filter((item) => item.tier === "C_risk_escalation")
      .length,
  };
}

function createSignalFlow(args: {
  detectorOutputStatus: DetectorOutputStatus;
  detectorDeclaredNoSignals: boolean;
  parsedSignalCount: number;
  queue: RealVerseIntakeQueueItem[];
  noSignalsReason?: string | null;
}): SignalFlow {
  const actionCounts = countActions(args.queue);

  return {
    detector_output_status: args.detectorOutputStatus,
    detector_declared_no_signals: args.detectorDeclaredNoSignals,
    parsed_signal_count: args.parsedSignalCount,
    queue_item_count: args.queue.length,

    keep_raw_count: actionCounts.keep_raw,
    keep_cautious_count: actionCounts.keep_cautious,
    keep_needs_evidence_count: actionCounts.keep_needs_evidence,
    keep_possible_duplicate_count: actionCounts.keep_possible_duplicate,
    keep_surface_hypothesis_count: actionCounts.keep_surface_hypothesis,
    discard_pretty_empty_count: actionCounts.discard_pretty_empty,
    discard_clear_fail_count: actionCounts.discard_clear_fail,

    stored_signal_count: actionCounts.keep_total,
    discarded_signal_count: actionCounts.discard_total,

    no_signals_reason: args.noSignalsReason ?? null,
    notes: [
      "Heavy Judge/Verifier are intentionally not called at intake.",
      "Risk flags are observers at intake and become gates only during promotion.",
      "Intake is cheap and generous; promotion is selective and strict.",
    ],
  };
}

function buildTextOnlyDetectorPrompt(args: {
  reference: string;
  verseTextRu: string;
  passageTextRu: string;
  genre?: string | null;
}): string {
  return [
    "Ты — text-only Detector для Scriptura AI Discovery Refinery.",
    "",
    "Твоя задача — найти 0–3 настоящих текстовых сигнала.",
    "Не пиши готовые карточки.",
    "Не пиши проповедь.",
    "Не объясняй стих в целом.",
    "",
    "АРХИТЕКТУРНЫЙ ПРИНЦИП:",
    "Intake дешёвый и щедрый, promotion выборочный и строгий.",
    "Ты не финальный рецензент. Ты добываешь сырьё и честно ставишь risk flags.",
    "",
    "ЖЁСТКАЯ ГРАНИЦА МАТЕРИАЛА:",
    "Используй только текст стиха и контекст/отрывок, которые даны ниже.",
    "Не используй Research Lake, существующие карточки, прошлые AI-выводы, Source Packet, оригинальные языки, сравнение переводов, исторический фон или перекрёстные ссылки, если они не даны явно ниже.",
    "Если мысль зависит от материала за пределами данного текста, не выдавай её как факт. Лучше поставь risk flag.",
    "Если сильных сигналов нет, верни ровно одну строку: НЕТ_СИГНАЛОВ",
    "",
    "ЧТО ИСКАТЬ:",
    "- союз, повтор, контраст, порядок слов, список, переход агентности;",
    "- вопрос-ответ, риторическую асимметрию, значимое отсутствие;",
    "- напряжение повествования, неожиданный порядок, сдвиг от образа к выводу;",
    "- surface-сигнал русского текста, если он действительно заметен.",
    "",
    "ЧЕГО НЕ ДЕЛАТЬ:",
    "- не делай утверждений о греческом/еврейском;",
    "- не превращай это в Word Lens / lexical lookup;",
    "- не называй surface-сигнал универсальным;",
    "- не выдумывай психологию персонажей сверх текста;",
    "- не пытайся найти вау там, где текст формульный или бедный.",
    "",
    "RISK FLAGS:",
    "Используй none или один/несколько через запятую:",
    "- pretty_but_empty — красиво, но нет механизма в тексте;",
    "- lexical_overclaim — мысль требует лексики/оригинала;",
    "- requires_lexical_evidence — нужна лексическая проверка;",
    "- requires_original_check — нужно проверить оригинальный язык;",
    "- translation_surface_artifact_suspected — возможно артефакт перевода;",
    "- russian_synodal_archaism_suspected — возможно эффект архаичного русского регистра;",
    "- intertext_speculative — нужна межтекстовая проверка;",
    "- historical_overclaim — нужен исторический источник;",
    "- theological_overreach — слишком богословски обобщено;",
    "- meaningful_absence_unsafe — отсутствие заметно, но опасно говорить о намерении автора;",
    "- self_generated_echo — похоже на повтор уже известной формулировки.",
    "",
    "Формат каждого сигнала:",
    "",
    "СИГНАЛ 1",
    "Якорь: короткая точная фраза из русского текста",
    "Слова: слово1, слово2",
    "Наблюдение: точное объяснение текстового механизма; не sermon",
    "Открытие: Я не замечал, что ...",
    "Доказательность: strong | plausible | weak",
    "Семья: rhetorical | structural | lexical | meaningful_absence | discourse_function | metaphor_image | contextual | translation | paradox_tension | other",
    "Риск: none | pretty_but_empty | lexical_overclaim | requires_lexical_evidence | requires_original_check | translation_surface_artifact_suspected | russian_synodal_archaism_suspected | intertext_speculative | historical_overclaim | theological_overreach | meaningful_absence_unsafe | self_generated_echo",
    "Феномен: short_snake_case_english_phrase",
    "Ход: short_snake_case_english_phrase",
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

export async function runRealVerseTextOnlyPreview(args: {
  reference: string;
  canonicalRef: string;
  passageId: string;
  verseTextRu: string;
  passageTextRu: string;
  existingCards: ExistingCoverageCard[];
  detectorProvider: Provider;
  judgeProvider?: Provider;
  verifierProvider?: Provider;
  genre?: string | null;
}): Promise<RealVerseTextOnlyResult> {
  const runId = createDeterministicId("run", {
    reference: args.reference,
    canonicalRef: args.canonicalRef,
    mode: "real_text_only_rule_based_intake_v0",
    created_at: new Date().toISOString(),
  });

  const scopeDecision = createScopeDecision(args.passageId);
  const inputContextSnapshot = createInputContextSnapshot({
    reference: args.reference,
    canonicalRef: args.canonicalRef,
    passageId: args.passageId,
    verseTextRu: args.verseTextRu,
    passageTextRu: args.passageTextRu,
    genre: args.genre,
    existingCards: args.existingCards,
  });

  const prompt = buildTextOnlyDetectorPrompt({
    reference: args.reference,
    verseTextRu: args.verseTextRu,
    passageTextRu: args.passageTextRu,
    genre: args.genre,
  });

  let detectorRawText: string | null = null;

  try {
    detectorRawText = await runAI(args.detectorProvider, prompt, "ru", false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const signalFlow = createSignalFlow({
      detectorOutputStatus: "detector_failed",
      detectorDeclaredNoSignals: false,
      parsedSignalCount: 0,
      queue: [],
      noSignalsReason: `Detector failed: ${message}`,
    });

    return {
      ok: false,
      mode: "real_text_only",

      reference: args.reference,
      canonical_ref: args.canonicalRef,
      passage_id: args.passageId,

      lang: "ru",
      surface_translation: "rstj_yahweh",
      pipeline_language_mode: "russian_first_mvp",
      experiment_id: "real_text_only_rule_based_intake_v0",

      detector_provider: args.detectorProvider,
      judge_provider: "not_used_rule_based_intake_v0",
      verifier_provider: "not_used_rule_based_intake_v0",

      detector_raw_text: null,
      detector_output_status: "detector_failed",
      detector_declared_no_signals: false,
      detector_signal_count: 0,
      queue_item_count: 0,

      signal_flow: signalFlow,
      scope_decision: scopeDecision,
      input_context_snapshot: inputContextSnapshot,

      queue: [],
      diagnostics: [],

      action_counts: countActions([]),
      tier_counts: countTiers([]),

      errors: [`Detector failed: ${message}`],
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

  const declaredNoSignals = detectorDeclaredNoSignals(detectorRawText);
  const errors: string[] = [];

  if (signals.length === 0 && !declaredNoSignals) {
    errors.push(
      "Detector returned text, but no parseable signal blocks were found.",
    );
  }

  const queue: RealVerseIntakeQueueItem[] = [];
  const diagnostics: RealVerseDiagnosticItem[] = [];

  for (let index = 0; index < signals.length; index += 1) {
    const signal = signals[index];

    const classification = classifySignal({
      signal,
      existingCards: args.existingCards,
      existingSignals: signals.slice(0, index),
    });

    const queueItem = createQueueItem({
      signal,
      classification,
      verseTextRu: args.verseTextRu,
      existingCards: args.existingCards,
    });

    queue.push(queueItem);

    diagnostics.push({
      signal_id: signal.signal_id,
      signal_index: index,
      reader_surprise_ru: getReaderSurpriseRu(signal),
      core_observation: signal.core_observation,
      anchor_text: getSignalAnchorText(signal),
      evidence_level: signal.evidence_level,
      risk_flags: getRiskFlags(signal),
      intake_classification: classification,
    });
  }

  const detectorOutputStatus = getDetectorOutputStatus({
    detectorRawText,
    signalCount: signals.length,
  });

  const signalFlow = createSignalFlow({
    detectorOutputStatus,
    detectorDeclaredNoSignals: declaredNoSignals,
    parsedSignalCount: signals.length,
    queue,
    noSignalsReason: declaredNoSignals
      ? "Detector explicitly returned НЕТ_СИГНАЛОВ."
      : null,
  });

  return {
    ok: errors.length === 0,
    mode: "real_text_only",

    reference: args.reference,
    canonical_ref: args.canonicalRef,
    passage_id: args.passageId,

    lang: "ru",
    surface_translation: "rstj_yahweh",
    pipeline_language_mode: "russian_first_mvp",
    experiment_id: "real_text_only_rule_based_intake_v0",

    detector_provider: args.detectorProvider,
    judge_provider: "not_used_rule_based_intake_v0",
    verifier_provider: "not_used_rule_based_intake_v0",

    detector_raw_text: detectorRawText,
    detector_output_status: detectorOutputStatus,
    detector_declared_no_signals: declaredNoSignals,
    detector_signal_count: signals.length,
    queue_item_count: queue.length,

    signal_flow: signalFlow,
    scope_decision: scopeDecision,
    input_context_snapshot: inputContextSnapshot,

    queue,
    diagnostics,

    action_counts: countActions(queue),
    tier_counts: countTiers(queue),

    errors,
  };
}
