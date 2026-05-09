export type Day15VerseGenre =
  | "gospel_discourse"
  | "prophetic_indictment"
  | "pastoral_instruction"
  | "narrative"
  | "genealogy";

export type Day15ExpectedRichness = "rich" | "medium" | "low";

export type Day15ExistingCoverageMode =
  | "fixture_existing_cards"
  | "empty_existing_cards";

export type Day15VerseFixture = {
  id: string;
  reference: string;
  canonical_ref: string;
  passage_id: string;
  primary_lang: "ru";
  genre: Day15VerseGenre;
  expected_richness: Day15ExpectedRichness;
  existing_coverage_mode: Day15ExistingCoverageMode;

  verse_text_ru: string;
  passage_text_ru: string;

  diagnostic_reason: string;
  expected_behavior_note: string;
};

export const DAY15_VERSE_FIXTURES: Day15VerseFixture[] = [
  {
    id: "matthew_11_29",
    reference: "Matthew 11:29",
    canonical_ref: "Matthew 11:29",
    passage_id: "matt_11_28-30",
    primary_lang: "ru",
    genre: "gospel_discourse",
    expected_richness: "rich",
    existing_coverage_mode: "fixture_existing_cards",

    verse_text_ru:
      "возьмите иго Мое на себя и научитесь от Меня, ибо Я кроток и смирен сердцем, и найдете покой душам вашим",

    passage_text_ru: [
      "28. Придите ко Мне, все труждающиеся и обремененные, и Я успокою вас;",
      "29. возьмите иго Мое на себя и научитесь от Меня, ибо Я кроток и смирен сердцем, и найдете покой душам вашим;",
      "30. ибо иго Мое благо, и бремя Мое легко.",
    ].join("\n"),

    diagnostic_reason:
      "Known rich discourse case. Already used for Day-1 calibration and has fixture existing cards, so it tests duplicate/overlap behavior.",

    expected_behavior_note:
      "Should produce 2-4 useful signals, with some approve_reserve and possibly one rewrite due to overlap with existing fixture cards.",
  },
  {
    id: "isaiah_58_2",
    reference: "Isaiah 58:2",
    canonical_ref: "Isaiah 58:2",
    passage_id: "isa_58_1-3",
    primary_lang: "ru",
    genre: "prophetic_indictment",
    expected_richness: "rich",
    existing_coverage_mode: "empty_existing_cards",

    verse_text_ru:
      "Они каждый день ищут Меня и хотят знать пути Мои, как бы народ, поступающий праведно и не оставляющий законов Бога своего; они вопрошают Меня о судах правды, желают приближения к Богу.",

    passage_text_ru: [
      "1. Взывай громко, не удерживайся; возвысь голос твой, подобно трубе, и укажи народу Моему на беззакония его, и дому Иакова — на грехи его.",
      "2. Они каждый день ищут Меня и хотят знать пути Мои, как бы народ, поступающий праведно и не оставляющий законов Бога своего; они вопрошают Меня о судах правды, желают приближения к Богу.",
      "3. Почему мы постимся, а Ты не видишь? смиряем души свои, а Ты не знаешь?",
    ].join("\n"),

    diagnostic_reason:
      "Prophetic/rhetorical case with irony, contrast, and religious language used as part of an indictment.",

    expected_behavior_note:
      "Should produce strong rhetorical signals, but Verifier may need to watch for overclaim and irony misreading.",
  },
  {
    id: "first_timothy_4_12",
    reference: "1 Timothy 4:12",
    canonical_ref: "1 Timothy 4:12",
    passage_id: "1tim_4_11-13",
    primary_lang: "ru",
    genre: "pastoral_instruction",
    expected_richness: "medium",
    existing_coverage_mode: "empty_existing_cards",

    verse_text_ru:
      "Никто да не пренебрегает юностью твоею; но будь образцом для верных в слове, в житии, в любви, в духе, в вере, в чистоте.",

    passage_text_ru: [
      "11. Проповедуй сие и учи.",
      "12. Никто да не пренебрегает юностью твоею; но будь образцом для верных в слове, в житии, в любви, в духе, в вере, в чистоте.",
      "13. Доколе не приду, занимайся чтением, наставлением, учением.",
    ].join("\n"),

    diagnostic_reason:
      "Pastoral/didactic case. Useful for testing whether detector finds structure rather than generic moral advice.",

    expected_behavior_note:
      "Should produce 1-3 signals. Good signals should notice argument structure or list logic, not generic encouragement.",
  },
  {
    id: "genesis_22_8",
    reference: "Genesis 22:8",
    canonical_ref: "Genesis 22:8",
    passage_id: "gen_22_6-8",
    primary_lang: "ru",
    genre: "narrative",
    expected_richness: "medium",
    existing_coverage_mode: "empty_existing_cards",

    verse_text_ru:
      "Авраам сказал: Бог усмотрит Себе агнца для всесожжения, сын мой. И шли оба вместе.",

    passage_text_ru: [
      "6. И взял Авраам дрова для всесожжения, и возложил на Исаака, сына своего; взял в руки огонь и нож, и пошли оба вместе.",
      "7. И начал Исаак говорить Аврааму, отцу своему, и сказал: отец мой! Он отвечал: вот я, сын мой. Он сказал: вот огонь и дрова, где же агнец для всесожжения?",
      "8. Авраам сказал: Бог усмотрит Себе агнца для всесожжения, сын мой. И шли оба вместе.",
    ].join("\n"),

    diagnostic_reason:
      "Narrative case with dialogue, suspense, repetition, and withheld knowledge.",

    expected_behavior_note:
      "Should produce narrative/discourse signals, but must avoid speculative psychology beyond the text.",
  },
  {
    id: "genesis_5_20",
    reference: "Genesis 5:20",
    canonical_ref: "Genesis 5:20",
    passage_id: "gen_5_18-20",
    primary_lang: "ru",
    genre: "genealogy",
    expected_richness: "low",
    existing_coverage_mode: "empty_existing_cards",

    verse_text_ru:
      "Всех же дней Иареда было девятьсот шестьдесят два года; и он умер.",

    passage_text_ru: [
      "18. Иаред жил сто шестьдесят два года и родил Еноха.",
      "19. По рождении Еноха Иаред жил восемьсот лет и родил сынов и дочерей.",
      "20. Всех же дней Иареда было девятьсот шестьдесят два года; и он умер.",
    ].join("\n"),

    diagnostic_reason:
      "Intentionally low-richness genealogy case. Tests whether the detector can avoid forcing wow-discoveries where the text gives little material.",

    expected_behavior_note:
      "Should produce 0-1 modest signals or possibly no signal. If it produces 3-5 dramatic discoveries, that is a detector quality problem.",
  },
];

export function getDay15VerseFixtureById(
  id: string,
): Day15VerseFixture | null {
  return DAY15_VERSE_FIXTURES.find((fixture) => fixture.id === id) ?? null;
}

export function getDay15VerseFixtureByReference(
  reference: string,
): Day15VerseFixture | null {
  const normalized = reference.trim().toLowerCase();

  return (
    DAY15_VERSE_FIXTURES.find((fixture) => {
      return (
        fixture.reference.toLowerCase() === normalized ||
        fixture.canonical_ref.toLowerCase() === normalized
      );
    }) ?? null
  );
}
