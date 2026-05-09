import {
  createAngleFingerprint,
  createDeterministicId,
} from "../fingerprint";
import type {
  AngleFamily,
  CoverageSnapshot,
  ExistingCoverageCard,
} from "../types";

/**
 * Day-1 manual CoverageSnapshot.
 *
 * Purpose:
 * - provide a tiny, controlled coverage map for Matthew 11:29;
 * - give Same-Angle Judge something real to compare against;
 * - avoid touching Supabase or the legacy Studio during the first vertical slice.
 *
 * Important:
 * This is NOT production coverage generation.
 * This is a hand-built test fixture for validating Discovery Refinery mechanics.
 */

export const DAY1_REFERENCE = "Matthew 11:29";
export const DAY1_CANONICAL_REF = "Matthew 11:29";
export const DAY1_PASSAGE_ID = "matt_11_28-30";

export const DAY1_PRIMARY_LANG = "ru" as const;

export const DAY1_VERSE_TEXT_RU =
  "возьмите иго Мое на себя и научитесь от Меня, ибо Я кроток и смирен сердцем, и найдете покой душам вашим";

export const DAY1_PASSAGE_TEXT_RU =
  "28 Придите ко Мне все труждающиеся и обремененные, и Я успокою вас.\n" +
  "29 Возьмите иго Мое на себя и научитесь от Меня, ибо Я кроток и смирен сердцем, и найдете покой душам вашим.\n" +
  "30 Ибо иго Мое благо, и бремя Мое легко.";

type ExistingCardFixtureInput = {
  seed: string;
  title: string;
  anchorSurface: string;
  angleFamily: AngleFamily;
  phenomenon: string;
  interpretiveMove: string;
  coreObservationSummary: string;
  status?: ExistingCoverageCard["status"];
  locked?: boolean;
};

function makeExistingCoverageCard(
  input: ExistingCardFixtureInput,
): ExistingCoverageCard {
  const fingerprint = createAngleFingerprint({
    anchor_canonical: {
      lang: "ru",
      text: input.anchorSurface,
      canonical_pending: true,
    },
    phenomenon: input.phenomenon,
    phenomenon_status: "approved_vocab",
    interpretive_move: input.interpretiveMove,
    interpretive_move_status: "approved_vocab",
    angle_family: input.angleFamily,
  });

  return {
    card_id: createDeterministicId("existing", {
      reference: DAY1_REFERENCE,
      seed: input.seed,
      title: input.title,
      fingerprint_hash: fingerprint.hash,
    }),
    title: input.title,
    anchor_surface: input.anchorSurface,
    anchor_canonical: fingerprint.anchor_canonical.text,
    angle_family: input.angleFamily,
    fingerprint_hash: fingerprint.hash,
    fingerprint_components: {
      anchor: fingerprint.anchor_canonical.text,
      phenomenon: fingerprint.phenomenon,
      interpretive_move: fingerprint.interpretive_move,
      angle_family: fingerprint.angle_family,
    },
    core_observation_summary: input.coreObservationSummary,
    status: input.status ?? "featured",
    locked: input.locked ?? false,
    lang: DAY1_PRIMARY_LANG,
  };
}

/**
 * Synthetic accepted cards.
 *
 * These are intentionally small summaries, not final public copy.
 * The point is to give Day-1 duplicate logic known coverage:
 *
 * 1. lexical card on "кроток"
 * 2. image/metaphor card on "иго"
 * 3. structural card on command/result movement
 *
 * The detector should be able to find a new rhetorical angle on "ибо"
 * without being confused by the existing lexical "кроток" card.
 */
export const DAY1_EXISTING_ACTIVE_CARDS: ExistingCoverageCard[] = [
  makeExistingCoverageCard({
    seed: "lexical_meek",
    title: "Кротость здесь не слабость",
    anchorSurface: "кроток",
    angleFamily: "lexical",
    phenomenon: "lexical_meaning_clarification",
    interpretiveMove: "expand_word_semantic_range",
    coreObservationSummary:
      "Existing card explains the lexical force of 'кроток' as more than mere softness or weakness.",
  }),

  makeExistingCoverageCard({
    seed: "yoke_image",
    title: "Покой приходит не без ярма, а через другое ярмо",
    anchorSurface: "иго Мое",
    angleFamily: "metaphor_image",
    phenomenon: "metaphor_reversal",
    interpretiveMove: "burden_image_reframed_as_rest_path",
    coreObservationSummary:
      "Existing card notices the paradox that rest is connected with taking a yoke, not escaping all yokes.",
  }),

  makeExistingCoverageCard({
    seed: "command_result_structure",
    title: "Стих движется от принятия к обучению и покою",
    anchorSurface: "возьмите ... научитесь ... найдете",
    angleFamily: "structural",
    phenomenon: "command_sequence_to_result",
    interpretiveMove: "obedient_learning_as_path_to_rest",
    coreObservationSummary:
      "Existing card summarizes the visible movement: take the yoke, learn, then find rest.",
    status: "reserve",
  }),
];

/**
 * A deliberately weak rejected fixture.
 *
 * This helps Day-1 avoid letting sentimental paraphrase back in as discovery.
 */
export const DAY1_REJECTED_CARDS: ExistingCoverageCard[] = [
  makeExistingCoverageCard({
    seed: "pretty_empty_rest",
    title: "Иисус понимает усталые сердца",
    anchorSurface: "найдете покой душам вашим",
    angleFamily: "other",
    phenomenon: "generic_comfort_paraphrase",
    interpretiveMove: "sentimental_application_without_textual_mechanism",
    coreObservationSummary:
      "Rejected because it sounds warm but does not identify a specific textual mechanism.",
    status: "rejected",
  }),
];

export const MATTHEW_1129_DAY1_SNAPSHOT: CoverageSnapshot = {
  reference: DAY1_REFERENCE,
  canonical_ref: DAY1_CANONICAL_REF,
  passage_id: DAY1_PASSAGE_ID,

  genre: "discourse",
  genre_confidence: 0.9,

  primary_languages_covered: [DAY1_PRIMARY_LANG],

  active_cards: DAY1_EXISTING_ACTIVE_CARDS.filter(
    (card) => card.status === "featured",
  ),
  reserve_cards: DAY1_EXISTING_ACTIVE_CARDS.filter(
    (card) => card.status === "reserve",
  ),
  rejected_cards: DAY1_REJECTED_CARDS,

  anchor_usage: {
    кроток: 1,
    иго: 1,
    "иго Мое": 1,
    возьмите: 1,
    научитесь: 1,
    "найдете покой": 1,
    ибо: 0,
    "смирен сердцем": 0,
  },

  angle_family_coverage: {
    lexical: 1,
    metaphor_image: 1,
    structural: 1,
    rhetorical: 0,
    translation: 0,
    intertextual: 0,
    historical: 0,
    paradox_tension: 1,
    meaningful_absence: 0,
    contextual: 0,
    discourse_function: 0,
  },

  overloaded_anchors: [],
  overloaded_families: [],
  undercovered_families: [
    "rhetorical",
    "translation",
    "intertextual",
    "historical",
    "meaningful_absence",
    "contextual",
    "discourse_function",
  ],

  rejected_clusters: [
    {
      pattern: "pretty but empty comfort paraphrase",
      count: 1,
      last_seen: null,
    },
  ],

  saturation_status: "active",

  last_run_yield: null,
  last_3_runs_avg_yield: null,
  last_3_runs_duplicate_rate: null,
  last_3_runs_pretty_empty_rate: null,

  updated_at: "2026-05-08T00:00:00.000Z",
  version: 1,
};

export function getMatthew1129Day1Snapshot(): CoverageSnapshot {
  return MATTHEW_1129_DAY1_SNAPSHOT;
}

export function getMatthew1129ExistingCardsForJudge(): ExistingCoverageCard[] {
  return [
    ...MATTHEW_1129_DAY1_SNAPSHOT.active_cards,
    ...MATTHEW_1129_DAY1_SNAPSHOT.reserve_cards,
    ...(MATTHEW_1129_DAY1_SNAPSHOT.rejected_cards ?? []),
  ];
}

export function getMatthew1129CoverageSummaryForPrompt(): string {
  const activeAndReserve = [
    ...MATTHEW_1129_DAY1_SNAPSHOT.active_cards,
    ...MATTHEW_1129_DAY1_SNAPSHOT.reserve_cards,
  ];

  const lines = activeAndReserve.map((card, index) => {
    const components = card.fingerprint_components;

    return [
      `${index + 1}. ${card.title ?? "Untitled existing card"}`,
      `   anchor: ${card.anchor_surface ?? card.anchor_canonical ?? "unknown"}`,
      `   family: ${card.angle_family}`,
      components
        ? `   fingerprint: ${components.phenomenon} / ${components.interpretive_move}`
        : null,
      card.core_observation_summary
        ? `   summary: ${card.core_observation_summary}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `Reference: ${DAY1_REFERENCE}`,
    "Genre: discourse",
    "Primary language: ru",
    "",
    "Existing accepted coverage:",
    ...lines,
    "",
    "Undercovered families:",
    MATTHEW_1129_DAY1_SNAPSHOT.undercovered_families.join(", "),
    "",
    "Important instruction:",
    "Do not duplicate lexical clarification of 'кроток', the yoke image, or the basic command-to-result sequence. A signal about 'ибо' as a rhetorical reason clause may still be new if it focuses on argument function rather than lexical meaning.",
  ].join("\n");
}
