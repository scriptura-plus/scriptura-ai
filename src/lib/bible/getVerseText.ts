import { runAI } from "../ai/runAI";
import type { Provider } from "../ai/providers";
import type { Lang } from "../i18n/dictionary";
import rstjBibleData from "./data/ru-rstj.json";

export type VerseResult = { reference: string; text: string };
export type ChapterResult = { reference: string; text: string };

type RstjBookData = {
  index: number;
  sourceBookNumber: number;
  shortName: string;
  longName: string;
  chapters: Record<string, Record<string, string>>;
};

type RstjBibleData = {
  metadata: {
    code: string;
    lang: string;
    name: string;
    englishName: string;
    source: string;
    note: string;
    totalVerses?: number;
    yahwehVerseCount?: number;
    bookIndex?: Record<string, string>;
  };
  books: Record<string, RstjBookData>;
};

type ParsedReference = {
  original: string;
  bookKey: string;
  chapter: number;
  verse?: number;
};

const LOCAL_RU_BIBLE = rstjBibleData as RstjBibleData;

const TRANSLATION_LABEL: Record<Lang, string> = {
  en: "English Standard Version (ESV)",
  ru: "Russian Synodal Bible (Yahweh Edition, RSTJ 1876)",
  es: "Reina-Valera 1960",
};

const BOOK_ALIASES: Record<string, string> = {
  // Pentateuch
  "genesis": "genesis",
  "ge": "genesis",
  "gen": "genesis",
  "бытие": "genesis",
  "быт": "genesis",
  "быт.": "genesis",

  "exodus": "exodus",
  "ex": "exodus",
  "exo": "exodus",
  "исход": "exodus",
  "исх": "exodus",
  "исх.": "exodus",

  "leviticus": "leviticus",
  "lev": "leviticus",
  "левит": "leviticus",
  "лев": "leviticus",
  "лев.": "leviticus",

  "numbers": "numbers",
  "num": "numbers",
  "числа": "numbers",
  "чис": "numbers",
  "чис.": "numbers",

  "deuteronomy": "deuteronomy",
  "deut": "deuteronomy",
  "второзаконие": "deuteronomy",
  "втор": "deuteronomy",
  "втор.": "deuteronomy",

  // Historical books
  "joshua": "joshua",
  "josh": "joshua",
  "иисус навин": "joshua",
  "иисус навина": "joshua",
  "нав": "joshua",
  "нав.": "joshua",

  "judges": "judges",
  "judg": "judges",
  "судьи": "judges",
  "суд": "judges",
  "суд.": "judges",

  "ruth": "ruth",
  "рут": "ruth",
  "руфь": "ruth",
  "руф": "ruth",
  "руф.": "ruth",

  "1 samuel": "1-samuel",
  "1samuel": "1-samuel",
  "1 sam": "1-samuel",
  "1sam": "1-samuel",
  "1-я самуила": "1-samuel",
  "1 самуила": "1-samuel",
  "1 царств": "1-samuel",
  "1-я царств": "1-samuel",
  "1ц": "1-samuel",
  "1 ц": "1-samuel",

  "2 samuel": "2-samuel",
  "2samuel": "2-samuel",
  "2 sam": "2-samuel",
  "2sam": "2-samuel",
  "2-я самуила": "2-samuel",
  "2 самуила": "2-samuel",
  "2 царств": "2-samuel",
  "2-я царств": "2-samuel",
  "2ц": "2-samuel",
  "2 ц": "2-samuel",

  "1 kings": "1-kings",
  "1kings": "1-kings",
  "1 kg": "1-kings",
  "3 царств": "1-kings",
  "3-я царств": "1-kings",
  "1 королей": "1-kings",
  "1-я королей": "1-kings",
  "3ц": "1-kings",
  "3 ц": "1-kings",

  "2 kings": "2-kings",
  "2kings": "2-kings",
  "2 kg": "2-kings",
  "4 царств": "2-kings",
  "4-я царств": "2-kings",
  "2 королей": "2-kings",
  "2-я королей": "2-kings",
  "4ц": "2-kings",
  "4 ц": "2-kings",

  "1 chronicles": "1-chronicles",
  "1chronicles": "1-chronicles",
  "1 chron": "1-chronicles",
  "1 паралипоменон": "1-chronicles",
  "1-я паралипоменон": "1-chronicles",
  "1 летопись": "1-chronicles",
  "1-я летопись": "1-chronicles",
  "1пар": "1-chronicles",
  "1 пар": "1-chronicles",

  "2 chronicles": "2-chronicles",
  "2chronicles": "2-chronicles",
  "2 chron": "2-chronicles",
  "2 паралипоменон": "2-chronicles",
  "2-я паралипоменон": "2-chronicles",
  "2 летопись": "2-chronicles",
  "2-я летопись": "2-chronicles",
  "2пар": "2-chronicles",
  "2 пар": "2-chronicles",

  "ezra": "ezra",
  "ездра": "ezra",
  "езд": "ezra",
  "езд.": "ezra",

  "nehemiah": "nehemiah",
  "neh": "nehemiah",
  "неемия": "nehemiah",
  "неем": "nehemiah",
  "неем.": "nehemiah",

  "esther": "esther",
  "esth": "esther",
  "есфирь": "esther",
  "есф": "esther",
  "есф.": "esther",

  // Wisdom / poetry
  "job": "job",
  "иов": "job",
  "иов.": "job",

  "psalms": "psalms",
  "psalm": "psalms",
  "ps": "psalms",
  "псалтирь": "psalms",
  "псалом": "psalms",
  "псалмы": "psalms",
  "пс": "psalms",
  "пс.": "psalms",

  "proverbs": "proverbs",
  "prov": "proverbs",
  "притчи": "proverbs",
  "притча": "proverbs",
  "прит": "proverbs",
  "прит.": "proverbs",

  "ecclesiastes": "ecclesiastes",
  "eccl": "ecclesiastes",
  "екклесиаст": "ecclesiastes",
  "экклезиаст": "ecclesiastes",
  "еккл": "ecclesiastes",
  "еккл.": "ecclesiastes",

  "song of songs": "song-of-songs",
  "song of solomon": "song-of-songs",
  "song": "song-of-songs",
  "песнь песней": "song-of-songs",
  "песнь": "song-of-songs",
  "песн": "song-of-songs",
  "песн.": "song-of-songs",

  // Prophets
  "isaiah": "isaiah",
  "isa": "isaiah",
  "исаия": "isaiah",
  "исайя": "isaiah",
  "ис": "isaiah",
  "ис.": "isaiah",

  "jeremiah": "jeremiah",
  "jer": "jeremiah",
  "иеремия": "jeremiah",
  "иер": "jeremiah",
  "иер.": "jeremiah",

  "lamentations": "lamentations",
  "lam": "lamentations",
  "плач иеремии": "lamentations",
  "плач": "lamentations",
  "плач.": "lamentations",

  "ezekiel": "ezekiel",
  "ezek": "ezekiel",
  "иезекииль": "ezekiel",
  "езекииль": "ezekiel",
  "иез": "ezekiel",
  "иез.": "ezekiel",

  "daniel": "daniel",
  "dan": "daniel",
  "даниил": "daniel",
  "дан": "daniel",
  "дан.": "daniel",

  "hosea": "hosea",
  "hos": "hosea",
  "осия": "hosea",
  "ос": "hosea",
  "ос.": "hosea",

  "joel": "joel",
  "иоиль": "joel",
  "иол": "joel",
  "иол.": "joel",

  "amos": "amos",
  "амос": "amos",
  "ам": "amos",
  "ам.": "amos",

  "obadiah": "obadiah",
  "obad": "obadiah",
  "авдий": "obadiah",
  "авд": "obadiah",
  "авд.": "obadiah",

  "jonah": "jonah",
  "jon": "jonah",
  "иона": "jonah",
  "ион": "jonah",
  "ион.": "jonah",

  "micah": "micah",
  "mic": "micah",
  "михей": "micah",
  "мих": "micah",
  "мих.": "micah",

  "nahum": "nahum",
  "nah": "nahum",
  "наум": "nahum",
  "наум.": "nahum",

  "habakkuk": "habakkuk",
  "hab": "habakkuk",
  "аввакум": "habakkuk",
  "авв": "habakkuk",
  "авв.": "habakkuk",

  "zephaniah": "zephaniah",
  "zeph": "zephaniah",
  "софония": "zephaniah",
  "соф": "zephaniah",
  "соф.": "zephaniah",

  "haggai": "haggai",
  "hag": "haggai",
  "аггей": "haggai",
  "агг": "haggai",
  "агг.": "haggai",

  "zechariah": "zechariah",
  "zech": "zechariah",
  "захария": "zechariah",
  "зах": "zechariah",
  "зах.": "zechariah",

  "malachi": "malachi",
  "mal": "malachi",
  "малахия": "malachi",
  "мал": "malachi",
  "мал.": "malachi",

  // New Testament
  "matthew": "matthew",
  "matt": "matthew",
  "матфея": "matthew",
  "от матфея": "matthew",
  "мат": "matthew",
  "мат.": "matthew",

  "mark": "mark",
  "mk": "mark",
  "марка": "mark",
  "от марка": "mark",
  "мар": "mark",
  "мар.": "mark",

  "luke": "luke",
  "lk": "luke",
  "луки": "luke",
  "от луки": "luke",
  "лук": "luke",
  "лук.": "luke",

  "john": "john",
  "jn": "john",
  "иоанна": "john",
  "от иоанна": "john",
  "ин": "john",
  "ин.": "john",

  "acts": "acts",
  "acts of apostles": "acts",
  "деяния": "acts",
  "деяния апостолов": "acts",
  "деян": "acts",
  "деян.": "acts",

  "romans": "romans",
  "rom": "romans",
  "римлянам": "romans",
  "рим": "romans",
  "рим.": "romans",

  "1 corinthians": "1-corinthians",
  "1corinthians": "1-corinthians",
  "1 cor": "1-corinthians",
  "1 коринфянам": "1-corinthians",
  "1-е коринфянам": "1-corinthians",
  "1 кор": "1-corinthians",
  "1кор": "1-corinthians",

  "2 corinthians": "2-corinthians",
  "2corinthians": "2-corinthians",
  "2 cor": "2-corinthians",
  "2 коринфянам": "2-corinthians",
  "2-е коринфянам": "2-corinthians",
  "2 кор": "2-corinthians",
  "2кор": "2-corinthians",

  "galatians": "galatians",
  "gal": "galatians",
  "галатам": "galatians",
  "гал": "galatians",
  "гал.": "galatians",

  "ephesians": "ephesians",
  "eph": "ephesians",
  "ефесянам": "ephesians",
  "еф": "ephesians",
  "еф.": "ephesians",

  "philippians": "philippians",
  "phil": "philippians",
  "филиппийцам": "philippians",
  "флп": "philippians",
  "флп.": "philippians",

  "colossians": "colossians",
  "col": "colossians",
  "колоссянам": "colossians",
  "кол": "colossians",
  "кол.": "colossians",

  "1 thessalonians": "1-thessalonians",
  "1thessalonians": "1-thessalonians",
  "1 thess": "1-thessalonians",
  "1 фессалоникийцам": "1-thessalonians",
  "1-е фессалоникийцам": "1-thessalonians",
  "1 фес": "1-thessalonians",
  "1фес": "1-thessalonians",

  "2 thessalonians": "2-thessalonians",
  "2thessalonians": "2-thessalonians",
  "2 thess": "2-thessalonians",
  "2 фессалоникийцам": "2-thessalonians",
  "2-е фессалоникийцам": "2-thessalonians",
  "2 фес": "2-thessalonians",
  "2фес": "2-thessalonians",

  "1 timothy": "1-timothy",
  "1timothy": "1-timothy",
  "1 tim": "1-timothy",
  "1 тимофею": "1-timothy",
  "1-е тимофею": "1-timothy",
  "1 тим": "1-timothy",
  "1тим": "1-timothy",

  "2 timothy": "2-timothy",
  "2timothy": "2-timothy",
  "2 tim": "2-timothy",
  "2 тимофею": "2-timothy",
  "2-е тимофею": "2-timothy",
  "2 тим": "2-timothy",
  "2тим": "2-timothy",

  "titus": "titus",
  "tit": "titus",
  "титу": "titus",
  "тит": "titus",
  "тит.": "titus",

  "philemon": "philemon",
  "philem": "philemon",
  "филимону": "philemon",
  "флм": "philemon",
  "флм.": "philemon",

  "hebrews": "hebrews",
  "heb": "hebrews",
  "евреям": "hebrews",
  "евр": "hebrews",
  "евр.": "hebrews",

  "james": "james",
  "jas": "james",
  "иакова": "james",
  "иак": "james",
  "иак.": "james",

  "1 peter": "1-peter",
  "1peter": "1-peter",
  "1 pet": "1-peter",
  "1 петра": "1-peter",
  "1-е петра": "1-peter",
  "1 пет": "1-peter",
  "1пет": "1-peter",

  "2 peter": "2-peter",
  "2peter": "2-peter",
  "2 pet": "2-peter",
  "2 петра": "2-peter",
  "2-е петра": "2-peter",
  "2 пет": "2-peter",
  "2пет": "2-peter",

  "1 john": "1-john",
  "1john": "1-john",
  "1 jn": "1-john",
  "1 иоанна": "1-john",
  "1-е иоанна": "1-john",
  "1 ин": "1-john",
  "1ин": "1-john",

  "2 john": "2-john",
  "2john": "2-john",
  "2 jn": "2-john",
  "2 иоанна": "2-john",
  "2-е иоанна": "2-john",
  "2 ин": "2-john",
  "2ин": "2-john",

  "3 john": "3-john",
  "3john": "3-john",
  "3 jn": "3-john",
  "3 иоанна": "3-john",
  "3-е иоанна": "3-john",
  "3 ин": "3-john",
  "3ин": "3-john",

  "jude": "jude",
  "jud": "jude",
  "иуды": "jude",
  "иуд": "jude",
  "иуд.": "jude",

  "revelation": "revelation",
  "rev": "revelation",
  "apocalypse": "revelation",
  "откровение": "revelation",
  "откровение иоанна": "revelation",
  "апокалипсис": "revelation",
  "откр": "revelation",
  "откр.": "revelation",
};

/**
 * Returns the biblical text for a verse reference.
 *
 * Primary source for Russian:
 * local JSON file at src/lib/bible/data/ru-rstj.json
 * containing RSTJ 1876 — Russian Synodal Bible (Yahweh Edition).
 *
 * Fallback:
 * AI-generated text from the requested translation label.
 */
export async function getVerseText(
  reference: string,
  lang: Lang,
  provider: Provider,
): Promise<VerseResult> {
  if (lang === "ru") {
    const local = getLocalRussianVerse(reference);

    if (local) {
      return local;
    }

    console.warn("[BIBLE] Local RSTJ verse not found; falling back to AI", {
      reference,
      lang,
    });
  }

  return getVerseTextFromAI(reference, lang, provider);
}

/**
 * Returns the whole biblical chapter for a verse reference.
 *
 * Primary source for Russian:
 * local JSON file at src/lib/bible/data/ru-rstj.json.
 *
 * Fallback:
 * AI-generated chapter text from the requested translation label.
 */
export async function getChapterText(
  reference: string,
  lang: Lang,
  provider: Provider,
): Promise<ChapterResult> {
  if (lang === "ru") {
    const local = getLocalRussianChapter(reference);

    if (local) {
      return local;
    }

    console.warn("[BIBLE] Local RSTJ chapter not found; falling back to AI", {
      reference,
      lang,
    });
  }

  return getChapterTextFromAI(reference, lang, provider);
}

async function getVerseTextFromAI(
  reference: string,
  lang: Lang,
  provider: Provider,
): Promise<VerseResult> {
  const translation = TRANSLATION_LABEL[lang];

  const prompt =
    `Return the exact biblical text of "${reference}" from the ${translation}. ` +
    `The verse text content MUST be in the language of that translation. ` +
    `JSON key names must ALWAYS be in English — do not translate key names. ` +
    `Output JSON only, with this exact shape: {"reference": "...", "text": "..."}. ` +
    `No commentary. No markdown. No extra keys. No prose around the JSON.`;

  const raw = await runAI(provider, prompt, lang, true);
  const parsed = extractVerseJson(raw);

  if (parsed && typeof parsed.text === "string" && parsed.text.trim().length > 0) {
    return {
      reference:
        typeof parsed.reference === "string" && parsed.reference.trim()
          ? parsed.reference.trim()
          : reference,
      text: parsed.text.trim(),
    };
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    throw new Error(
      `Could not extract verse text from AI response. Raw: ${trimmed.slice(0, 120)}`,
    );
  }

  return { reference, text: trimmed };
}

async function getChapterTextFromAI(
  reference: string,
  lang: Lang,
  provider: Provider,
): Promise<ChapterResult> {
  const translation = TRANSLATION_LABEL[lang];
  const chapterReference = getChapterReference(reference);

  const prompt =
    `Return the full biblical chapter that contains "${reference}" from the ${translation}. ` +
    `Return the chapter as numbered verses. ` +
    `The chapter text content MUST be in the language of that translation. ` +
    `Do NOT include commentary, headings, footnotes, introductions, summaries, or explanations. ` +
    `JSON key names must ALWAYS be in English — do not translate key names. ` +
    `Output JSON only, with this exact shape: ` +
    `{"reference": "${chapterReference}", "text": "1. ...\\n2. ...\\n3. ..."}. ` +
    `No markdown. No prose around the JSON.`;

  const raw = await runAI(provider, prompt, lang, true);
  const parsed = extractVerseJson(raw);

  if (parsed && typeof parsed.text === "string" && parsed.text.trim().length > 0) {
    return {
      reference:
        typeof parsed.reference === "string" && parsed.reference.trim()
          ? parsed.reference.trim()
          : chapterReference,
      text: normalizeChapterText(parsed.text),
    };
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    throw new Error(
      `Could not extract chapter text from AI response. Raw: ${trimmed.slice(0, 120)}`,
    );
  }

  return {
    reference: chapterReference,
    text: normalizeChapterText(trimmed),
  };
}

function getLocalRussianVerse(reference: string): VerseResult | null {
  const parsed = parseLocalReference(reference);

  if (!parsed || typeof parsed.verse !== "number") {
    return null;
  }

  const book = LOCAL_RU_BIBLE.books[parsed.bookKey];
  const text = book?.chapters[String(parsed.chapter)]?.[String(parsed.verse)];

  if (!text) {
    return null;
  }

  return {
    reference: `${book.longName} ${parsed.chapter}:${parsed.verse}`,
    text,
  };
}

function getLocalRussianChapter(reference: string): ChapterResult | null {
  const parsed = parseLocalReference(reference);

  if (!parsed) {
    return null;
  }

  const book = LOCAL_RU_BIBLE.books[parsed.bookKey];
  const chapter = book?.chapters[String(parsed.chapter)];

  if (!chapter) {
    return null;
  }

  const verseNumbers = Object.keys(chapter)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  const text = verseNumbers
    .map((verseNumber) => {
      return `${verseNumber}. ${chapter[String(verseNumber)]}`;
    })
    .join("\n");

  return {
    reference: `${book.longName} ${parsed.chapter}`,
    text: normalizeChapterText(text),
  };
}

function parseLocalReference(reference: string): ParsedReference | null {
  const original = reference.trim();

  if (!original) {
    return null;
  }

  const normalized = normalizeBookInput(original);

  const match = normalized.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);

  if (!match) {
    return null;
  }

  const rawBook = normalizeBookInput(match[1] ?? "");
  const chapter = Number(match[2]);
  const verse = match[3] ? Number(match[3]) : undefined;

  if (!rawBook || !Number.isFinite(chapter) || chapter <= 0) {
    return null;
  }

  if (typeof verse === "number" && (!Number.isFinite(verse) || verse <= 0)) {
    return null;
  }

  const bookKey = resolveBookKey(rawBook);

  if (!bookKey) {
    return null;
  }

  return {
    original,
    bookKey,
    chapter,
    verse,
  };
}

function resolveBookKey(rawBook: string): string | null {
  const direct = BOOK_ALIASES[rawBook];

  if (direct) {
    return direct;
  }

  const compact = rawBook.replace(/\s+/g, "");

  const compactMatch = BOOK_ALIASES[compact];

  if (compactMatch) {
    return compactMatch;
  }

  return null;
}

function normalizeBookInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
}

function getChapterReference(reference: string): string {
  const trimmed = reference.trim();

  const colonIndex = trimmed.lastIndexOf(":");

  if (colonIndex === -1) {
    return trimmed;
  }

  return trimmed.slice(0, colonIndex).trim();
}

function normalizeChapterText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractVerseJson(s: string): { reference?: string; text?: string } | null {
  const cleaned = s
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  let obj: Record<string, unknown> | null = null;

  try {
    const val = JSON.parse(cleaned);
    if (val && typeof val === "object" && !Array.isArray(val)) {
      obj = val as Record<string, unknown>;
    }
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);

    if (m) {
      try {
        const val = JSON.parse(m[0]);
        if (val && typeof val === "object") {
          obj = val as Record<string, unknown>;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!obj) return null;

  const text =
    (typeof obj.text === "string" ? obj.text : null) ??
    (typeof obj["текст"] === "string" ? obj["текст"] : null) ??
    (typeof obj.verseText === "string" ? obj.verseText : null) ??
    (typeof obj.verse === "string" ? obj.verse : null) ??
    (typeof obj.content === "string" ? obj.content : null) ??
    Object.values(obj)
      .filter((v): v is string => typeof v === "string" && v.length > 20)
      .sort((a, b) => b.length - a.length)[0] ??
    null;

  const reference =
    (typeof obj.reference === "string" ? obj.reference : null) ??
    (typeof obj["ссылка"] === "string" ? obj["ссылка"] : null) ??
    (typeof obj.ref === "string" ? obj.ref : null) ??
    null;

  return {
    text: text ?? undefined,
    reference: reference ?? undefined,
  };
}
