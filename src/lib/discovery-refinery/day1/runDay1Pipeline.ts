import { createAngleFingerprint, createDeterministicId } from "../fingerprint";
import type {
  DiscoverySignal,
  EvidenceLevel,
  ExistingCoverageCard,
  RelationToExisting,
  VerifierVerdict,
} from "../types";
import {
  DAY1_CANONICAL_REF,
  DAY1_PASSAGE_ID,
  DAY1_PRIMARY_LANG,
  DAY1_REFERENCE,
  DAY1_VERSE_TEXT_RU,
  getMatthew1129ExistingCardsForJudge,
} from "./matthew1129Snapshot";

export type Day1CalibrationCase = {
  case_id: string;
  label: string;
  purpose: string;
  signal: DiscoverySignal;
  nearest_existing_cards: ExistingCoverageCard[];
  expected: {
    hash_match_before_judge: boolean;
    same_angle_verdict: RelationToExisting;
    verifier_overall: VerifierVerdict["overall"];
    verifier_pretty_but_empty: boolean;
    verifier_risk_flags: Partial<VerifierVerdict["risk_assessment"]>;
  };
};

const CREATED_AT = "2026-05-08T00:00:00.000Z";
const RUN_ID = "day1_calibration_run";
const DETECTOR_ID = "day1_calibration_fixture";

function makeSignal(args: {
  seed: string;
  anchorQuote: string;
  anchorWords: string[];
  phenomenon: string;
  interpretiveMove: string;
  angleFamily: DiscoverySignal["angle_fingerprint"]["angle_family"];
  coreObservation: string;
  readerSurpriseRu: string;
  evidenceLevel?: EvidenceLevel;
  riskFlags?: DiscoverySignal["risk_flags"];
}): DiscoverySignal {
  const fingerprint = createAngleFingerprint({
    anchor_canonical: {
      lang: "ru",
      text: args.anchorQuote,
      canonical_pending: true,
    },
    phenomenon: args.phenomenon,
    phenomenon_status: "proposed_new",
    interpretive_move: args.interpretiveMove,
    interpretive_move_status: "proposed_new",
    angle_family: args.angleFamily,
  });

  return {
    signal_id: createDeterministicId("sig", {
      reference: DAY1_REFERENCE,
      seed: args.seed,
      fingerprint_hash: fingerprint.hash,
    }),

    reference: DAY1_REFERENCE,
    canonical_ref: DAY1_CANONICAL_REF,
    passage_id: DAY1_PASSAGE_ID,

    primary_lang: DAY1_PRIMARY_LANG,

    textual_anchor: {
      canonical: {
        lang: "ru",
        quote: args.anchorQuote,
        specific_words: args.anchorWords,
        canonical_pending: true,
      },
      surfaces: {
        ru: {
          quote: args.anchorQuote,
          specific_words: args.anchorWords,
          translation_source: "RSTJ 1876 / Synodal Yahweh Edition",
        },
        en: null,
        es: null,
      },
    },

    core_observation: args.coreObservation,

    reader_surprise_sentence: {
      ru: args.readerSurpriseRu,
      en: null,
      es: null,
    },

    angle_fingerprint: fingerprint,

    source_basis: {
      primary: "verse_text_only",
      has_self_generated_context: false,
    },

    evidence_level: args.evidenceLevel ?? "strong",
    risk_flags: args.riskFlags ?? [],

    relation_to_existing: null,
    verifier_verdict: null,
    suggested_next_action: null,

    detector_id: DETECTOR_ID,
    run_id: RUN_ID,
    created_at: CREATED_AT,

    metadata: {
      verse_text_ru: DAY1_VERSE_TEXT_RU,
      calibration_fixture: true,
    },
  };
}

const existingCards = getMatthew1129ExistingCardsForJudge();

function nearestByAnchorOrFamily(args: {
  anchorIncludes?: string;
  family?: DiscoverySignal["angle_fingerprint"]["angle_family"];
  limit?: number;
}): ExistingCoverageCard[] {
  const limit = args.limit ?? 3;

  const ranked = existingCards
    .map((card) => {
      let score = 0;

      if (
        args.anchorIncludes &&
        (card.anchor_surface ?? card.anchor_canonical ?? "")
          .toLowerCase()
          .includes(args.anchorIncludes.toLowerCase())
      ) {
        score += 3;
      }

      if (args.family && card.angle_family === args.family) {
        score += 2;
      }

      if (card.status === "featured") score += 1;

      return { card, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = ranked.map((item) => item.card).slice(0, limit);

  return selected.length > 0 ? selected : existingCards.slice(0, limit);
}

export const DAY1_CALIBRATION_CASES: Day1CalibrationCase[] = [
  {
    case_id: "case_01_same_angle_hash_duplicate",
    label: "Same angle — lexical 'кроток' duplicate",
    purpose:
      "The deterministic fingerprint hash should catch this before an LLM judge call. The verifier may still pass the signal intrinsically because duplication is handled by Same-Angle Judge.",
    signal: makeSignal({
      seed: "same_angle_lexical_meek",
      anchorQuote: "кроток",
      anchorWords: ["кроток"],
      phenomenon: "lexical_meaning_clarification",
      interpretiveMove: "expand_word_semantic_range",
      angleFamily: "lexical",
      coreObservation:
        "The signal clarifies the semantic force of the word translated as 'meek/gentle' and distinguishes it from weakness.",
      readerSurpriseRu:
        "Я не замечал, что 'кроток' здесь не обязательно звучит как слабость, а может описывать управляемую мягкость.",
    }),
    nearest_existing_cards: nearestByAnchorOrFamily({
      anchorIncludes: "кроток",
      family: "lexical",
    }),
    expected: {
      hash_match_before_judge: true,
      same_angle_verdict: "same_angle",
      verifier_overall: "pass",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {},
    },
  },

  {
    case_id: "case_02_reason_connector_overlap_needs_patch",
    label: "Partial overlap — 'ибо' as reason connector",
    purpose:
      "This is a real rhetorical signal, but it overlaps with the existing/nearby idea that Jesus' stated character becomes a basis for trust. The correct Day-1 behavior is conservative: partial_overlap plus needs_patch, not automatic approval.",
    signal: makeSignal({
      seed: "reason_connector_overlap_needs_patch",
      anchorQuote: "ибо",
      anchorWords: ["ибо"],
      phenomenon: "reason_connector_as_argument",
      interpretiveMove: "reason_clause_grounds_command",
      angleFamily: "rhetorical",
      coreObservation:
        "The connector 'for' makes the following character description function as the stated reason for the preceding command.",
      readerSurpriseRu:
        "Я не замечал, что 'ибо' превращает описание характера Иисуса в основание доверять Его призыву.",
    }),
    nearest_existing_cards: nearestByAnchorOrFamily({
      anchorIncludes: "ибо",
      family: "rhetorical",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "partial_overlap",
      verifier_overall: "needs_patch",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {},
    },
  },

  {
    case_id: "case_03_partial_overlap_same_anchor_new_move",
    label: "Partial overlap — same anchor, different move",
    purpose:
      "Shares the anchor 'кроток' with an existing lexical card, but moves from lexical meaning to rhetorical function. It should remain partial_overlap, but the verifier may pass the signal intrinsically because the observation is text-grounded.",
    signal: makeSignal({
      seed: "partial_overlap_meek_character_argument",
      anchorQuote: "кроток",
      anchorWords: ["кроток"],
      phenomenon: "speaker_character_as_argument",
      interpretiveMove: "character_trait_as_authority_basis",
      angleFamily: "rhetorical",
      coreObservation:
        "The speaker's stated gentleness functions rhetorically as a credential for accepting his instruction rather than merely as a character description.",
      readerSurpriseRu:
        "Я не замечал, что 'кроток' может работать не как украшение характера, а как основание доверять Учителю.",
    }),
    nearest_existing_cards: nearestByAnchorOrFamily({
      anchorIncludes: "кроток",
      family: "lexical",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "partial_overlap",
      verifier_overall: "pass",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {},
    },
  },

  {
    case_id: "case_04_pretty_but_empty",
    label: "Pretty but empty — sentimental paraphrase",
    purpose:
      "The code decision layer must flag this before relying on the LLM judge. The core observation is warm but not an analytical textual discovery.",
    signal: makeSignal({
      seed: "pretty_but_empty_rest_unique_fingerprint",
      anchorQuote: "найдете покой душам вашим",
      anchorWords: ["покой", "душам"],
      phenomenon: "generic_emotional_summary",
      interpretiveMove: "turn_rest_phrase_into_sentiment",
      angleFamily: "other",
      coreObservation:
        "Jesus invites tired people to receive rest and shows that he understands weary hearts.",
      readerSurpriseRu:
        "Я не замечал, насколько глубоко Иисус понимает усталое сердце.",
      evidenceLevel: "weak",
      riskFlags: ["pretty_but_empty"],
    }),
    nearest_existing_cards: nearestByAnchorOrFamily({
      anchorIncludes: "покой",
      family: "other",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "pretty_but_empty",
      verifier_overall: "fail",
      verifier_pretty_but_empty: true,
      verifier_risk_flags: {},
    },
  },

  {
    case_id: "case_05_risky_lexical_overclaim",
    label: "Risky overclaim — unsupported Greek claim",
    purpose:
      "The code decision layer must catch an overconfident lexical claim. Day-1 explicitly forbids Greek lexical claims because canonical Greek work is deferred.",
    signal: makeSignal({
      seed: "risky_lexical_overclaim_praus",
      anchorQuote: "кроток",
      anchorWords: ["кроток"],
      phenomenon: "unsupported_original_language_claim",
      interpretiveMove: "lexical_claim_used_as_discovery",
      angleFamily: "lexical",
      coreObservation:
        "The Greek word πραΰς literally means 'safe authority' and proves that Jesus offers controlled power.",
      readerSurpriseRu:
        "Я не замечал, что 'кроткий' в оригинале буквально означает 'безопасная власть'.",
      evidenceLevel: "weak",
      riskFlags: ["lexical_overclaim"],
    }),
    nearest_existing_cards: nearestByAnchorOrFamily({
      anchorIncludes: "кроток",
      family: "lexical",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "risky_overclaim",
      verifier_overall: "fail",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {
        lexical_overclaim: true,
      },
    },
  },
];

export function getDay1CalibrationCases(): Day1CalibrationCase[] {
  return DAY1_CALIBRATION_CASES;
}

export function getDay1CalibrationCase(
  caseId: string,
): Day1CalibrationCase | null {
  return (
    DAY1_CALIBRATION_CASES.find((item) => item.case_id === caseId) ?? null
  );
}
