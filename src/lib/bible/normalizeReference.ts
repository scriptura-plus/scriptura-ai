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
  // Hebrew Scriptures / Old Testament
  {
    key: "genesis",
    aliases: ["genesis", "gen", "ge", "gn", "бытие", "быт", "гн", "génesis", "genesis", "gn"],
  },
  {
    key: "exodus",
    aliases: ["exodus", "exo", "ex", "исход", "исх", "éxodo", "exodo", "éx"],
  },
  {
    key: "leviticus",
    aliases: ["leviticus", "lev", "le", "левит", "лев", "levítico", "levitico", "lv"],
  },
  {
    key: "numbers",
    aliases: ["numbers", "num", "nu", "числа", "чис", "números", "numeros", "nm"],
  },
  {
    key: "deuteronomy",
    aliases: ["deuteronomy", "deut", "dt", "второзаконие", "втор", "deuteronomio"],
  },
  {
    key: "joshua",
    aliases: ["joshua", "josh", "jos", "иисус навин", "нав", "josué", "josue"],
  },
  {
    key: "judges",
    aliases: ["judges", "judg", "jg", "судьи", "суд", "jueces", "jue"],
  },
  {
    key: "ruth",
    aliases: ["ruth", "ru", "рут", "руфь", "руф", "rut"],
  },
  {
    key: "1-samuel",
    aliases: [
      "1 samuel",
      "1samuel",
      "1-samuel",
      "1 sam",
      "1sam",
      "1-я царств",
      "1 я царств",
      "1 царств",
      "1 цар",
      "1 samuel",
    ],
  },
  {
    key: "2-samuel",
    aliases: [
      "2 samuel",
      "2samuel",
      "2-samuel",
      "2 sam",
      "2sam",
      "2-я царств",
      "2 я царств",
      "2 царств",
      "2 цар",
      "2 samuel",
    ],
  },
  {
    key: "1-kings",
    aliases: [
      "1 kings",
      "1kings",
      "1-kings",
      "1 ki",
      "1ki",
      "3-я царств",
      "3 я царств",
      "3 царств",
      "3 цар",
      "1 reyes",
    ],
  },
  {
    key: "2-kings",
    aliases: [
      "2 kings",
      "2kings",
      "2-kings",
      "2 ki",
      "2ki",
      "4-я царств",
      "4 я царств",
      "4 царств",
      "4 цар",
      "2 reyes",
    ],
  },
  {
    key: "1-chronicles",
    aliases: [
      "1 chronicles",
      "1chronicles",
      "1-chronicles",
      "1 chr",
      "1chr",
      "1-я паралипоменон",
      "1 я паралипоменон",
      "1 паралипоменон",
      "1 пар",
      "1 crónicas",
      "1 cronicas",
    ],
  },
  {
    key: "2-chronicles",
    aliases: [
      "2 chronicles",
      "2chronicles",
      "2-chronicles",
      "2 chr",
      "2chr",
      "2-я паралипоменон",
      "2 я паралипоменон",
      "2 паралипоменон",
      "2 пар",
      "2 crónicas",
      "2 cronicas",
    ],
  },
  {
    key: "ezra",
    aliases: ["ezra", "ezr", "ездра", "езд", "esdras", "esd"],
  },
  {
    key: "nehemiah",
    aliases: ["nehemiah", "neh", "неемия", "неем", "nehemías", "nehemias"],
  },
  {
    key: "esther",
    aliases: ["esther", "est", "есфирь", "есф", "ester"],
  },
  {
    key: "job",
    aliases: ["job", "jb", "иов"],
  },
  {
    key: "psalms",
    aliases: ["psalms", "psalm", "ps", "psa", "псалтирь", "псалом", "пс", "salmos", "salmo", "sl"],
  },
  {
    key: "proverbs",
    aliases: ["proverbs", "prov", "pr", "притчи", "притч", "пр", "proverbios", "prv"],
  },
  {
    key: "ecclesiastes",
    aliases: ["ecclesiastes", "eccl", "ecc", "экклезиаст", "екклесиаст", "еккл", "eclesiastés", "eclesiastes"],
  },
  {
    key: "song-of-solomon",
    aliases: [
      "song of solomon",
      "song-of-solomon",
      "song",
      "songs",
      "song of songs",
      "песнь песней",
      "песн",
      "cantar de los cantares",
      "cantares",
    ],
  },
  {
    key: "isaiah",
    aliases: ["isaiah", "isa", "is", "исайя", "исаия", "ис", "isaías", "isaias"],
  },
  {
    key: "jeremiah",
    aliases: ["jeremiah", "jer", "jr", "иеремия", "иер", "jeremías", "jeremias"],
  },
  {
    key: "lamentations",
    aliases: ["lamentations", "lam", "плач иеремии", "плач", "lamentaciones", "lm"],
  },
  {
    key: "ezekiel",
    aliases: ["ezekiel", "ezek", "eze", "иезекииль", "иез", "ezequiel", "ez"],
  },
  {
    key: "daniel",
    aliases: ["daniel", "dan", "dn", "даниил", "дан"],
  },
  {
    key: "hosea",
    aliases: ["hosea", "hos", "осия", "ос", "oseas", "osea"],
  },
  {
    key: "joel",
    aliases: ["joel", "jl", "иоиль", "иоил"],
  },
  {
    key: "amos",
    aliases: ["amos", "am", "амос", "ам", "amós"],
  },
  {
    key: "obadiah",
    aliases: ["obadiah", "obad", "ob", "авдий", "авд", "abdías", "abdias"],
  },
  {
    key: "jonah",
    aliases: ["jonah", "jon", "иона", "ион", "jonás", "jonas"],
  },
  {
    key: "micah",
    aliases: ["micah", "mic", "михей", "мих", "miqueas", "miq"],
  },
  {
    key: "nahum",
    aliases: ["nahum", "nah", "наум", "naúm", "naum"],
  },
  {
    key: "habakkuk",
    aliases: ["habakkuk", "hab", "аввакум", "авв", "habacuc"],
  },
  {
    key: "zephaniah",
    aliases: ["zephaniah", "zeph", "софония", "соф", "sofonías", "sofonias"],
  },
  {
    key: "haggai",
    aliases: ["haggai", "hag", "аггей", "агг", "hageo"],
  },
  {
    key: "zechariah",
    aliases: ["zechariah", "zech", "zec", "захария", "зах", "zacarías", "zacarias"],
  },
  {
    key: "malachi",
    aliases: ["malachi", "mal", "малахия", "мал", "malaquías", "malaquias"],
  },

  // Christian Greek Scriptures / New Testament
  {
    key: "matthew",
    aliases: ["matthew", "matt", "mt", "матфея", "матфей", "мф", "mateo"],
  },
  {
    key: "mark",
    aliases: ["mark", "mk", "mrk", "марка", "марк", "мк", "marcos"],
  },
  {
    key: "luke",
    aliases: ["luke", "lk", "луки", "лука", "лк", "lucas"],
  },
  {
    key: "john",
    aliases: ["john", "jn", "jhn", "иоанна", "иоанн", "ин", "juan"],
  },
  {
    key: "acts",
    aliases: ["acts", "act", "ac", "деяния", "деян", "дн", "hechos"],
  },
  {
    key: "romans",
    aliases: ["romans", "rom", "ro", "римлянам", "рим", "romanos"],
  },
  {
    key: "1-corinthians",
    aliases: [
      "1 corinthians",
      "1corinthians",
      "1-corinthians",
      "1 cor",
      "1cor",
      "1-е коринфянам",
      "1 е коринфянам",
      "1 коринфянам",
      "1 кор",
      "1 corintios",
    ],
  },
  {
    key: "2-corinthians",
    aliases: [
      "2 corinthians",
      "2corinthians",
      "2-corinthians",
      "2 cor",
      "2cor",
      "2-е коринфянам",
      "2 е коринфянам",
      "2 коринфянам",
      "2 кор",
      "2 corintios",
    ],
  },
  {
    key: "galatians",
    aliases: ["galatians", "gal", "галатам", "гал", "gálatas", "galatas"],
  },
  {
    key: "ephesians",
    aliases: ["ephesians", "eph", "ефесянам", "еф", "efesios"],
  },
  {
    key: "philippians",
    aliases: ["philippians", "phil", "php", "филиппийцам", "филип", "флп", "filipenses"],
  },
  {
    key: "colossians",
    aliases: ["colossians", "col", "колоссянам", "кол", "colosenses"],
  },
  {
    key: "1-thessalonians",
    aliases: [
      "1 thessalonians",
      "1thessalonians",
      "1-thessalonians",
      "1 thess",
      "1thess",
      "1-е фессалоникийцам",
      "1 е фессалоникийцам",
      "1 фессалоникийцам",
      "1 фес",
      "1 tesalonicenses",
    ],
  },
  {
    key: "2-thessalonians",
    aliases: [
      "2 thessalonians",
      "2thessalonians",
      "2-thessalonians",
      "2 thess",
      "2thess",
      "2-е фессалоникийцам",
      "2 е фессалоникийцам",
      "2 фессалоникийцам",
      "2 фес",
      "2 tesalonicenses",
    ],
  },
  {
    key: "1-timothy",
    aliases: [
      "1 timothy",
      "1timothy",
      "1-timothy",
      "1 tim",
      "1tim",
      "1-е тимофею",
      "1 е тимофею",
      "1 тимофею",
      "1 тим",
      "1 timoteo",
    ],
  },
  {
    key: "2-timothy",
    aliases: [
      "2 timothy",
      "2timothy",
      "2-timothy",
      "2 tim",
      "2tim",
      "2-е тимофею",
      "2 е тимофею",
      "2 тимофею",
      "2 тим",
      "2 timoteo",
    ],
  },
  {
    key: "titus",
    aliases: ["titus", "tit", "титу", "тит", "tito"],
  },
  {
    key: "philemon",
    aliases: ["philemon", "phlm", "phm", "филимону", "флм", "filemón", "filemon"],
  },
  {
    key: "hebrews",
    aliases: ["hebrews", "heb", "евреям", "евр", "hebreos"],
  },
  {
    key: "james",
    aliases: ["james", "jas", "jm", "иакова", "иак", "santiago"],
  },
  {
    key: "1-peter",
    aliases: [
      "1 peter",
      "1peter",
      "1-peter",
      "1 pet",
      "1pet",
      "1-е петра",
      "1 е петра",
      "1 петра",
      "1 пет",
      "1 pedro",
    ],
  },
  {
    key: "2-peter",
    aliases: [
      "2 peter",
      "2peter",
      "2-peter",
      "2 pet",
      "2pet",
      "2-е петра",
      "2 е петра",
      "2 петра",
      "2 пет",
      "2 pedro",
    ],
  },
  {
    key: "1-john",
    aliases: [
      "1 john",
      "1john",
      "1-john",
      "1 jn",
      "1jn",
      "1-е иоанна",
      "1 е иоанна",
      "1 иоанна",
      "1 ин",
      "1 juan",
    ],
  },
  {
    key: "2-john",
    aliases: [
      "2 john",
      "2john",
      "2-john",
      "2 jn",
      "2jn",
      "2-е иоанна",
      "2 е иоанна",
      "2 иоанна",
      "2 ин",
      "2 juan",
    ],
  },
  {
    key: "3-john",
    aliases: [
      "3 john",
      "3john",
      "3-john",
      "3 jn",
      "3jn",
      "3-е иоанна",
      "3 е иоанна",
      "3 иоанна",
      "3 ин",
      "3 juan",
    ],
  },
  {
    key: "jude",
    aliases: ["jude", "jud", "иуды", "иуда", "иуд", "judas"],
  },
  {
    key: "revelation",
    aliases: ["revelation", "rev", "re", "откровение", "откр", "апокалипсис", "apocalipsis"],
  },
];

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

function normalizeBookText(value: string): string {
  return normalizeText(value)
    .replace(/^i\s+/i, "1 ")
    .replace(/^ii\s+/i, "2 ")
    .replace(/^iii\s+/i, "3 ")
    .replace(/^1-я\s+/i, "1 ")
    .replace(/^2-я\s+/i, "2 ")
    .replace(/^3-я\s+/i, "3 ")
    .replace(/^1-е\s+/i, "1 ")
    .replace(/^2-е\s+/i, "2 ")
    .replace(/^3-е\s+/i, "3 ")
    .replace(/^1\s+я\s+/i, "1 ")
    .replace(/^2\s+я\s+/i, "2 ")
    .replace(/^3\s+я\s+/i, "3 ")
    .replace(/^1\s+е\s+/i, "1 ")
    .replace(/^2\s+е\s+/i, "2 ")
    .replace(/^3\s+е\s+/i, "3 ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBookKey(book: string): string | null {
  const normalizedBook = normalizeBookText(book);

  for (const item of BOOK_ALIASES) {
    if (item.aliases.some((alias) => normalizeBookText(alias) === normalizedBook)) {
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
