import { runAI } from "@/lib/ai/runAI";
import type { Provider } from "@/lib/ai/providers";
import {
  createAngleFingerprint,
  createDeterministicId,
} from "../fingerprint";
import {
  buildArgumentStructureDetectorPrompt,
  buildSameAngleJudgePrompt,
  buildVerifierPrompt,
} from "../prompts";
import type {
  AngleFingerprint,
  DiscoverySignal,
  ExistingCoverageCard,
  ModeratorQueueItem,
  RiskFlag,
  SameAngleVerdict,
  VerifierVerdict,
} from "../types";
import {
  DAY1_PASSAGE_TEXT_RU,
  DAY1_REFERENCE,
  DAY1_VERSE_TEXT_RU,
  getMatthew1129Day1Snapshot,
  getMatthew1129ExistingCardsForJudge,
} from "./matthew1129Snapshot";
import {
  DAY1_CALIBRATION_CASES,
  type Day1CalibrationCase,
} from "./calibrationCases";
import {
  DAY15_VERSE_FIXTURES,
  type Day15VerseFixture,
} from "./day15VerseCorpus";

type JsonRecord = Record<string, unknown>;

type RunMode = "calibration" | "detector_preview" | "day15_fixture_preview";

export type Day1DiagnosticItem = {
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

export type Day1PipelineResult = {
  ok: boolean;
  mode: RunMode;
  reference: string;
  detector_provider: Provider;
  judge_provider: Provider;
  verifier_provider: Provider;
  detector_raw_text: string | null;
  detector_signal_count: number;
  queue: ModeratorQueueItem[];
  diagnostics: Day1DiagnosticItem[];
  calibration?: Day1CalibrationResult[];
  errors: string[];
};

export type Day1CalibrationResult = {
  case_id: string;
  label: string;
  expected: Day1CalibrationCase["expected"];
  actual: {
    hash_match_before_judge: boolean;
    same_angle_verdict: SameAngleVerdict["verdict"] | null;
    verifier_overall: VerifierVerdict["overall"] | null;
    verifier_pretty_but_empty: boolean | null;
    verifier_risk_flags: Partial<VerifierVerdict["risk_assessment"]>;
  };
  passed: boolean;
  queue_item: ModeratorQueueItem | null;
  error: string | null;
};

export type Day15VersePreviewResult = Day1PipelineResult & {
  fixture_id: string;
  canonical_ref: string;
  passage_id: string;
  genre: Day15VerseFixture["genre"];
  expected_richness: Day15VerseFixture["expected_richness"];
  existing_coverage_mode: Day15VerseFixture["existing_coverage_mode"];
  diagnostic_reason: string;
  expected_behavior_note: string;
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
};

export type Day15MultiVersePreviewResult = {
  ok: boolean;
  mode: "day15_multi_verse_preview";
  created_at: string;
  detector_provider: Provider;
  judge_provider: Provider;
  verifier_provider: Provider;
  verse_count: number;
  total_detector_signal_count: number;
  total_queue_items: number;
  total_errors: number;
  aggregate: {
    approve_reserve: number;
    approve_active: number;
    rewrite: number;
    replace_existing: number;
    discard: number;
    send_back: number;
    mark_for_external_research: number;
    A_routine: number;
    B_conflict: number;
    C_risk_escalation: number;
  };
  verses: Day15VersePreviewResult[];
  errors: string[];
  meta: {
    purpose: string;
    boundary: string;
    next: string;
  };
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

  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is RiskFlag => allowed.has(item as RiskFlag));
}

function normalizeEvidenceLevel(
  value: unknown,
): DiscoverySignal["evidence_level"] {
  if (value === "strong" || value === "plausible" || value === "weak") {
    return value;
  }

  if (value === "moderate" || value === "medium") {
    return "plausible";
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
    allowed.has(value as AngleFingerprint["angle_family"])
  ) {
    return value as AngleFingerprint["angle_family"];
  }

  return "other";
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
          translation_source:
            toString(surfaceRu?.translation_source) ||
            "RSTJ 1876 / Synodal Yahweh Edition",
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
      has_self_generated_context: true,
    },

    evidence_level: normalizeEvidenceLevel(value.evidence_level),
    risk_flags: normalizeRiskFlags(value.risk_flags),

    relation_to_existing: null,
    verifier_verdict: null,
    suggested_next_action: null,

    detector_id: "argument_structure_mapping_v1",
    run_id: runId,
    created_at: new Date().toISOString(),

    metadata: {
      normalized_from_detector: true,
      detector_index: index,
    },
  };
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

  if (
    args.sameAngleVerdict.verdict === "same_angle" ||
    args.sameAngleVerdict.verdict === "risky_overclaim"
  ) {
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

async function processSignal(args: {
  signal: DiscoverySignal;
  existingCards: ExistingCoverageCard[];
  judgeProvider: Provider;
  verifierProvider: Provider;
  verseTextRu: string;
}): Promise<{
  queueItem: ModeratorQueueItem;
  diagnostic: Day1DiagnosticItem;
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
    const verifierPrompt = buildVerifierPrompt({
      signal: args.signal,
      sameAngleVerdict,
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

  const diagnostic: Day1DiagnosticItem = {
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

function actualMatchesExpected(args: {
  expected: Day1CalibrationResult["expected"];
  actual: Day1CalibrationResult["actual"];
}): boolean {
  const { expected, actual } = args;

  if (actual.hash_match_before_judge !== expected.hash_match_before_judge) {
    return false;
  }

  if (actual.same_angle_verdict !== expected.same_angle_verdict) {
    return false;
  }

  if (actual.verifier_overall !== expected.verifier_overall) {
    return false;
  }

  if (actual.verifier_pretty_but_empty !== expected.verifier_pretty_but_empty) {
    return false;
  }

  for (const [key, value] of Object.entries(expected.verifier_risk_flags)) {
    const actualValue =
      actual.verifier_risk_flags[
        key as keyof VerifierVerdict["risk_assessment"]
      ];

    if (actualValue !== value) return false;
  }

  return true;
}

function hasNoVerifierRisks(actual: Day1CalibrationResult["actual"]): boolean {
  return !Object.values(actual.verifier_risk_flags).some(Boolean);
}

function isAllowedFlexibleCalibrationVariant(
  result: Day1CalibrationResult,
): boolean {
  const actual = result.actual;

  if (result.case_id.startsWith("case_02_")) {
    if (actual.hash_match_before_judge !== false) return false;
    if (actual.verifier_pretty_but_empty !== false) return false;
    if (!hasNoVerifierRisks(actual)) return false;

    const isCleanNewAngle =
      actual.same_angle_verdict === "new_angle" &&
      actual.verifier_overall === "pass";

    const isConservativeOverlap =
      actual.same_angle_verdict === "partial_overlap" &&
      (actual.verifier_overall === "pass" ||
        actual.verifier_overall === "needs_patch");

    return isCleanNewAngle || isConservativeOverlap;
  }

  if (result.case_id.startsWith("case_03_")) {
    if (actual.hash_match_before_judge !== false) return false;
    if (actual.verifier_pretty_but_empty !== false) return false;
    if (!hasNoVerifierRisks(actual)) return false;

    const isStrongerVersion =
      actual.same_angle_verdict === "stronger_version" &&
      (actual.verifier_overall === "pass" ||
        actual.verifier_overall === "needs_patch");

    const isConservativeOverlap =
      actual.same_angle_verdict === "partial_overlap" &&
      (actual.verifier_overall === "pass" ||
        actual.verifier_overall === "needs_patch");

    return isStrongerVersion || isConservativeOverlap;
  }

  return false;
}

function compareCalibrationResult(result: Day1CalibrationResult): boolean {
  return (
    actualMatchesExpected({
      expected: result.expected,
      actual: result.actual,
    }) || isAllowedFlexibleCalibrationVariant(result)
  );
}

export async function runDay1Calibration(args?: {
  judgeProvider?: Provider;
  verifierProvider?: Provider;
}): Promise<Day1PipelineResult> {
  const judgeProvider = args?.judgeProvider ?? "openai";
  const verifierProvider = args?.verifierProvider ?? "openai";
  const existingCards = getMatthew1129ExistingCardsForJudge();

  const calibration: Day1CalibrationResult[] = [];
  const diagnostics: Day1DiagnosticItem[] = [];
  const errors: string[] = [];

  for (const item of DAY1_CALIBRATION_CASES) {
    try {
      const processed = await processSignal({
        signal: item.signal,
        existingCards,
        judgeProvider,
        verifierProvider,
        verseTextRu: DAY1_VERSE_TEXT_RU,
      });

      diagnostics.push(processed.diagnostic);

      const queueItem = processed.queueItem;

      const actual = {
        hash_match_before_judge:
          queueItem.verdicts.same_angle.overlap_explanation?.includes(
            "Deterministic fingerprint hash matched",
          ) ?? false,
        same_angle_verdict: queueItem.verdicts.same_angle.verdict,
        verifier_overall: queueItem.verdicts.verifier.overall,
        verifier_pretty_but_empty: queueItem.verdicts.verifier.pretty_but_empty,
        verifier_risk_flags: queueItem.verdicts.verifier.risk_assessment,
      };

      const result: Day1CalibrationResult = {
        case_id: item.case_id,
        label: item.label,
        expected: item.expected,
        actual,
        passed: false,
        queue_item: queueItem,
        error: null,
      };

      result.passed = compareCalibrationResult(result);
      calibration.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      errors.push(`${item.case_id}: ${message}`);

      calibration.push({
        case_id: item.case_id,
        label: item.label,
        expected: item.expected,
        actual: {
          hash_match_before_judge: false,
          same_angle_verdict: null,
          verifier_overall: null,
          verifier_pretty_but_empty: null,
          verifier_risk_flags: {},
        },
        passed: false,
        queue_item: null,
        error: message,
      });
    }
  }

  return {
    ok: calibration.every((item) => item.passed) && errors.length === 0,
    mode: "calibration",
    reference: DAY1_REFERENCE,
    detector_provider: "claude",
    judge_provider: judgeProvider,
    verifier_provider: verifierProvider,
    detector_raw_text: null,
    detector_signal_count: 0,
    queue: calibration
      .map((item) => item.queue_item)
      .filter((item): item is ModeratorQueueItem => item !== null),
    diagnostics,
    calibration,
    errors,
  };
}

export async function runDay1DetectorPreview(args?: {
  detectorProvider?: Provider;
  judgeProvider?: Provider;
  verifierProvider?: Provider;
}): Promise<Day1PipelineResult> {
  const detectorProvider = args?.detectorProvider ?? "claude";
  const judgeProvider = args?.judgeProvider ?? "openai";
  const verifierProvider = args?.verifierProvider ?? "openai";

  const snapshot = getMatthew1129Day1Snapshot();
  const existingCards = getMatthew1129ExistingCardsForJudge();

  const prompt = buildArgumentStructureDetectorPrompt({
    reference: DAY1_REFERENCE,
    verseTextRu: DAY1_VERSE_TEXT_RU,
    passageTextRu: DAY1_PASSAGE_TEXT_RU,
    snapshot,
  });

  const runId = createDeterministicId("run", {
    reference: DAY1_REFERENCE,
    mode: "detector_preview",
    created_at: new Date().toISOString(),
  });

  const errors: string[] = [];
  let detectorRawText: string | null = null;

  try {
    detectorRawText = await runAI(detectorProvider, prompt, "ru", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      mode: "detector_preview",
      reference: DAY1_REFERENCE,
      detector_provider: detectorProvider,
      judge_provider: judgeProvider,
      verifier_provider: verifierProvider,
      detector_raw_text: null,
      detector_signal_count: 0,
      queue: [],
      diagnostics: [],
      errors: [`Detector failed: ${message}`],
    };
  }

  const parsedArray = parseJsonArray(detectorRawText);

  if (!parsedArray) {
    return {
      ok: false,
      mode: "detector_preview",
      reference: DAY1_REFERENCE,
      detector_provider: detectorProvider,
      judge_provider: judgeProvider,
      verifier_provider: verifierProvider,
      detector_raw_text: detectorRawText,
      detector_signal_count: 0,
      queue: [],
      diagnostics: [],
      errors: ["Detector did not return a valid JSON array."],
    };
  }

  const signals = parsedArray
    .map((item, index) =>
      normalizeDetectorSignal(item, index, runId, {
        reference: DAY1_REFERENCE,
        canonicalRef: DAY1_REFERENCE,
        passageId: "matt_11_28-30",
      }),
    )
    .filter((item): item is DiscoverySignal => item !== null);

  const queue: ModeratorQueueItem[] = [];
  const diagnostics: Day1DiagnosticItem[] = [];

  for (const signal of signals) {
    try {
      const processed = await processSignal({
        signal,
        existingCards,
        judgeProvider,
        verifierProvider,
        verseTextRu: DAY1_VERSE_TEXT_RU,
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

  return {
    ok: errors.length === 0,
    mode: "detector_preview",
    reference: DAY1_REFERENCE,
    detector_provider: detectorProvider,
    judge_provider: judgeProvider,
    verifier_provider: verifierProvider,
    detector_raw_text: detectorRawText,
    detector_signal_count: signals.length,
    queue,
    diagnostics,
    errors,
  };
}

function buildDay15DetectorPrompt(fixture: Day15VerseFixture): string {
  return [
    "You are the Scriptura AI Discovery Refinery detector.",
    "",
    "Task:",
    "Find discovery signals in this Bible verse/passage.",
    "Do not write devotional commentary.",
    "Do not create finished cards.",
    "Do not force discoveries if the verse is low-richness.",
    "",
    "Output language:",
    "The reader_surprise_sentence.ru field must be in Russian.",
    "All JSON key names must remain English.",
    "",
    "Detector focus:",
    "Use argument_structure_mapping_v1.",
    "Look for textual mechanisms such as:",
    "- causal connectors",
    "- command/result structure",
    "- contrast",
    "- repetition",
    "- sequence",
    "- agency shifts",
    "- rhetorical asymmetry",
    "- meaningful absence",
    "- list logic",
    "- narrative tension",
    "",
    "Safety:",
    "Do not make unsupported Greek/Hebrew claims.",
    "Do not claim something is in the original language unless the supplied text proves it.",
    "If a signal is weak or mostly inspirational, either omit it or mark evidence_level as weak.",
    "For low-richness genealogy/formulaic verses, 0 or 1 signal is acceptable.",
    "",
    "Return ONLY a valid JSON array.",
    "No markdown.",
    "No code fences.",
    "",
    "Each array item must have this exact shape:",
    JSON.stringify(
      [
        {
          signal_id: "temporary_detector_id_ok",
          reference: fixture.reference,
          canonical_ref: fixture.canonical_ref,
          passage_id: fixture.passage_id,
          primary_lang: "ru",
          textual_anchor: {
            canonical: {
              lang: "ru",
              quote: "short exact phrase from the supplied Russian verse",
              specific_words: ["word1", "word2"],
              canonical_pending: true,
            },
            surfaces: {
              ru: {
                quote: "same or surface phrase",
                specific_words: ["word1", "word2"],
                translation_source: "RSTJ 1876 / Synodal Yahweh Edition",
              },
              en: null,
              es: null,
            },
          },
          core_observation:
            "One precise explanation of the textual mechanism. Not a sermon.",
          reader_surprise_sentence: {
            ru: "Я не замечал, что ...",
            en: null,
            es: null,
          },
          angle_fingerprint: {
            anchor_canonical: {
              lang: "ru",
              text: "normalized anchor phrase",
              canonical_pending: true,
            },
            phenomenon: "short_snake_case_textual_phenomenon",
            phenomenon_status: "proposed_new",
            interpretive_move: "short_snake_case_interpretive_move",
            interpretive_move_status: "proposed_new",
            angle_family: "rhetorical",
            hash: "leave_empty_for_code_to_compute",
          },
          source_basis: {
            primary: "verse_text_only",
            has_self_generated_context: true,
          },
          evidence_level: "strong",
          risk_flags: [],
          relation_to_existing: null,
          verifier_verdict: null,
          suggested_next_action: null,
          detector_id: "argument_structure_mapping_v1",
          run_id: "leave_empty_for_code_to_fill",
          created_at: "leave_empty_for_code_to_fill",
        },
      ],
      null,
      2,
    ),
    "",
    "Allowed evidence_level values:",
    "- strong",
    "- plausible",
    "- weak",
    "",
    "Allowed angle_family values:",
    "- lexical",
    "- rhetorical",
    "- structural",
    "- translation",
    "- intertextual",
    "- historical",
    "- paradox_tension",
    "- meaningful_absence",
    "- contextual",
    "- discourse_function",
    "- metaphor_image",
    "- other",
    "",
    "VERSE FIXTURE:",
    JSON.stringify(
      {
        id: fixture.id,
        reference: fixture.reference,
        canonical_ref: fixture.canonical_ref,
        passage_id: fixture.passage_id,
        genre: fixture.genre,
        expected_richness: fixture.expected_richness,
        diagnostic_reason: fixture.diagnostic_reason,
        expected_behavior_note: fixture.expected_behavior_note,
        verse_text_ru: fixture.verse_text_ru,
        passage_text_ru: fixture.passage_text_ru,
      },
      null,
      2,
    ),
  ].join("\n");
}

function getExistingCardsForFixture(
  fixture: Day15VerseFixture,
): ExistingCoverageCard[] {
  if (fixture.existing_coverage_mode === "fixture_existing_cards") {
    return getMatthew1129ExistingCardsForJudge();
  }

  return [];
}

function countActions(
  queue: ModeratorQueueItem[],
): Day15VersePreviewResult["action_counts"] {
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
): Day15VersePreviewResult["tier_counts"] {
  return {
    A_routine: queue.filter((item) => item.tier === "A_routine").length,
    B_conflict: queue.filter((item) => item.tier === "B_conflict").length,
    C_risk_escalation: queue.filter((item) => item.tier === "C_risk_escalation")
      .length,
  };
}

async function runDay15VersePreview(args: {
  fixture: Day15VerseFixture;
  detectorProvider: Provider;
  judgeProvider: Provider;
  verifierProvider: Provider;
}): Promise<Day15VersePreviewResult> {
  const prompt = buildDay15DetectorPrompt(args.fixture);
  const existingCards = getExistingCardsForFixture(args.fixture);

  const runId = createDeterministicId("run", {
    reference: args.fixture.reference,
    mode: "day15_fixture_preview",
    created_at: new Date().toISOString(),
  });

  const errors: string[] = [];
  let detectorRawText: string | null = null;

  try {
    detectorRawText = await runAI(args.detectorProvider, prompt, "ru", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      mode: "day15_fixture_preview",
      fixture_id: args.fixture.id,
      reference: args.fixture.reference,
      canonical_ref: args.fixture.canonical_ref,
      passage_id: args.fixture.passage_id,
      genre: args.fixture.genre,
      expected_richness: args.fixture.expected_richness,
      existing_coverage_mode: args.fixture.existing_coverage_mode,
      diagnostic_reason: args.fixture.diagnostic_reason,
      expected_behavior_note: args.fixture.expected_behavior_note,
      detector_provider: args.detectorProvider,
      judge_provider: args.judgeProvider,
      verifier_provider: args.verifierProvider,
      detector_raw_text: null,
      detector_signal_count: 0,
      queue: [],
      diagnostics: [],
      errors: [`Detector failed: ${message}`],
      action_counts: countActions([]),
      tier_counts: countTiers([]),
    };
  }

  const parsedArray = parseJsonArray(detectorRawText);

  if (!parsedArray) {
    return {
      ok: false,
      mode: "day15_fixture_preview",
      fixture_id: args.fixture.id,
      reference: args.fixture.reference,
      canonical_ref: args.fixture.canonical_ref,
      passage_id: args.fixture.passage_id,
      genre: args.fixture.genre,
      expected_richness: args.fixture.expected_richness,
      existing_coverage_mode: args.fixture.existing_coverage_mode,
      diagnostic_reason: args.fixture.diagnostic_reason,
      expected_behavior_note: args.fixture.expected_behavior_note,
      detector_provider: args.detectorProvider,
      judge_provider: args.judgeProvider,
      verifier_provider: args.verifierProvider,
      detector_raw_text: detectorRawText,
      detector_signal_count: 0,
      queue: [],
      diagnostics: [],
      errors: ["Detector did not return a valid JSON array."],
      action_counts: countActions([]),
      tier_counts: countTiers([]),
    };
  }

  const signals = parsedArray
    .map((item, index) =>
      normalizeDetectorSignal(item, index, runId, {
        reference: args.fixture.reference,
        canonicalRef: args.fixture.canonical_ref,
        passageId: args.fixture.passage_id,
      }),
    )
    .filter((item): item is DiscoverySignal => item !== null);

  const queue: ModeratorQueueItem[] = [];
  const diagnostics: Day1DiagnosticItem[] = [];

  for (const signal of signals) {
    try {
      const processed = await processSignal({
        signal,
        existingCards,
        judgeProvider: args.judgeProvider,
        verifierProvider: args.verifierProvider,
        verseTextRu: args.fixture.verse_text_ru,
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

  return {
    ok: errors.length === 0,
    mode: "day15_fixture_preview",
    fixture_id: args.fixture.id,
    reference: args.fixture.reference,
    canonical_ref: args.fixture.canonical_ref,
    passage_id: args.fixture.passage_id,
    genre: args.fixture.genre,
    expected_richness: args.fixture.expected_richness,
    existing_coverage_mode: args.fixture.existing_coverage_mode,
    diagnostic_reason: args.fixture.diagnostic_reason,
    expected_behavior_note: args.fixture.expected_behavior_note,
    detector_provider: args.detectorProvider,
    judge_provider: args.judgeProvider,
    verifier_provider: args.verifierProvider,
    detector_raw_text: detectorRawText,
    detector_signal_count: signals.length,
    queue,
    diagnostics,
    errors,
    action_counts: countActions(queue),
    tier_counts: countTiers(queue),
  };
}

export function getDay15FixtureIds(): string[] {
  return DAY15_VERSE_FIXTURES.map((fixture) => fixture.id);
}

export async function runDay15FixturePreview(args?: {
  fixtureId?: string;
  detectorProvider?: Provider;
  judgeProvider?: Provider;
  verifierProvider?: Provider;
}): Promise<Day15VersePreviewResult> {
  const detectorProvider = args?.detectorProvider ?? "claude";
  const judgeProvider = args?.judgeProvider ?? "openai";
  const verifierProvider = args?.verifierProvider ?? "openai";

  const fallbackFixture = DAY15_VERSE_FIXTURES[0];

  if (!fallbackFixture) {
    throw new Error("No Day-1.5 verse fixtures are configured.");
  }

  const fixtureId = args?.fixtureId ?? fallbackFixture.id;

  const fixture = DAY15_VERSE_FIXTURES.find((item) => item.id === fixtureId);

  if (!fixture) {
    throw new Error(
      `Unknown Day-1.5 fixtureId "${fixtureId}". Available fixture IDs: ${getDay15FixtureIds().join(
        ", ",
      )}`,
    );
  }

  return runDay15VersePreview({
    fixture,
    detectorProvider,
    judgeProvider,
    verifierProvider,
  });
}

export async function runDay15MultiVersePreview(args?: {
  detectorProvider?: Provider;
  judgeProvider?: Provider;
  verifierProvider?: Provider;
}): Promise<Day15MultiVersePreviewResult> {
  const detectorProvider = args?.detectorProvider ?? "claude";
  const judgeProvider = args?.judgeProvider ?? "openai";
  const verifierProvider = args?.verifierProvider ?? "openai";

  const verses: Day15VersePreviewResult[] = [];
  const errors: string[] = [];

  for (const fixture of DAY15_VERSE_FIXTURES) {
    const result = await runDay15VersePreview({
      fixture,
      detectorProvider,
      judgeProvider,
      verifierProvider,
    });

    verses.push(result);

    if (!result.ok) {
      errors.push(
        `${fixture.reference}: ${result.errors.join("; ") || "unknown error"}`,
      );
    }
  }

  const aggregate = {
    approve_reserve: verses.reduce(
      (sum, verse) => sum + verse.action_counts.approve_reserve,
      0,
    ),
    approve_active: verses.reduce(
      (sum, verse) => sum + verse.action_counts.approve_active,
      0,
    ),
    rewrite: verses.reduce(
      (sum, verse) => sum + verse.action_counts.rewrite,
      0,
    ),
    replace_existing: verses.reduce(
      (sum, verse) => sum + verse.action_counts.replace_existing,
      0,
    ),
    discard: verses.reduce(
      (sum, verse) => sum + verse.action_counts.discard,
      0,
    ),
    send_back: verses.reduce(
      (sum, verse) => sum + verse.action_counts.send_back,
      0,
    ),
    mark_for_external_research: verses.reduce(
      (sum, verse) => sum + verse.action_counts.mark_for_external_research,
      0,
    ),
    A_routine: verses.reduce(
      (sum, verse) => sum + verse.tier_counts.A_routine,
      0,
    ),
    B_conflict: verses.reduce(
      (sum, verse) => sum + verse.tier_counts.B_conflict,
      0,
    ),
    C_risk_escalation: verses.reduce(
      (sum, verse) => sum + verse.tier_counts.C_risk_escalation,
      0,
    ),
  };

  return {
    ok: errors.length === 0,
    mode: "day15_multi_verse_preview",
    created_at: new Date().toISOString(),
    detector_provider: detectorProvider,
    judge_provider: judgeProvider,
    verifier_provider: verifierProvider,
    verse_count: verses.length,
    total_detector_signal_count: verses.reduce(
      (sum, verse) => sum + verse.detector_signal_count,
      0,
    ),
    total_queue_items: verses.reduce((sum, verse) => sum + verse.queue.length, 0),
    total_errors: errors.length,
    aggregate,
    verses,
    errors,
    meta: {
      purpose:
        "Day-1.5 multi-verse preview characterizes Discovery Refinery behavior across mixed genres before Supabase persistence.",
      boundary:
        "No Supabase writes, no Studio moderation, no Card Crafter. Diagnostic JSON only.",
      next:
        "Review aggregate distribution and per-verse diagnostics before deciding whether to tune prompts or design persistence.",
    },
  };
}
