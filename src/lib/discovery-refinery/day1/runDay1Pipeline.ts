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

type JsonRecord = Record<string, unknown>;

type RunMode = "calibration" | "detector_preview";

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
    // continue
  }

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    } catch {
      // continue
    }
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    } catch {
      // continue
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

function getNestedRecord(record: JsonRecord, key: string): JsonRecord | null {
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

function normalizeEvidenceLevel(value: unknown): DiscoverySignal["evidence_level"] {
  if (value === "strong" || value === "plausible" || value === "weak") {
    return value;
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

  if (typeof value === "string" && allowed.has(value as AngleFingerprint["angle_family"])) {
    return value as AngleFingerprint["angle_family"];
  }

  return "other";
}

function normalizeDetectorSignal(
  value: unknown,
  index: number,
  runId: string,
): DiscoverySignal | null {
  if (!isRecord(value)) return null;

  const textualAnchor = getNestedRecord(value, "textual_anchor");
  const canonical = textualAnchor
    ? getNestedRecord(textualAnchor, "canonical")
    : null;
  const surfaces = textualAnchor ? getNestedRecord(textualAnchor, "surfaces") : null;
  const surfaceRu = surfaces ? getNestedRecord(surfaces, "ru") : null;

  const angleFingerprint = getNestedRecord(value, "angle_fingerprint");

  const canonicalQuote =
    toString(canonical?.quote) ||
    toString(canonical?.text) ||
    toString(surfaceRu?.quote);

  const surfaceQuote = toString(surfaceRu?.quote) || canonicalQuote;
  const specificWords =
    toStringArray(surfaceRu?.specific_words).length > 0
      ? toStringArray(surfaceRu?.specific_words)
      : toStringArray(canonical?.specific_words);

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
    reference: DAY1_REFERENCE,
    index,
    runId,
    fingerprint_hash: fingerprint.hash,
    coreObservation,
    readerSurpriseRu,
  };

  return {
    signal_id:
      toString(value.signal_id) && toString(value.signal_id) !== "temporary_detector_id_ok"
        ? toString(value.signal_id)
        : createDeterministicId("sig", signalSeed),

    reference: DAY1_REFERENCE,
    canonical_ref: DAY1_REFERENCE,
    passage_id: "matt_11_28-30",

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
  const anchorWords = new Set(
    [
      signal.textual_anchor.surfaces.ru?.quote,
      ...signal.textual_anchor.surfaces.ru?.specific_words ?? [],
      signal.angle_fingerprint.anchor_canonical.text,
    ]
      .filter(Boolean)
      .map((item) => String(item).toLowerCase()),
  );

  return existingCards
    .map((card) => {
      let score = 0;

      const cardAnchor = `${card.anchor_surface ?? ""} ${card.anchor_canonical ?? ""}`.toLowerCase();

      for (const word of anchorWords) {
        if (word && cardAnchor.includes(word)) score += 3;
      }

      if (card.angle_family === signal.angle_fingerprint.angle_family) score += 2;

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
    "same_angle_different_language",
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
    overlap_explanation:
      toString(value?.overlap_explanation) || null,
    differentiation_required:
      toString(value?.differentiation_required) || null,
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
  const risk = isRecord(value?.risk_assessment)
    ? value.risk_assessment
    : {};

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
    args.verifierVerdict.overall === "fail" ||
    args.sameAngleVerdict.verdict === "same_angle" ||
    args.sameAngleVerdict.verdict === "risky_overclaim" ||
    hasAnyRisk(args.verifierVerdict)
  ) {
    return "discard";
  }

  if (args.verifierVerdict.overall === "needs_patch") {
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
    args.signal.evidence_level === "strong"
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
      verse_with_anchor_highlighted: DAY1_VERSE_TEXT_RU,
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
}): Promise<ModeratorQueueItem> {
  const hashDuplicate = findHashDuplicate(args.signal, args.existingCards);
  const nearestExistingCards = selectNearestExistingCards(
    args.signal,
    args.existingCards,
  );

  let sameAngleVerdict: SameAngleVerdict;

  if (hashDuplicate) {
    sameAngleVerdict = {
      signal_id: args.signal.signal_id,
      verdict: "same_angle",
      compared_against: [hashDuplicate.card_id],
      overlap_explanation:
        "Deterministic fingerprint hash matched an existing card before LLM judge.",
      differentiation_required: null,
      judge_confidence: "high",
    };
  } else {
    const judgePrompt = buildSameAngleJudgePrompt({
      signal: args.signal,
      nearestExistingCards,
    });

    const judgeRaw = await runAI(args.judgeProvider, judgePrompt, "en", true);
    sameAngleVerdict = normalizeSameAngleVerdict(
      parseJsonObject(judgeRaw),
      args.signal,
      "new_angle",
      nearestExistingCards.map((card) => card.card_id),
    );
  }

  const verifierPrompt = buildVerifierPrompt({
    signal: args.signal,
    sameAngleVerdict,
  });

  const verifierRaw = await runAI(args.verifierProvider, verifierPrompt, "en", true);
  const verifierVerdict = normalizeVerifierVerdict(
    parseJsonObject(verifierRaw),
    args.signal,
  );

  return createQueueItem({
    signal: args.signal,
    nearestExistingCards,
    sameAngleVerdict,
    verifierVerdict,
  });
}

function compareCalibrationResult(
  result: Day1CalibrationResult,
): boolean {
  const expected = result.expected;
  const actual = result.actual;

  if (actual.hash_match_before_judge !== expected.hash_match_before_judge) {
    return false;
  }

  if (actual.same_angle_verdict !== expected.same_angle_verdict) {
    return false;
  }

  if (actual.verifier_overall !== expected.verifier_overall) {
    return false;
  }

  if (
    actual.verifier_pretty_but_empty !== expected.verifier_pretty_but_empty
  ) {
    return false;
  }

  for (const [key, value] of Object.entries(expected.verifier_risk_flags)) {
    const actualValue =
      actual.verifier_risk_flags[key as keyof VerifierVerdict["risk_assessment"]];

    if (actualValue !== value) return false;
  }

  return true;
}

export async function runDay1Calibration(args?: {
  judgeProvider?: Provider;
  verifierProvider?: Provider;
}): Promise<Day1PipelineResult> {
  const judgeProvider = args?.judgeProvider ?? "openai";
  const verifierProvider = args?.verifierProvider ?? "openai";
  const existingCards = getMatthew1129ExistingCardsForJudge();

  const calibration: Day1CalibrationResult[] = [];
  const errors: string[] = [];

  for (const item of DAY1_CALIBRATION_CASES) {
    try {
      const queueItem = await processSignal({
        signal: item.signal,
        existingCards,
        judgeProvider,
        verifierProvider,
      });

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
      errors: ["Detector did not return a valid JSON array."],
    };
  }

  const signals = parsedArray
    .map((item, index) => normalizeDetectorSignal(item, index, runId))
    .filter((item): item is DiscoverySignal => item !== null);

  const queue: ModeratorQueueItem[] = [];

  for (const signal of signals) {
    try {
      queue.push(
        await processSignal({
          signal,
          existingCards,
          judgeProvider,
          verifierProvider,
        }),
      );
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
    errors,
  };
}
