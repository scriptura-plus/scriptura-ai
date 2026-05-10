import { createAngleFingerprint } from "../fingerprint";
import type {
  DiscoverySignal,
  RiskFlag,
  SameAngleVerdict,
  VerifierVerdict,
} from "../types";
import { DAY1_REFERENCE } from "./matthew1129Snapshot";

export type Day1CalibrationCase = {
  case_id: string;
  label: string;
  signal: DiscoverySignal;
  expected: {
    hash_match_before_judge: boolean;
    same_angle_verdict: SameAngleVerdict["verdict"];
    verifier_overall: VerifierVerdict["overall"];
    verifier_pretty_but_empty: boolean;
    verifier_risk_flags: Partial<VerifierVerdict["risk_assessment"]>;
  };
};

function makeCalibrationSignal(args: {
  caseId: string;
  anchorQuote: string;
  specificWords: string[];
  coreObservation: string;
  readerSurpriseRu: string;
  phenomenon: string;
  interpretiveMove: string;
  angleFamily: DiscoverySignal["angle_fingerprint"]["angle_family"];
  evidenceLevel: DiscoverySignal["evidence_level"];
  riskFlags?: RiskFlag[];
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
    signal_id: `sig_${args.caseId}`,
    reference: DAY1_REFERENCE,
    canonical_ref: DAY1_REFERENCE,
    passage_id: "matt_11_28-30",

    primary_lang: "ru",

    textual_anchor: {
      canonical: {
        lang: "ru",
        quote: args.anchorQuote,
        specific_words: args.specificWords,
        canonical_pending: true,
      },
      surfaces: {
        ru: {
          quote: args.anchorQuote,
          specific_words: args.specificWords,
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
      has_self_generated_context: true,
    },

    evidence_level: args.evidenceLevel,
    risk_flags: args.riskFlags ?? [],

    relation_to_existing: null,
    verifier_verdict: null,
    suggested_next_action: null,

    detector_id: "day1_calibration_fixture",
    run_id: "day1_calibration_static",
    created_at: "2026-05-09T00:00:00.000Z",

    metadata: {
      calibration_case_id: args.caseId,
    },
  };
}

export const DAY1_CALIBRATION_CASES: Day1CalibrationCase[] = [
  {
    case_id: "case_01_same_angle_hash_duplicate",
    label: "Same angle — lexical 'кроток' duplicate",
    signal: makeCalibrationSignal({
      caseId: "case_01_same_angle_hash_duplicate",
      anchorQuote: "кроток",
      specificWords: ["кроток"],
      coreObservation:
        "The word 'кроток' should not be read as weakness or passivity; it describes a controlled gentleness that belongs to the character of the speaker.",
      readerSurpriseRu:
        "Я не замечал, что 'кроток' здесь не обязательно звучит как слабость, а может описывать управляемую мягкость.",
      phenomenon: "lexical_meaning_clarification",
      interpretiveMove: "expand_word_semantic_range",
      angleFamily: "lexical",
      evidenceLevel: "strong",
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
    case_id: "case_02_reason_connector_new_angle",
    label: "New angle — 'ибо' as reason connector",
    signal: makeCalibrationSignal({
      caseId: "case_02_reason_connector_new_angle",
      anchorQuote: "ибо Я кроток и смирен сердцем",
      specificWords: ["ибо"],
      coreObservation:
        "The causal connector 'ибо' does more than add a description of Jesus' character. It makes that character the reason the invitation 'learn from me' can be trusted: the yoke is safe because of the gentleness and humility of the one giving it.",
      readerSurpriseRu:
        "Я не замечал, что «ибо» не просто добавляет описание Иисуса, а объясняет, почему призыву «научитесь от Меня» можно доверять: основанием становится характер самого Учителя.",
      phenomenon: "causal_particle_as_trust_warrant",
      interpretiveMove: "speaker_character_grounds_trust_in_imperative",
      angleFamily: "rhetorical",
      evidenceLevel: "strong",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "new_angle",
      verifier_overall: "pass",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {},
    },
  },
  {
    case_id: "case_03_stronger_version_same_anchor_new_move",
    label: "Stronger version — same anchor, sharper rhetorical move",
    signal: makeCalibrationSignal({
      caseId: "case_03_stronger_version_same_anchor_new_move",
      anchorQuote: "кроток",
      specificWords: ["кроток"],
      coreObservation:
        "The word 'кроток' is not only a character description. In the argument of the verse, it helps explain why the yoke can be accepted: the temperament of the teacher becomes part of the reason the command is trustworthy.",
      readerSurpriseRu:
        "Я не замечал, что 'кроток' может работать не как украшение характера, а как основание доверять Учителю.",
      phenomenon: "attribute_function_in_yoke_command",
      interpretiveMove: "meekness_as_ground_for_trusting_teacher_not_character_ornament",
      angleFamily: "rhetorical",
      evidenceLevel: "strong",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "stronger_version",
      verifier_overall: "needs_patch",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {},
    },
  },
  {
    case_id: "case_04_pretty_but_empty",
    label: "Pretty but empty — sentimental paraphrase",
    signal: makeCalibrationSignal({
      caseId: "case_04_pretty_but_empty",
      anchorQuote: "найдете покой душам вашим",
      specificWords: ["покой", "душам"],
      coreObservation:
        "Jesus deeply understands tired hearts and lovingly gives comfort to anyone who comes to him for peace.",
      readerSurpriseRu:
        "Я не замечал, насколько глубоко Иисус понимает усталое сердце.",
      phenomenon: "generic_comfort_paraphrase",
      interpretiveMove: "sentimental_application_without_textual_mechanism",
      angleFamily: "other",
      evidenceLevel: "weak",
      riskFlags: ["pretty_but_empty"],
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
    signal: makeCalibrationSignal({
      caseId: "case_05_risky_lexical_overclaim",
      anchorQuote: "кроток",
      specificWords: ["кроток"],
      coreObservation:
        "The original Greek word behind 'кроток' literally means 'safe authority', so the verse is defining Jesus as a non-threatening ruler.",
      readerSurpriseRu:
        "Я не замечал, что 'кроткий' в оригинале буквально означает 'безопасная власть'.",
      phenomenon: "unsupported_original_language_claim",
      interpretiveMove: "build_theology_from_unverified_lexical_assertion",
      angleFamily: "lexical",
      evidenceLevel: "weak",
      riskFlags: ["lexical_overclaim"],
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
  {
    case_id: "case_06_real_mechanism_overstrong_wording",
    label: "Needs patch — real mechanism with overstrong wording",
    signal: makeCalibrationSignal({
      caseId: "case_06_real_mechanism_overstrong_wording",
      anchorQuote: "ибо Я кроток и смирен сердцем",
      specificWords: ["ибо", "кроток", "смирен сердцем"],
      coreObservation:
        "The causal connector 'ибо' makes Jesus' inner character the complete explanation for why the command 'learn from me' should be obeyed. The verse therefore treats the teacher's character as the only sufficient basis for accepting the yoke.",
      readerSurpriseRu:
        "Я не замечал, что «ибо» делает внутренний характер Учителя единственным достаточным основанием для того, чтобы принять Его иго и повиноваться команде «научитесь».",
      phenomenon: "causal_connector_as_command_warrant",
      interpretiveMove: "teacher_character_as_total_basis_for_obedience",
      angleFamily: "rhetorical",
      evidenceLevel: "strong",
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "new_angle",
      verifier_overall: "needs_patch",
      verifier_pretty_but_empty: false,
      verifier_risk_flags: {},
    },
  },
  {
    case_id: "case_07_no_mechanism_cosmetic_fix",
    label: "Fail — polished language without real textual mechanism",
    signal: makeCalibrationSignal({
      caseId: "case_07_no_mechanism_cosmetic_fix",
      anchorQuote: "иго Мое благо, и бремя Мое легко",
      specificWords: ["иго", "бремя", "легко"],
      coreObservation:
        "Jesus uses tender and balanced language that creates a warm emotional atmosphere and helps the reader feel that life with him is peaceful and beautiful.",
      readerSurpriseRu:
        "Я не замечал, насколько красиво и мягко звучит эта фраза: она создаёт ощущение мира, тепла и внутреннего облегчения.",
      phenomenon: "polished_devotional_impression",
      interpretiveMove: "cosmetic_emotional_rephrasing_without_textual_mechanism",
      angleFamily: "other",
      evidenceLevel: "weak",
      riskFlags: ["pretty_but_empty"],
    }),
    expected: {
      hash_match_before_judge: false,
      same_angle_verdict: "pretty_but_empty",
      verifier_overall: "fail",
      verifier_pretty_but_empty: true,
      verifier_risk_flags: {},
    },
  },
];
