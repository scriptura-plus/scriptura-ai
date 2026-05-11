import type {
  DiscoverySignal,
  ExistingCoverageCard,
} from "@/lib/discovery-refinery/types";

export type IntakeStatus =
  | "keep_raw"
  | "keep_cautious"
  | "keep_needs_evidence"
  | "keep_possible_duplicate"
  | "keep_surface_hypothesis"
  | "discard_pretty_empty"
  | "discard_clear_fail";

export type ReviewerRequired = "none" | "promotion_only" | "full_before_public";

export type LanguageScope =
  | "surface_only"
  | "translation_general"
  | "original_anchored";

export type CrossLingualStatus =
  | "not_assessed"
  | "surface_only"
  | "verified_universal";

export type DuplicateConfidence =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "exact";

export type DuplicateGuardResult = {
  exact_fingerprint_match: boolean;
  lexical_similarity_match: boolean;
  matched_card_ids: string[];
  matched_signal_ids: string[];
  duplicate_confidence: DuplicateConfidence;
};

export type IntakeClassification = {
  intake_status: IntakeStatus;
  reviewer_required: ReviewerRequired;

  public_safe_now: boolean;
  can_craft_candidate: boolean;

  requires_evidence: boolean;
  possible_duplicate: boolean;

  language_scope: LanguageScope;
  cross_lingual_status: CrossLingualStatus;

  reason: string;
  rules_applied: string[];

  duplicate_guard: DuplicateGuardResult;
};

export type ClassifySignalArgs = {
  signal: DiscoverySignal;
  existingCards?: ExistingCoverageCard[];
  existingSignals?: DiscoverySignal[];
};

type JsonRecord = Record<string, unknown>;

const HARD_EVIDENCE_RISK_FLAGS = new Set([
  "lexical_overclaim",
  "requires_lexical_evidence",
  "historical_overclaim",
  "requires_historical_evidence",
  "intertext_speculative",
  "requires_intertextual_evidence",
  "theological_overreach",
  "requires_theological_evidence",
  "requires_syntactic_evidence",
]);

const SURFACE_HYPOTHESIS_RISK_FLAGS = new Set([
  "requires_original_check",
  "translation_surface_artifact_suspected",
  "russian_synodal_archaism_suspected",
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);

  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);

  let intersection = 0;

  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }

  const union = new Set([...setA, ...setB]).size;

  return union === 0 ? 0 : intersection / union;
}

function includesMeaningfulOverlap(a: string | null, b: string | null): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (!left || !right) return false;

  if (left.length >= 5 && right.includes(left)) return true;
  if (right.length >= 5 && left.includes(right)) return true;

  return false;
}

function getRiskFlags(signal: DiscoverySignal): string[] {
  const raw = signal.risk_flags;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function hasAnyRisk(riskFlags: string[], expected: Set<string>): boolean {
  return riskFlags.some((flag) => expected.has(flag));
}

function getSignalFingerprintHash(signal: DiscoverySignal): string | null {
  const fingerprint = getRecord(signal.angle_fingerprint);
  return getString(fingerprint.hash);
}

function getSignalAngleFamily(signal: DiscoverySignal): string | null {
  const fingerprint = getRecord(signal.angle_fingerprint);
  return getString(fingerprint.angle_family);
}

function getSignalAnchorText(signal: DiscoverySignal): string | null {
  const textualAnchor = getRecord(signal.textual_anchor);
  const canonical = getRecord(textualAnchor.canonical);
  const surfaces = getRecord(textualAnchor.surfaces);
  const ru = getRecord(surfaces.ru);

  return (
    getString(canonical.quote) ||
    getString(canonical.text) ||
    getString(ru.quote)
  );
}

function getSignalReaderSurprise(signal: DiscoverySignal): string | null {
  const readerSurprise = getRecord(signal.reader_surprise_sentence);
  return getString(readerSurprise.ru) || getString(signal.reader_surprise_sentence);
}

function getExistingCardId(card: ExistingCoverageCard): string | null {
  const record = card as unknown as JsonRecord;
  return getString(record.card_id) || getString(record.id);
}

function getExistingCardFingerprint(card: ExistingCoverageCard): string | null {
  const record = card as unknown as JsonRecord;
  return getString(record.fingerprint_hash);
}

function getExistingCardAngleFamily(card: ExistingCoverageCard): string | null {
  const record = card as unknown as JsonRecord;
  return getString(record.angle_family) || getString(record.coverage_type);
}

function getExistingCardAnchor(card: ExistingCoverageCard): string | null {
  const record = card as unknown as JsonRecord;
  return (
    getString(record.anchor_canonical) ||
    getString(record.anchor_surface) ||
    getString(record.anchor)
  );
}

function getExistingCardSearchText(card: ExistingCoverageCard): string {
  const record = card as unknown as JsonRecord;

  return [
    getString(record.title),
    getString(record.anchor_surface),
    getString(record.anchor_canonical),
    getString(record.anchor),
    getString(record.teaser),
    getString(record.why_it_matters),
    getString(record.angle_summary),
  ]
    .filter(Boolean)
    .join(" ");
}

function getExistingSignalSearchText(signal: DiscoverySignal): string {
  return [
    getSignalAnchorText(signal),
    signal.core_observation,
    getSignalReaderSurprise(signal),
  ]
    .filter(Boolean)
    .join(" ");
}

function createEmptyDuplicateGuard(): DuplicateGuardResult {
  return {
    exact_fingerprint_match: false,
    lexical_similarity_match: false,
    matched_card_ids: [],
    matched_signal_ids: [],
    duplicate_confidence: "none",
  };
}

function mergeDuplicateConfidence(
  current: DuplicateConfidence,
  next: DuplicateConfidence,
): DuplicateConfidence {
  const weights: Record<DuplicateConfidence, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    exact: 4,
  };

  return weights[next] > weights[current] ? next : current;
}

function runDuplicateGuard(args: {
  signal: DiscoverySignal;
  existingCards: ExistingCoverageCard[];
  existingSignals: DiscoverySignal[];
}): DuplicateGuardResult {
  const result = createEmptyDuplicateGuard();

  const signalHash = getSignalFingerprintHash(args.signal);
  const signalAnchor = getSignalAnchorText(args.signal);
  const signalFamily = getSignalAngleFamily(args.signal);
  const signalSearchText = [
    signalAnchor,
    args.signal.core_observation,
    getSignalReaderSurprise(args.signal),
  ]
    .filter(Boolean)
    .join(" ");

  const signalTokens = tokenize(signalSearchText);
  const signalAnchorTokens = tokenize(signalAnchor);

  for (const card of args.existingCards) {
    const cardId = getExistingCardId(card);
    const cardHash = getExistingCardFingerprint(card);

    if (signalHash && cardHash && signalHash === cardHash) {
      result.exact_fingerprint_match = true;
      if (cardId) result.matched_card_ids.push(cardId);
      result.duplicate_confidence = mergeDuplicateConfidence(
        result.duplicate_confidence,
        "exact",
      );
      continue;
    }

    const cardFamily = getExistingCardAngleFamily(card);
    const cardAnchor = getExistingCardAnchor(card);
    const cardSearchText = getExistingCardSearchText(card);
    const cardTokens = tokenize(cardSearchText);

    const sameFamily = Boolean(signalFamily && cardFamily && signalFamily === cardFamily);
    const anchorOverlap = includesMeaningfulOverlap(signalAnchor, cardAnchor);
    const textSimilarity = jaccardSimilarity(signalTokens, cardTokens);
    const anchorSimilarity = jaccardSimilarity(signalAnchorTokens, tokenize(cardAnchor));

    const likelyDuplicate =
      (sameFamily && anchorOverlap && textSimilarity >= 0.12) ||
      (sameFamily && anchorSimilarity >= 0.5) ||
      (anchorOverlap && textSimilarity >= 0.22);

    if (likelyDuplicate) {
      result.lexical_similarity_match = true;
      if (cardId) result.matched_card_ids.push(cardId);

      const confidence: DuplicateConfidence =
        sameFamily && anchorOverlap && textSimilarity >= 0.22
          ? "high"
          : sameFamily && (anchorOverlap || anchorSimilarity >= 0.5)
            ? "medium"
            : "low";

      result.duplicate_confidence = mergeDuplicateConfidence(
        result.duplicate_confidence,
        confidence,
      );
    }
  }

  for (const existingSignal of args.existingSignals) {
    const existingId = existingSignal.signal_id;
    const existingHash = getSignalFingerprintHash(existingSignal);

    if (
      args.signal.signal_id &&
      existingSignal.signal_id &&
      args.signal.signal_id === existingSignal.signal_id
    ) {
      continue;
    }

    if (signalHash && existingHash && signalHash === existingHash) {
      result.exact_fingerprint_match = true;
      if (existingId) result.matched_signal_ids.push(existingId);
      result.duplicate_confidence = mergeDuplicateConfidence(
        result.duplicate_confidence,
        "exact",
      );
      continue;
    }

    const existingFamily = getSignalAngleFamily(existingSignal);
    const existingAnchor = getSignalAnchorText(existingSignal);
    const existingTokens = tokenize(getExistingSignalSearchText(existingSignal));

    const sameFamily = Boolean(
      signalFamily && existingFamily && signalFamily === existingFamily,
    );
    const anchorOverlap = includesMeaningfulOverlap(signalAnchor, existingAnchor);
    const textSimilarity = jaccardSimilarity(signalTokens, existingTokens);

    if (sameFamily && anchorOverlap && textSimilarity >= 0.15) {
      result.lexical_similarity_match = true;
      if (existingId) result.matched_signal_ids.push(existingId);

      result.duplicate_confidence = mergeDuplicateConfidence(
        result.duplicate_confidence,
        textSimilarity >= 0.25 ? "high" : "medium",
      );
    }
  }

  result.matched_card_ids = Array.from(new Set(result.matched_card_ids));
  result.matched_signal_ids = Array.from(new Set(result.matched_signal_ids));

  if (
    result.duplicate_confidence === "none" &&
    (result.matched_card_ids.length > 0 || result.matched_signal_ids.length > 0)
  ) {
    result.duplicate_confidence = "low";
  }

  return result;
}

function createClassification(args: {
  status: IntakeStatus;
  reviewerRequired: ReviewerRequired;
  publicSafeNow: boolean;
  canCraftCandidate: boolean;
  requiresEvidence: boolean;
  possibleDuplicate: boolean;
  languageScope?: LanguageScope;
  crossLingualStatus?: CrossLingualStatus;
  reason: string;
  rulesApplied: string[];
  duplicateGuard: DuplicateGuardResult;
}): IntakeClassification {
  return {
    intake_status: args.status,
    reviewer_required: args.reviewerRequired,

    public_safe_now: args.publicSafeNow,
    can_craft_candidate: args.canCraftCandidate,

    requires_evidence: args.requiresEvidence,
    possible_duplicate: args.possibleDuplicate,

    language_scope: args.languageScope ?? "surface_only",
    cross_lingual_status: args.crossLingualStatus ?? "not_assessed",

    reason: args.reason,
    rules_applied: args.rulesApplied,

    duplicate_guard: args.duplicateGuard,
  };
}

function hasMinimumSignalShape(signal: DiscoverySignal): boolean {
  return Boolean(
    getSignalAnchorText(signal) &&
      signal.core_observation &&
      getSignalReaderSurprise(signal),
  );
}

export function classifySignal(args: ClassifySignalArgs): IntakeClassification {
  const signal = args.signal;
  const riskFlags = getRiskFlags(signal);
  const duplicateGuard = runDuplicateGuard({
    signal,
    existingCards: args.existingCards ?? [],
    existingSignals: args.existingSignals ?? [],
  });

  const duplicateDetected =
    duplicateGuard.exact_fingerprint_match ||
    duplicateGuard.duplicate_confidence === "high" ||
    duplicateGuard.duplicate_confidence === "exact";

  // Rule 1 — explicit pretty-but-empty.
  if (riskFlags.includes("pretty_but_empty")) {
    return createClassification({
      status: "discard_pretty_empty",
      reviewerRequired: "none",
      publicSafeNow: false,
      canCraftCandidate: false,
      requiresEvidence: false,
      possibleDuplicate: duplicateDetected,
      reason:
        "Detector flagged the signal as pretty_but_empty; intake should not preserve it as a candidate.",
      rulesApplied: ["R1_PRETTY_BUT_EMPTY"],
      duplicateGuard,
    });
  }

  // Rule 2 — technically incomplete signal.
  if (!hasMinimumSignalShape(signal)) {
    return createClassification({
      status: "discard_clear_fail",
      reviewerRequired: "none",
      publicSafeNow: false,
      canCraftCandidate: false,
      requiresEvidence: false,
      possibleDuplicate: duplicateDetected,
      reason:
        "Signal is missing anchor, core observation, or reader surprise sentence.",
      rulesApplied: ["R2_INCOMPLETE_SIGNAL"],
      duplicateGuard,
    });
  }

  // Rule 3 / 4 — exact or likely duplicate.
  if (duplicateDetected || duplicateGuard.duplicate_confidence === "medium") {
    return createClassification({
      status: "keep_possible_duplicate",
      reviewerRequired: "promotion_only",
      publicSafeNow: false,
      canCraftCandidate: false,
      requiresEvidence: false,
      possibleDuplicate: true,
      reason:
        duplicateGuard.exact_fingerprint_match
          ? "Exact fingerprint match found; preserve for audit/lineage but do not craft without merge review."
          : "Likely duplicate by anchor/family/text similarity; preserve but require duplicate review before crafting.",
      rulesApplied: duplicateGuard.exact_fingerprint_match
        ? ["R3_EXACT_FINGERPRINT_DUPLICATE"]
        : ["R4_LIKELY_DUPLICATE_SIMILARITY"],
      duplicateGuard,
    });
  }

  // Rule 5 / 6 — claims that require evidence.
  if (hasAnyRisk(riskFlags, HARD_EVIDENCE_RISK_FLAGS)) {
    return createClassification({
      status: "keep_needs_evidence",
      reviewerRequired: "full_before_public",
      publicSafeNow: false,
      canCraftCandidate: true,
      requiresEvidence: true,
      possibleDuplicate: false,
      reason:
        "Signal contains lexical, historical, intertextual, theological, syntactic, or other evidence-demand risk; save it, but block public promotion until evidence is attached.",
      rulesApplied: ["R5_R6_REQUIRES_EVIDENCE"],
      duplicateGuard,
    });
  }

  // Rule 7 — surface/translation artifact risk.
  if (hasAnyRisk(riskFlags, SURFACE_HYPOTHESIS_RISK_FLAGS)) {
    return createClassification({
      status: "keep_surface_hypothesis",
      reviewerRequired: "full_before_public",
      publicSafeNow: false,
      canCraftCandidate: true,
      requiresEvidence: true,
      possibleDuplicate: false,
      languageScope: "surface_only",
      crossLingualStatus: "surface_only",
      reason:
        "Signal may depend on Russian/RSTJ surface wording or translation/register artifact; preserve as surface-only hypothesis.",
      rulesApplied: ["R7_SURFACE_HYPOTHESIS"],
      duplicateGuard,
    });
  }

  // Rule 8 — meaningful absence is allowed at intake but needs cautious wording.
  if (riskFlags.includes("meaningful_absence_unsafe")) {
    return createClassification({
      status: "keep_cautious",
      reviewerRequired: "promotion_only",
      publicSafeNow: false,
      canCraftCandidate: true,
      requiresEvidence: false,
      possibleDuplicate: false,
      reason:
        "Meaningful absence signal has a real mechanism but needs cautious wording; do not frame as authorial intent without evidence.",
      rulesApplied: ["R8_MEANINGFUL_ABSENCE_CAUTIOUS"],
      duplicateGuard,
    });
  }

  // Rule 9 — strong evidence, no risk, no duplicate.
  if (signal.evidence_level === "strong" && riskFlags.length === 0) {
    return createClassification({
      status: "keep_raw",
      reviewerRequired: "promotion_only",
      publicSafeNow: false,
      canCraftCandidate: true,
      requiresEvidence: false,
      possibleDuplicate: false,
      reason:
        "Strong text-grounded signal with no intake risks; preserve as raw discovery material.",
      rulesApplied: ["R9_STRONG_KEEP_RAW"],
      duplicateGuard,
    });
  }

  // Rule 10 — plausible evidence, no hard risk.
  if (signal.evidence_level === "plausible" && riskFlags.length === 0) {
    return createClassification({
      status: "keep_cautious",
      reviewerRequired: "promotion_only",
      publicSafeNow: false,
      canCraftCandidate: true,
      requiresEvidence: false,
      possibleDuplicate: false,
      reason:
        "Plausible text-grounded signal; preserve with cautious wording for later crafting.",
      rulesApplied: ["R10_PLAUSIBLE_KEEP_CAUTIOUS"],
      duplicateGuard,
    });
  }

  // Rule 11 — weak evidence, but real minimum shape.
  if (signal.evidence_level === "weak") {
    return createClassification({
      status: "keep_cautious",
      reviewerRequired: "promotion_only",
      publicSafeNow: false,
      canCraftCandidate: true,
      requiresEvidence: false,
      possibleDuplicate: false,
      reason:
        "Weak but parseable signal with a visible anchor and observation; preserve at low priority instead of discarding at intake.",
      rulesApplied: ["R11_WEAK_BUT_REAL_KEEP_CAUTIOUS"],
      duplicateGuard,
    });
  }

  // Rule 12 — generous default.
  return createClassification({
    status: "keep_cautious",
    reviewerRequired: "promotion_only",
    publicSafeNow: false,
    canCraftCandidate: true,
    requiresEvidence: false,
    possibleDuplicate: false,
    reason:
      "Default intake behavior is generous: preserve the signal cautiously unless it is an explicit clear fail.",
    rulesApplied: ["R12_DEFAULT_KEEP_CAUTIOUS"],
    duplicateGuard,
  });
}

export function shouldStoreSignal(classification: IntakeClassification): boolean {
  return (
    classification.intake_status !== "discard_pretty_empty" &&
    classification.intake_status !== "discard_clear_fail"
  );
}

export function shouldBlockPublicPromotion(
  classification: IntakeClassification,
): boolean {
  return (
    !classification.public_safe_now ||
    classification.requires_evidence ||
    classification.possible_duplicate ||
    classification.reviewer_required === "full_before_public"
  );
}
