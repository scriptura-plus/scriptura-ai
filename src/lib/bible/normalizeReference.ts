export type NormalizedReference = {
  canonical_ref: string | null;
  book_key: string | null;
  book: string;
  chapter: number;
  verse: number;
};

type BookAlias = {
  key: string;
  aliases: string[];
};

const BOOK_ALIASES: BookAlias[] = [
  {
    key: "genesis",
    aliases: ["genesis", "бытие", "быт", "génesis", "genesis"],
  },
  {
    key: "exodus",
    aliases: ["exodus", "исход", "исх", "éxodo", "exodo"],
  },
  {
    key: "leviticus",
    aliases: ["leviticus", "левит", "лев", "levítico", "levitico"],
  },
  {
    key: "numbers",
    aliases: ["numbers", "числа", "чис", "números", "numeros"],
  },
  {
    key: "deuteronomy",
    aliases: ["deuteronomy", "второзаконие", "втор", "deuteronomio"],
  },
  {
    key: "joshua",
    aliases: ["joshua", "иисус навин", "нав", "josué", "josue"],
  },
  {
    key: "judges",
    aliases: ["judges", "судьи", "суд", "jueces"],
  },
  {
    key: "ruth",
    aliases: ["ruth", "руфь", "руф", "rut"],
  },
  {
    key: "1-samuel",
    aliases: ["1 samuel", "1-samuel", "1 царств", "1 цар", "1 samuel"],
  },
  {
    key: "2-samuel",
    aliases: ["2 samuel", "2-samuel", "2 царств", "2 цар", "2 samuel"],
  },
  {
    key: "1-kings",
    aliases: ["1 kings", "1-kings", "3 царств", "3 цар", "1 reyes"],
  },
  {
    key: "2-kings",
    aliases: ["2 kings", "2-kings", "4 царств", "4 цар", "2 reyes"],
  },
  {
    key: "psalms",
    aliases: ["psalms", "psalm", "псалтирь", "псалом", "пс", "salmos", "salmo"],
  },
  {
    key: "proverbs",
    aliases: ["proverbs", "притчи", "притч", "proverbios"],
  },
  {
    key: "isaiah",
    aliases: ["isaiah", "исайя", "исаия", "ис", "isaías", "isaias"],
  },
  {
    key: "jeremiah",
    aliases: ["jeremiah", "иеремия", "иер", "jeremías", "jeremias"],
  },
  {
    key: "ezekiel",
    aliases: ["ezekiel", "иезекииль", "иез", "ezequiel"],
  },
  {
    key: "daniel",
    aliases: ["daniel", "даниил", "дан", "daniel"],
  },
  {
    key: "hosea",
    aliases: ["hosea", "осия", "ос", "oseas", "osea"],
  },
  {
    key: "matthew",
    aliases: ["matthew", "матфея", "матфей", "мф", "mateo"],
  },
  {
    key: "mark",
    aliases: ["mark", "марка", "марк", "мк", "marcos"],
  },
  {
    key: "luke",
    aliases: ["luke", "луки", "лука", "лк", "lucas"],
  },
  {
    key: "john",
    aliases: ["john", "иоанна", "иоанн", "ин", "juan"],
  },
  {
    key: "acts",
    aliases: ["acts", "деяния", "деян", "hechos"],
  },
  {
    key: "romans",
    aliases: ["romans", "римлянам", "рим", "romanos"],
  },
  {
    key: "1-corinthians",
    aliases: [
      "1 corinthians",
      "1-corinthians",
      "1 коринфянам",
      "1 кор",
      "1 corintios",
    ],
  },
  {
    key: "2-corinthians",
    aliases: [
      "2 corinthians",
      "2-corinthians",
      "2 коринфянам",
      "2 кор",
      "2 corintios",
    ],
  },
  {
    key: "galatians",
    aliases: ["galatians", "галатам", "гал", "gálatas", "galatas"],
  },
  {
    key: "ephesians",
    aliases: ["ephesians", "ефесянам", "еф", "efesios"],
  },
  {
    key: "philippians",
    aliases: ["philippians", "филиппийцам", "флп", "filipenses"],
  },
  {
    key: "colossians",
    aliases: ["colossians", "колоссянам", "кол", "colosenses"],
  },
  {
    key: "1-thessalonians",
    aliases: [
      "1 thessalonians",
      "1-thessalonians",
      "1 фессалоникийцам",
      "1 фес",
      "1 tesalonicenses",
    ],
  },
  {
    key: "2-thessalonians",
    aliases: [
      "2 thessalonians",
      "2-thessalonians",
      "2 фессалоникийцам",
      "2 фес",
      "2 tesalonicenses",
    ],
  },
  {
    key: "1-timothy",
    aliases: ["1 timothy", "1-timothy", "1 тимофею", "1 тим", "1 timoteo"],
  },
  {
    key: "2-timothy",
    aliases: ["2 timothy", "2-timothy", "2 тимофею", "2 тим", "2 timoteo"],
  },
  {
    key: "hebrews",
    aliases: ["hebrews", "евреям", "евр", "hebreos"],
  },
  {
    key: "james",
    aliases: ["james", "иакова", "иак", "santiago"],
  },
  {
    key: "1-peter",
    aliases: ["1 peter", "1-peter", "1 петра", "1 пет", "1 pedro"],
  },
  {
    key: "2-peter",
    aliases: ["2 peter", "2-peter", "2 петра", "2 пет", "2 pedro"],
  },
  {
    key: "revelation",
    aliases: ["revelation", "откровение", "откр", "apocalipsis"],
  },
];

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function findBookKey(book: string): string | null {
  const normalizedBook = normalizeText(book);

  for (const item of BOOK_ALIASES) {
    if (item.aliases.some((alias) => normalizeText(alias) === normalizedBook)) {
      return item.key;
    }
  }

  return null;
}

export function normalizeReference(reference: string): NormalizedReference {
  const trimmed = reference.trim();

  const match = trimmed.match(/^(.+?)\s+(\d+):(\d+)$/);

  if (!match) {
    return {
      canonical_ref: null,
      book_key: null,
      book: trimmed,
      chapter: 0,
      verse: 0,
    };
  }

  const book = match[1].trim();
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const bookKey = findBookKey(book);

  if (!bookKey || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return {
      canonical_ref: null,
      book_key: bookKey,
      book,
      chapter: Number.isFinite(chapter) ? chapter : 0,
      verse: Number.isFinite(verse) ? verse : 0,
    };
  }

  return {
    canonical_ref: `${bookKey}-${chapter}-${verse}`,
    book_key: bookKey,
    book,
    chapter,
    verse,
  };
}
