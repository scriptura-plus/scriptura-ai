export type DiscoveryLang = "ru" | "en" | "es";

export type CanonicalAnchorLang =
  | "grc"
  | "heb"
  | "arc"
  | "ru"
  | "en"
  | "es";

export type VerseGenre =
  | "narrative"
  | "discourse"
  | "poetry"
  | "wisdom"
  | "law_command"
  | "dialogue"
  | "prophecy"
  | "genealogy_formulaic"
  | "mixed"
  | "unknown";

export type AngleFamily =
  | "lexical"
  | "rhetorical"
  | "structural"
  | "translation"
  | "intertextual"
  | "historical"
  | "paradox_tension"
  | "meaningful_absence"
  | "contextual"
  | "narrative"
  | "metaphor_image"
  | "discourse_function"
  | "other";

export type VocabularyStatus = "approved_vocab" | "proposed_new";

export type EvidenceLevel = "strong" | "plausible" | "weak";

export type SourceBasisPrimary =
  | "verse_text_only"
  | "original_language_packet"
  | "external_scholarly"
  | "moderator_manual"
  | "translation_comparison"
  | "mixed";

export type RiskFlag =
  | "lexical_overclaim"
  | "intertext_speculative"
  | "historical_overclaim"
  | "theological_overreach"
  | "meaningful_absence_unsafe"
  | "self_generated_echo"
  | "weak_anchor"
  | "pretty_but_empty"
  | "needs_external_check";

export type RelationToExisting =
  | "same_angle"
  | "same_angle_different_language"
  | "partial_overlap"
  | "new_angle"
  | "stronger_version"
  | "pretty_but_empty"
  | "risky_overclaim"
  | "none";

export type SuggestedNextAction =
  | "craft_card"
  | "approve_active"
  | "approve_reserve"
  | "reserve"
  | "discard"
  | "needs_patch"
  | "needs_external_check"
  | "needs_moderator_review";

export type LanguageStatus =
  | "approved"
  | "not_yet_localized"
  | "localization_in_review"
  | "localization_rejected";

export type TextualAnchorSurface = {
  quote: string;
  specific_words: string[];
  translation_source?: string | null;
};

export type TextualAnchorCanonical = {
  lang: CanonicalAnchorLang;
  quote: string;
  specific_words: string[];
  canonical_pending: boolean;
};

export type TextualAnchor = {
  canonical: TextualAnchorCanonical;
  surfaces: Record<DiscoveryLang, TextualAnchorSurface | null>;
};

export type AngleFingerprint = {
  anchor_canonical: {
    lang: CanonicalAnchorLang;
    text: string;
    canonical_pending: boolean;
  };
  phenomenon: string;
  phenomenon_status: VocabularyStatus;
  interpretive_move: string;
  interpretive_move_status: VocabularyStatus;
  angle_family: AngleFamily;
  hash: string;
};

export type SourceBasis = {
  primary: SourceBasisPrimary;
  has_self_generated_context: boolean;
};

export type DiscoverySignal = {
  signal_id: string;
  reference: string;
  canonical_ref?: string | null;
  passage_id?: string | null;

  primary_lang: DiscoveryLang;

  textual_anchor: TextualAnchor;

  /**
   * Internal analytical claim.
   * Always English.
   * Must describe what the text is doing, not how the public card will sound.
   */
  core_observation: string;

  /**
   * Reader-facing surprise test.
   * Only primary_lang is filled during Day-1.
   */
  reader_surprise_sentence: Record<DiscoveryLang, string | null>;

  angle_fingerprint: AngleFingerprint;

  source_basis: SourceBasis;
  evidence_level: EvidenceLevel;
  risk_flags: RiskFlag[];

  relation_to_existing?: RelationToExisting | SameAngleVerdict | null;
  verifier_verdict?: VerifierVerdict | null;
  suggested_next_action?: SuggestedNextAction | ModeratorAction | null;

  detector_id: string;
  run_id: string;
  created_at: string;

  metadata?: Record<string, unknown>;
};

export type SameAngleVerdict = {
  signal_id: string;
  verdict: RelationToExisting;
  compared_against: string[];
  overlap_explanation: string | null;
  differentiation_required: string | null;
  judge_confidence: "high" | "medium" | "low";
};

export type VerifierRiskAssessment = {
  lexical_overclaim: boolean;
  intertext_speculative: boolean;
  historical_overclaim: boolean;
  theological_overreach: boolean;
  meaningful_absence_unsafe: boolean;
  self_generated_echo: boolean;
};

export type VerifierVerdict = {
  signal_id: string;

  discovery_present: boolean;
  anchor_precise: boolean;
  evidence_supports_claim: boolean;
  consistency_check: boolean;

  risk_assessment: VerifierRiskAssessment;

  /**
   * Explicit style-degradation flag.
   * This must never be hidden inside another score.
   */
  pretty_but_empty: boolean;

  overall: "pass" | "fail" | "needs_patch";
  patch_instruction: string | null;
  rejection_reason: string | null;
};

export type ExistingCoverageCard = {
  card_id: string;
  title?: string | null;
  anchor_surface?: string | null;
  anchor_canonical?: string | null;
  angle_family: AngleFamily;
  fingerprint_hash: string;
  fingerprint_components?: {
    anchor: string;
    phenomenon: string;
    interpretive_move: string;
    angle_family: AngleFamily;
  };
  core_observation_summary?: string | null;
  status: "featured" | "reserve" | "rewrite" | "hidden" | "rejected";
  locked: boolean;
  lang?: DiscoveryLang;
};

export type CoverageSnapshot = {
  reference: string;
  canonical_ref?: string | null;
  passage_id?: string | null;

  genre: VerseGenre;
  genre_confidence: number | null;

  primary_languages_covered: DiscoveryLang[];

  active_cards: ExistingCoverageCard[];
  reserve_cards: ExistingCoverageCard[];
  rejected_cards?: ExistingCoverageCard[];

  anchor_usage: Record<string, number>;

  angle_family_coverage: Partial<Record<AngleFamily, number>>;

  overloaded_anchors: string[];
  overloaded_families: AngleFamily[];
  undercovered_families: AngleFamily[];

  rejected_clusters: Array<{
    pattern: string;
    count: number;
    last_seen: string | null;
  }>;

  saturation_status:
    | "active"
    | "likely_saturated"
    | "saturated"
    | "low_discovery_genre";

  last_run_yield: number | null;
  last_3_runs_avg_yield: number | null;
  last_3_runs_duplicate_rate: number | null;
  last_3_runs_pretty_empty_rate?: number | null;

  updated_at: string;
  version: number;
};

export type ModeratorQueueTier =
  | "A_routine"
  | "B_conflict"
  | "C_risk_escalation";

export type ModeratorDecisionType =
  | "angle_approval"
  | "language_localization";

export type ModeratorAction =
  | "approve_active"
  | "approve_reserve"
  | "replace_existing"
  | "keep_both"
  | "rewrite"
  | "send_back"
  | "discard"
  | "mark_for_external_research"
  | "escalate";

export type ModeratorQueueItem = {
  queue_item_id: string;
  decision_type: ModeratorDecisionType;
  tier: ModeratorQueueTier;

  signal: DiscoverySignal;

  card_draft?: unknown | null;

  context: {
    verse_with_anchor_highlighted: string;
    nearest_existing_cards: ExistingCoverageCard[];
    fingerprint_diff: unknown | null;
    existing_language_versions?: unknown | null;
  };

  verdicts: {
    same_angle: SameAngleVerdict;
    verifier: VerifierVerdict;
  };

  suggested_action: ModeratorAction;
  suggested_action_confidence: "high" | "medium" | "low";
  available_actions: ModeratorAction[];

  moderator_decision?: ModeratorAction | null;
  moderator_reasoning?: string | null;
  moderator_decision_time_seconds?: number | null;

  created_at: string;
  priority: 1 | 2 | 3 | 4 | 5;
};

export type DiscoveryRun = {
  run_id: string;
  reference: string;
  canonical_ref?: string | null;
  primary_lang: DiscoveryLang;
  detector_id: string;
  genre: VerseGenre;
  status: "started" | "completed" | "failed";
  created_at: string;
  completed_at?: string | null;
  error?: string | null;
};

export type VocabularyEntry = {
  value: string;
  normalized_value: string;
  kind: "phenomenon" | "interpretive_move";
  status: VocabularyStatus | "merged_into_existing" | "rejected";
  canonical_value?: string | null;
  created_at: string;
  updated_at: string;
};
