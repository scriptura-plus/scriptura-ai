export type NormalizedReference = {
  original: string;
  reference: string;
  book_key: string | null;
  canonical_ref: string | null;
  passage_id: string | null;
  book: string | null;
  chapter: number;
  verse: number;
  end_verse: number | null;
};

type BookAliasEntry = {
  key: string;
  aliases: string[];
};

const BOOK_ALIASES: BookAliasEntry[] = [
  {
    key: "genesis",
    aliases: [
      "genesis",
      "gen",
      "ge",
      "бытие",
      "бытия",
      "быт",
      "книга бытия",
    ],
  },
  {
    key: "exodus",
    aliases: [
      "exodus",
      "ex",
      "exo",
      "исход",
      "исхода",
      "исх",
      "книга исход",
      "книга исхода",
    ],
  },
  {
    key: "leviticus",
    aliases: ["leviticus", "lev", "левит", "левита", "лев"],
  },
  {
    key: "numbers",
    aliases: ["numbers", "num", "числа", "чисел", "чис"],
  },
  {
    key: "deuteronomy",
    aliases: [
      "deuteronomy",
      "deut",
      "второзаконие",
      "второзакония",
      "втор",
    ],
  },
  {
    key: "joshua",
    aliases: [
      "joshua",
      "josh",
      "иисус навин",
      "иисуса навина",
      "и навин",
      "навин",
      "навина",
      "нав",
    ],
  },
  {
    key: "judges",
    aliases: ["judges", "judg", "судьи", "судей", "суд"],
  },
  {
    key: "ruth",
    aliases: ["ruth", "рут", "руфь", "руфи", "руф"],
  },
  {
    key: "1-samuel",
    aliases: [
      "1 samuel",
      "1samuel",
      "1 sam",
      "1sam",
      "1-я самуила",
      "1 самуила",
      "1 книга самуила",
      "1-я книга самуила",
      "1 царств",
      "1-я царств",
      "1 книга царств",
      "1-я книга царств",
      "первая самуила",
      "первая книга самуила",
      "первая царств",
      "первая книга царств",
      "1ц",
      "1 ц",
    ],
  },
  {
    key: "2-samuel",
    aliases: [
      "2 samuel",
      "2samuel",
      "2 sam",
      "2sam",
      "2-я самуила",
      "2 самуила",
      "2 книга самуила",
      "2-я книга самуила",
      "2 царств",
      "2-я царств",
      "2 книга царств",
      "2-я книга царств",
      "вторая самуила",
      "вторая книга самуила",
      "вторая царств",
      "вторая книга царств",
      "2ц",
      "2 ц",
    ],
  },
  {
    key: "1-kings",
    aliases: [
      "1 kings",
      "1kings",
      "1 kg",
      "3 царств",
      "3-я царств",
      "3 книга царств",
      "3-я книга царств",
      "1 королей",
      "1-я королей",
      "первая королей",
      "третья царств",
      "третья книга царств",
      "3ц",
      "3 ц",
    ],
  },
  {
    key: "2-kings",
    aliases: [
      "2 kings",
      "2kings",
      "2 kg",
      "4 царств",
      "4-я царств",
      "4 книга царств",
      "4-я книга царств",
      "2 королей",
      "2-я королей",
      "вторая королей",
      "четвертая царств",
      "четвертая книга царств",
      "4ц",
      "4 ц",
    ],
  },
  {
    key: "1-chronicles",
    aliases: [
      "1 chronicles",
      "1chronicles",
      "1 chron",
      "1 паралипоменон",
      "1-я паралипоменон",
      "1 книга паралипоменон",
      "1-я книга паралипоменон",
      "1 летопись",
      "1-я летопись",
      "1 хроник",
      "первая паралипоменон",
      "первая книга паралипоменон",
      "первая летопись",
      "1пар",
      "1 пар",
    ],
  },
  {
    key: "2-chronicles",
    aliases: [
      "2 chronicles",
      "2chronicles",
      "2 chron",
      "2 паралипоменон",
      "2-я паралипоменон",
      "2 книга паралипоменон",
      "2-я книга паралипоменон",
      "2 летопись",
      "2-я летопись",
      "2 хроник",
      "вторая паралипоменон",
      "вторая книга паралипоменон",
      "вторая летопись",
      "2пар",
      "2 пар",
    ],
  },
  {
    key: "ezra",
    aliases: ["ezra", "ездра", "ездры", "езд"],
  },
  {
    key: "nehemiah",
    aliases: ["nehemiah", "neh", "неемия", "неемии", "неем"],
  },
  {
    key: "esther",
    aliases: ["esther", "esth", "есфирь", "есфири", "есф"],
  },
  {
    key: "job",
    aliases: ["job", "иов", "иова"],
  },
  {
    key: "psalms",
    aliases: [
      "psalms",
      "psalm",
      "ps",
      "псалтирь",
      "псалом",
      "псалмы",
      "псалма",
      "пс",
    ],
  },
  {
    key: "proverbs",
    aliases: ["proverbs", "prov", "притчи", "притчей", "притча", "прит"],
  },
  {
    key: "ecclesiastes",
    aliases: [
      "ecclesiastes",
      "eccl",
      "екклесиаст",
      "екклесиаста",
      "экклезиаст",
      "экклезиаста",
      "еккл",
    ],
  },
  {
    key: "song-of-songs",
    aliases: [
      "song of songs",
      "song of solomon",
      "song",
      "песнь песней",
      "песни песней",
      "песнь",
      "песни",
      "песн",
    ],
  },
  {
    key: "isaiah",
    aliases: ["isaiah", "isa", "исаия", "исайя", "исаии", "исайи", "ис"],
  },
  {
    key: "jeremiah",
    aliases: ["jeremiah", "jer", "иеремия", "иеремии", "иер"],
  },
  {
    key: "lamentations",
    aliases: [
      "lamentations",
      "lam",
      "плач иеремии",
      "плач",
    ],
  },
  {
    key: "ezekiel",
    aliases: [
      "ezekiel",
      "ezek",
      "иезекииль",
      "иезекииля",
      "езекииль",
      "езекииля",
      "иез",
    ],
  },
  {
    key: "daniel",
    aliases: ["daniel", "dan", "даниил", "даниила", "дан"],
  },
  {
    key: "hosea",
    aliases: ["hosea", "hos", "осия", "осии", "ос"],
  },
  {
    key: "joel",
    aliases: ["joel", "иоиль", "иоиля", "иол"],
  },
  {
    key: "amos",
    aliases: ["amos", "амос", "амоса", "ам"],
  },
  {
    key: "obadiah",
    aliases: ["obadiah", "obad", "авдий", "авдия", "авд"],
  },
  {
    key: "jonah",
    aliases: ["jonah", "jon", "иона", "ионы", "ион"],
  },
  {
    key: "micah",
    aliases: ["micah", "mic", "михей", "михея", "мих"],
  },
  {
    key: "nahum",
    aliases: ["nahum", "nah", "наум", "наума"],
  },
  {
    key: "habakkuk",
    aliases: ["habakkuk", "hab", "аввакум", "аввакума", "авв"],
  },
  {
    key: "zephaniah",
    aliases: ["zephaniah", "zeph", "софония", "софонии", "соф"],
  },
  {
    key: "haggai",
    aliases: ["haggai", "hag", "аггей", "аггея", "агг"],
  },
  {
    key: "zechariah",
    aliases: ["zechariah", "zech", "захария", "захарии", "зах"],
  },
  {
    key: "malachi",
    aliases: ["malachi", "mal", "малахия", "малахии", "мал"],
  },

  {
    key: "matthew",
    aliases: [
      "matthew",
      "matt",
      "матфея",
      "матфей",
      "евангелие от матфея",
      "от матфея",
      "мат",
    ],
  },
  {
    key: "mark",
    aliases: [
      "mark",
      "mk",
      "марка",
      "марк",
      "евангелие от марка",
      "от марка",
      "мар",
    ],
  },
  {
    key: "luke",
    aliases: [
      "luke",
      "lk",
      "луки",
      "лука",
      "евангелие от луки",
      "от луки",
      "лук",
    ],
  },
  {
    key: "john",
    aliases: [
      "john",
      "jn",
      "иоанна",
      "иоанн",
      "евангелие от иоанна",
      "от иоанна",
      "ин",
    ],
  },
  {
    key: "acts",
    aliases: [
      "acts",
      "acts of apostles",
      "деяния",
      "деяний",
      "деяния апостолов",
      "деян",
    ],
  },
  {
    key: "romans",
    aliases: ["romans", "rom", "римлянам", "рим", "к римлянам"],
  },
  {
    key: "1-corinthians",
    aliases: [
      "1 corinthians",
      "1corinthians",
      "1 cor",
      "1 коринфянам",
      "1-е коринфянам",
      "1 послание коринфянам",
      "1-е послание коринфянам",
      "первое коринфянам",
      "первое послание коринфянам",
      "1 кор",
      "1кор",
    ],
  },
  {
    key: "2-corinthians",
    aliases: [
      "2 corinthians",
      "2corinthians",
      "2 cor",
      "2 коринфянам",
      "2-е коринфянам",
      "2 послание коринфянам",
      "2-е послание коринфянам",
      "второе коринфянам",
      "второе послание коринфянам",
      "2 кор",
      "2кор",
    ],
  },
  {
    key: "galatians",
    aliases: ["galatians", "gal", "галатам", "гал", "к галатам"],
  },
  {
    key: "ephesians",
    aliases: ["ephesians", "eph", "ефесянам", "еф", "к ефесянам"],
  },
  {
    key: "philippians",
    aliases: [
      "philippians",
      "phil",
      "филиппийцам",
      "филиппийцам",
      "флп",
      "к филиппийцам",
    ],
  },
  {
    key: "colossians",
    aliases: [
      "colossians",
      "col",
      "колоссянам",
      "кол",
      "к колоссянам",
    ],
  },
  {
    key: "1-thessalonians",
    aliases: [
      "1 thessalonians",
      "1thessalonians",
      "1 thess",
      "1 фессалоникийцам",
      "1-е фессалоникийцам",
      "1 фес",
      "1фес",
      "первое фессалоникийцам",
      "первое послание фессалоникийцам",
    ],
  },
  {
    key: "2-thessalonians",
    aliases: [
      "2 thessalonians",
      "2thessalonians",
      "2 thess",
      "2 фессалоникийцам",
      "2-е фессалоникийцам",
      "2 фес",
      "2фес",
      "второе фессалоникийцам",
      "второе послание фессалоникийцам",
    ],
  },
  {
    key: "1-timothy",
    aliases: [
      "1 timothy",
      "1timothy",
      "1 tim",
      "1 тимофею",
      "1-е тимофею",
      "1 тим",
      "1тим",
      "первое тимофею",
      "первое послание тимофею",
    ],
  },
  {
    key: "2-timothy",
    aliases: [
      "2 timothy",
      "2timothy",
      "2 tim",
      "2 тимофею",
      "2-е тимофею",
      "2 тим",
      "2тим",
      "второе тимофею",
      "второе послание тимофею",
    ],
  },
  {
    key: "titus",
    aliases: ["titus", "tit", "титу", "тит"],
  },
  {
    key: "philemon",
    aliases: ["philemon", "philem", "филимону", "флм"],
  },
  {
    key: "hebrews",
    aliases: ["hebrews", "heb", "евреям", "евр", "к евреям"],
  },
  {
    key: "james",
    aliases: ["james", "jas", "иакова", "иаков", "иак"],
  },
  {
    key: "1-peter",
    aliases: [
      "1 peter",
      "1peter",
      "1 pet",
      "1 петра",
      "1-е петра",
      "1 пет",
      "1пет",
      "первое петра",
      "первое послание петра",
    ],
  },
  {
    key: "2-peter",
    aliases: [
      "2 peter",
      "2peter",
      "2 pet",
      "2 петра",
      "2-е петра",
      "2 пет",
      "2пет",
      "второе петра",
      "второе послание петра",
    ],
  },
  {
    key: "1-john",
    aliases: [
      "1 john",
      "1john",
      "1 jn",
      "1 иоанна",
      "1-е иоанна",
      "1 ин",
      "1ин",
      "первое иоанна",
      "первое послание иоанна",
    ],
  },
  {
    key: "2-john",
    aliases: [
      "2 john",
      "2john",
      "2 jn",
      "2 иоанна",
      "2-е иоанна",
      "2 ин",
      "2ин",
      "второе иоанна",
      "второе послание иоанна",
    ],
  },
  {
    key: "3-john",
    aliases: [
      "3 john",
      "3john",
      "3 jn",
      "3 иоанна",
      "3-е иоанна",
      "3 ин",
      "3ин",
      "третье иоанна",
      "третье послание иоанна",
    ],
  },
  {
    key: "jude",
    aliases: ["jude", "jud", "иуды", "иуда", "иуд"],
  },
  {
    key: "revelation",
    aliases: [
      "revelation",
      "rev",
      "apocalypse",
      "откровение",
      "откровения",
      "откровение иоанна",
      "апокалипсис",
      "откр",
    ],
  },
];

const ALIAS_TO_BOOK_KEY = createAliasMap(BOOK_ALIASES);

function createAliasMap(entries: BookAliasEntry[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const entry of entries) {
    map.set(normalizeBookName(entry.key), entry.key);

    for (const alias of entry.aliases) {
      map.set(normalizeBookName(alias), entry.key);
    }
  }

  return map;
}

function normalizeBookName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—]/g, "-")
    .replace(/\./g, "")
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^к\s+/, "")
    .replace(/^ко\s+/, "")
    .replace(/^от\s+/, "")
    .replace(/^из\s+/, "")
    .replace(/^пророка\s+/, "")
    .replace(/^книга\s+/, "")
    .replace(/^послание\s+/, "")
    .replace(/^евангелие\s+от\s+/, "")
    .replace(/^первое\s+/, "1 ")
    .replace(/^первая\s+/, "1 ")
    .replace(/^первый\s+/, "1 ")
    .replace(/^второе\s+/, "2 ")
    .replace(/^вторая\s+/, "2 ")
    .replace(/^второй\s+/, "2 ")
    .replace(/^третье\s+/, "3 ")
    .replace(/^третья\s+/, "3 ")
    .replace(/^третий\s+/, "3 ")
    .replace(/^четвертое\s+/, "4 ")
    .replace(/^четвертая\s+/, "4 ")
    .replace(/^четвертый\s+/, "4 ")
    .replace(/^([1-4])\s*[-–—]?\s*(?:я|е|й|ая|ое)?\s+/, "$1 ")
    .replace(/^([1-4])\s*[-–—]?\s*(?:я|е|й|ая|ое)?(?=[а-яa-z])/, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReferenceInput(value: string): string {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[;,]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function parseReferenceParts(reference: string): {
  rawBook: string;
  chapter: number;
  verse: number | null;
  endVerse: number | null;
} | null {
  const normalized = normalizeReferenceInput(reference);

  // Examples:
  // - "Михея 6:8"
  // - "Псалом 22:1"
  // - "1 Паралипоменон 25:25"
  // - "John 17.3"
  // - "Matthew 11:28-30"
  const match = normalized.match(/^(.+?)\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?)?$/);

  if (!match) return null;

  const rawBook = match[1]?.trim() ?? "";
  const chapter = Number(match[2]);
  const verse = match[3] ? Number(match[3]) : null;
  const endVerse = match[4] ? Number(match[4]) : null;

  if (!rawBook || !Number.isFinite(chapter) || chapter <= 0) {
    return null;
  }

  if (verse !== null && (!Number.isFinite(verse) || verse <= 0)) {
    return null;
  }

  if (endVerse !== null && (!Number.isFinite(endVerse) || endVerse <= 0)) {
    return null;
  }

  return {
    rawBook,
    chapter,
    verse,
    endVerse,
  };
}

function resolveBookKey(rawBook: string): string | null {
  const normalized = normalizeBookName(rawBook);

  const direct = ALIAS_TO_BOOK_KEY.get(normalized);
  if (direct) return direct;

  const compact = normalized.replace(/\s+/g, "");
  const compactMatch = ALIAS_TO_BOOK_KEY.get(compact);
  if (compactMatch) return compactMatch;

  return null;
}

function makeCanonicalRef(args: {
  bookKey: string | null;
  rawBook: string;
  chapter: number;
  verse: number | null;
  endVerse: number | null;
}): string | null {
  if (!args.chapter) return null;

  const book = args.bookKey ?? slugify(args.rawBook);

  if (!book) return null;

  if (!args.verse) return `${book}-${args.chapter}`;

  if (args.endVerse && args.endVerse !== args.verse) {
    return `${book}-${args.chapter}-${args.verse}-${args.endVerse}`;
  }

  return `${book}-${args.chapter}-${args.verse}`;
}

function makePassageId(canonicalRef: string | null): string | null {
  if (!canonicalRef) return null;
  return canonicalRef.replace(/-/g, "_");
}

export function normalizeReference(reference: string): NormalizedReference {
  const original = reference;
  const trimmed = reference.trim();

  if (!trimmed) {
    return {
      original,
      reference: "",
      book_key: null,
      canonical_ref: null,
      passage_id: null,
      book: null,
      chapter: 0,
      verse: 0,
      end_verse: null,
    };
  }

  const parsed = parseReferenceParts(trimmed);

  if (!parsed) {
    const fallback = slugify(trimmed) || null;

    return {
      original,
      reference: trimmed,
      book_key: null,
      canonical_ref: fallback,
      passage_id: makePassageId(fallback),
      book: null,
      chapter: 0,
      verse: 0,
      end_verse: null,
    };
  }

  const bookKey = resolveBookKey(parsed.rawBook);
  const canonicalRef = makeCanonicalRef({
    bookKey,
    rawBook: parsed.rawBook,
    chapter: parsed.chapter,
    verse: parsed.verse,
    endVerse: parsed.endVerse,
  });

  return {
    original,
    reference: trimmed,
    book_key: bookKey,
    canonical_ref: canonicalRef,
    passage_id: makePassageId(canonicalRef),
    book: bookKey ?? parsed.rawBook,
    chapter: parsed.chapter,
    verse: parsed.verse ?? 0,
    end_verse: parsed.endVerse,
  };
}

export default normalizeReference;
