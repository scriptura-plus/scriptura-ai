import "server-only";

import fs from "node:fs";
import path from "node:path";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { resolveLocalPsalmToStepReference } from "@/lib/bible/psalmReferenceMap";

export type OriginalLanguageWord = {
  position: number;
  surface: string;
  transliteration: string;
  english: string;
  strong: string;
  morphology: string;
  lemma: string;
  lemmaGloss: string;
  hebrewReference?: string;
  englishReference?: string;
};

export type OriginalLanguagePacket = {
  reference: string;
  stepReference: string;
  testament: "nt" | "ot";
  language: "greek" | "hebrew";
  source: "STEPBible TAGNT" | "STEPBible TOTHT";
  license: "CC BY 4.0";
  words: OriginalLanguageWord[];
  numberingNote?: string | null;
};

type BookData = Record<string, OriginalLanguageWord[]>;

type BookMeta = {
  stepBook: string;
  fileCode: string;
  testament: "nt" | "ot";
  language: "greek" | "hebrew";
  source: "STEPBible TAGNT" | "STEPBible TOTHT";
};

const BOOK_META_BY_STEP_BOOK: Record<string, BookMeta> = {
  Mat: { stepBook: "Mat", fileCode: "mat", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Mrk: { stepBook: "Mrk", fileCode: "mrk", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Luk: { stepBook: "Luk", fileCode: "luk", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Jhn: { stepBook: "Jhn", fileCode: "jhn", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Act: { stepBook: "Act", fileCode: "act", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Rom: { stepBook: "Rom", fileCode: "rom", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "1Co": { stepBook: "1Co", fileCode: "1co", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "2Co": { stepBook: "2Co", fileCode: "2co", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Gal: { stepBook: "Gal", fileCode: "gal", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Eph: { stepBook: "Eph", fileCode: "eph", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Php: { stepBook: "Php", fileCode: "php", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Col: { stepBook: "Col", fileCode: "col", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "1Th": { stepBook: "1Th", fileCode: "1th", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "2Th": { stepBook: "2Th", fileCode: "2th", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "1Ti": { stepBook: "1Ti", fileCode: "1ti", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "2Ti": { stepBook: "2Ti", fileCode: "2ti", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Tit: { stepBook: "Tit", fileCode: "tit", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Phm: { stepBook: "Phm", fileCode: "phm", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Heb: { stepBook: "Heb", fileCode: "heb", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Jas: { stepBook: "Jas", fileCode: "jas", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "1Pe": { stepBook: "1Pe", fileCode: "1pe", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "2Pe": { stepBook: "2Pe", fileCode: "2pe", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "1Jn": { stepBook: "1Jn", fileCode: "1jn", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "2Jn": { stepBook: "2Jn", fileCode: "2jn", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  "3Jn": { stepBook: "3Jn", fileCode: "3jn", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Jud: { stepBook: "Jud", fileCode: "jud", testament: "nt", language: "greek", source: "STEPBible TAGNT" },
  Rev: { stepBook: "Rev", fileCode: "rev", testament: "nt", language: "greek", source: "STEPBible TAGNT" },

  Gen: { stepBook: "Gen", fileCode: "gen", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Exo: { stepBook: "Exo", fileCode: "exo", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Lev: { stepBook: "Lev", fileCode: "lev", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Num: { stepBook: "Num", fileCode: "num", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Deu: { stepBook: "Deu", fileCode: "deu", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Psa: { stepBook: "Psa", fileCode: "psa", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Job: { stepBook: "Job", fileCode: "job", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Pro: { stepBook: "Pro", fileCode: "pro", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Ecc: { stepBook: "Ecc", fileCode: "ecc", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Sng: { stepBook: "Sng", fileCode: "sng", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Jos: { stepBook: "Jos", fileCode: "jos", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Jdg: { stepBook: "Jdg", fileCode: "jdg", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Rut: { stepBook: "Rut", fileCode: "rut", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  "1Sa": { stepBook: "1Sa", fileCode: "1sa", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  "2Sa": { stepBook: "2Sa", fileCode: "2sa", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  "1Ki": { stepBook: "1Ki", fileCode: "1ki", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  "2Ki": { stepBook: "2Ki", fileCode: "2ki", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  "1Ch": { stepBook: "1Ch", fileCode: "1ch", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  "2Ch": { stepBook: "2Ch", fileCode: "2ch", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Ezr: { stepBook: "Ezr", fileCode: "ezr", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Neh: { stepBook: "Neh", fileCode: "neh", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
  Est: { stepBook: "Est", fileCode: "est", testament: "ot", language: "hebrew", source: "STEPBible TOTHT" },
};

const CANONICAL_TO_STEP_BOOK: Record<string, string> = {
  matthew: "Mat", mat: "Mat", mt: "Mat",
  mark: "Mrk", mrk: "Mrk", mk: "Mrk",
  luke: "Luk", luk: "Luk", lk: "Luk",
  john: "Jhn", jhn: "Jhn",
  acts: "Act", act: "Act",
  romans: "Rom", rom: "Rom",
  "1-corinthians": "1Co", "1 corinthians": "1Co", "first corinthians": "1Co", "1co": "1Co",
  "2-corinthians": "2Co", "2 corinthians": "2Co", "second corinthians": "2Co", "2co": "2Co",
  galatians: "Gal", gal: "Gal",
  ephesians: "Eph", eph: "Eph",
  philippians: "Php", php: "Php",
  colossians: "Col", col: "Col",
  "1-thessalonians": "1Th", "1 thessalonians": "1Th", "first thessalonians": "1Th", "1th": "1Th",
  "2-thessalonians": "2Th", "2 thessalonians": "2Th", "second thessalonians": "2Th", "2th": "2Th",
  "1-timothy": "1Ti", "1 timothy": "1Ti", "first timothy": "1Ti", "1ti": "1Ti",
  "2-timothy": "2Ti", "2 timothy": "2Ti", "second timothy": "2Ti", "2ti": "2Ti",
  titus: "Tit", tit: "Tit",
  philemon: "Phm", phm: "Phm",
  hebrews: "Heb", heb: "Heb",
  james: "Jas", jas: "Jas",
  "1-peter": "1Pe", "1 peter": "1Pe", "first peter": "1Pe", "1pe": "1Pe",
  "2-peter": "2Pe", "2 peter": "2Pe", "second peter": "2Pe", "2pe": "2Pe",
  "1-john": "1Jn", "1 john": "1Jn", "first john": "1Jn", "1jn": "1Jn",
  "2-john": "2Jn", "2 john": "2Jn", "second john": "2Jn", "2jn": "2Jn",
  "3-john": "3Jn", "3 john": "3Jn", "third john": "3Jn", "3jn": "3Jn",
  jude: "Jud", jud: "Jud",
  revelation: "Rev", rev: "Rev",

  "матфея": "Mat", "от матфея": "Mat", "евангелие от матфея": "Mat",
  "марка": "Mrk", "от марка": "Mrk", "евангелие от марка": "Mrk",
  "луки": "Luk", "от луки": "Luk", "евангелие от луки": "Luk",
  "иоанна": "Jhn", "от иоанна": "Jhn", "евангелие от иоанна": "Jhn",
  "деяния": "Act", "деяния апостолов": "Act",
  "римлянам": "Rom", "к римлянам": "Rom",
  "1 коринфянам": "1Co", "1-е коринфянам": "1Co", "первая коринфянам": "1Co",
  "2 коринфянам": "2Co", "2-е коринфянам": "2Co", "вторая коринфянам": "2Co",
  "галатам": "Gal", "к галатам": "Gal",
  "эфесянам": "Eph", "к эфесянам": "Eph",
  "филиппийцам": "Php", "к филиппийцам": "Php",
  "колоссянам": "Col", "к колоссянам": "Col",
  "1 фессалоникийцам": "1Th", "1-е фессалоникийцам": "1Th", "1 солунянам": "1Th",
  "2 фессалоникийцам": "2Th", "2-е фессалоникийцам": "2Th", "2 солунянам": "2Th",
  "1 тимофею": "1Ti", "1-е тимофею": "1Ti",
  "2 тимофею": "2Ti", "2-е тимофею": "2Ti",
  "титу": "Tit", "филимону": "Phm",
  "евреям": "Heb", "к евреям": "Heb",
  "иакова": "Jas",
  "1 петра": "1Pe", "1-е петра": "1Pe",
  "2 петра": "2Pe", "2-е петра": "2Pe",
  "1 иоанна": "1Jn", "1-е иоанна": "1Jn",
  "2 иоанна": "2Jn", "2-е иоанна": "2Jn",
  "3 иоанна": "3Jn", "3-е иоанна": "3Jn",
  "иуды": "Jud",
  "откровение": "Rev", "откровение иоанна": "Rev",

  mateo: "Mat", marcos: "Mrk", lucas: "Luk", juan: "Jhn", hechos: "Act",
  romanos: "Rom", "1 corintios": "1Co", "2 corintios": "2Co",
  galatas: "Gal", gálatas: "Gal", efesios: "Eph", filipenses: "Php", colosenses: "Col",
  "1 tesalonicenses": "1Th", "2 tesalonicenses": "2Th",
  "1 timoteo": "1Ti", "2 timoteo": "2Ti", tito: "Tit",
  filemon: "Phm", filemón: "Phm", hebreos: "Heb", santiago: "Jas",
  "1 pedro": "1Pe", "2 pedro": "2Pe", "1 juan": "1Jn", "2 juan": "2Jn", "3 juan": "3Jn",
  judas: "Jud", apocalipsis: "Rev",

  genesis: "Gen", gen: "Gen", "бытие": "Gen", "быт": "Gen", génesis: "Gen",
  exodus: "Exo", exo: "Exo", "исход": "Exo", "исх": "Exo", exodo: "Exo", éxodo: "Exo",
  leviticus: "Lev", lev: "Lev", "левит": "Lev", "лев": "Lev", levitico: "Lev", levítico: "Lev",
  numbers: "Num", num: "Num", "числа": "Num", "чис": "Num", numeros: "Num", números: "Num",
  deuteronomy: "Deu", deu: "Deu", "второзаконие": "Deu", "втор": "Deu", deuteronomio: "Deu",

  joshua: "Jos", jos: "Jos", "иисус навин": "Jos", "книга иисуса навина": "Jos", "иошуа": "Jos", josue: "Jos", josué: "Jos",
  judges: "Jdg", jdg: "Jdg", "судей": "Jdg", "книга судей": "Jdg", jueces: "Jdg",
  ruth: "Rut", rut: "Rut", "руфь": "Rut", "книга руфь": "Rut",
  "1-samuel": "1Sa", "1 samuel": "1Sa", "first samuel": "1Sa", "1sa": "1Sa", "1 самуила": "1Sa", "1-я самуила": "1Sa", "первая самуила": "1Sa", "1 царств": "1Sa", "1-я царств": "1Sa", "первая царств": "1Sa",
  "2-samuel": "2Sa", "2 samuel": "2Sa", "second samuel": "2Sa", "2sa": "2Sa", "2 самуила": "2Sa", "2-я самуила": "2Sa", "вторая самуила": "2Sa", "2 царств": "2Sa", "2-я царств": "2Sa", "вторая царств": "2Sa",
  "1-kings": "1Ki", "1 kings": "1Ki", "first kings": "1Ki", "1ki": "1Ki", "1 царей": "1Ki", "1-я царей": "1Ki", "первая царей": "1Ki", "3 царств": "1Ki", "3-я царств": "1Ki", "третья царств": "1Ki", "1 reyes": "1Ki",
  "2-kings": "2Ki", "2 kings": "2Ki", "second kings": "2Ki", "2ki": "2Ki", "2 царей": "2Ki", "2-я царей": "2Ki", "вторая царей": "2Ki", "4 царств": "2Ki", "4-я царств": "2Ki", "четвертая царств": "2Ki", "четвёртая царств": "2Ki", "2 reyes": "2Ki",
  "1-chronicles": "1Ch", "1 chronicles": "1Ch", "first chronicles": "1Ch", "1ch": "1Ch", "1 летопись": "1Ch", "1-я летопись": "1Ch", "первая летопись": "1Ch", "1 хроник": "1Ch", "1 cronicas": "1Ch", "1 crónicas": "1Ch",
  "2-chronicles": "2Ch", "2 chronicles": "2Ch", "second chronicles": "2Ch", "2ch": "2Ch", "2 летопись": "2Ch", "2-я летопись": "2Ch", "вторая летопись": "2Ch", "2 хроник": "2Ch", "2 cronicas": "2Ch", "2 crónicas": "2Ch",
  ezra: "Ezr", ezr: "Ezr", "ездра": "Ezr", "книга ездры": "Ezr", esdras: "Ezr",
  nehemiah: "Neh", neh: "Neh", "неемия": "Neh", "книга неемии": "Neh", "неемии": "Neh", nehemias: "Neh", nehemías: "Neh",
  esther: "Est", est: "Est", "эсфирь": "Est", "книга эсфирь": "Est", "эсфири": "Est", ester: "Est",

  job: "Job", "иов": "Job", "иова": "Job", "книга иова": "Job",
  proverbs: "Pro", proverb: "Pro", pro: "Pro", "притчи": "Pro", "притчи соломона": "Pro", proverbios: "Pro",
  ecclesiastes: "Ecc", ecc: "Ecc", "экклезиаст": "Ecc", "екклесиаст": "Ecc", "экклезиаста": "Ecc", "екклесиаста": "Ecc", eclesiastes: "Ecc", eclesiastés: "Ecc",
  "song-of-songs": "Sng", "song of songs": "Sng", "song-of-solomon": "Sng", "song of solomon": "Sng", sng: "Sng", sos: "Sng", "песнь песней": "Sng", "песнь песней соломона": "Sng", "cantar de los cantares": "Sng", cantares: "Sng",

  psalm: "Psa", psalms: "Psa", psa: "Psa", ps: "Psa", "book of psalms": "Psa", "псалом": "Psa", "псалмы": "Psa", "псалтирь": "Psa", "пс": "Psa", salmo: "Psa", salmos: "Psa",
};

const bookDataCache = new Map<string, BookData | null>();

function normalizeBookKey(book: string): string {
  return book.trim().toLowerCase().replace(/\.$/, "").replace(/^the\s+/, "").replace(/\s+/g, " ");
}

function parseReferenceFallback(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} | null {
  const trimmed = reference.trim();

  const stepMatch = trimmed.match(/^([1-3]?[A-Za-z]{2,4})\.(\d+)\.(\d+)$/);
  if (stepMatch) {
    return {
      book: normalizeBookKey(stepMatch[1]),
      chapter: Number(stepMatch[2]),
      verse: Number(stepMatch[3]),
    };
  }

  const slugMatch = trimmed.match(/^([a-zа-яё0-9-]+)-(\d+)-(\d+)$/i);
  if (slugMatch) {
    return {
      book: normalizeBookKey(slugMatch[1].replace(/-/g, " ")),
      chapter: Number(slugMatch[2]),
      verse: Number(slugMatch[3]),
    };
  }

  const plainMatch = trimmed.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (plainMatch) {
    return {
      book: normalizeBookKey(plainMatch[1]),
      chapter: Number(plainMatch[2]),
      verse: Number(plainMatch[3]),
    };
  }

  return null;
}

function resolveParsedReference(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} | null {
  const normalized = normalizeReference(reference);

  if (
    normalized.book &&
    Number.isFinite(normalized.chapter) &&
    Number.isFinite(normalized.verse) &&
    normalized.chapter > 0 &&
    normalized.verse > 0
  ) {
    return {
      book: normalizeBookKey(normalized.book),
      chapter: normalized.chapter,
      verse: normalized.verse,
    };
  }

  return parseReferenceFallback(reference);
}

function resolveStepReference(reference: string): {
  stepReference: string;
  stepBook: string;
  numberingNote?: string | null;
} | null {
  const parsed = resolveParsedReference(reference);
  if (!parsed) return null;

  const stepBook = CANONICAL_TO_STEP_BOOK[parsed.book];
  if (!stepBook) return null;

  if (!Number.isFinite(parsed.chapter) || !Number.isFinite(parsed.verse)) return null;

  if (stepBook === "Psa") {
    const resolvedPsalm = resolveLocalPsalmToStepReference({
      chapter: parsed.chapter,
      verse: parsed.verse,
    });

    if (resolvedPsalm.blocked) {
      console.warn("[ORIGINAL_LANGUAGE] Psalm Hebrew lookup blocked", {
        reference,
        chapter: parsed.chapter,
        verse: parsed.verse,
        note: resolvedPsalm.note,
      });
      return null;
    }

    return {
      stepBook,
      stepReference: `Psa.${resolvedPsalm.stepChapter}.${resolvedPsalm.stepVerse}`,
      numberingNote: resolvedPsalm.note,
    };
  }

  return {
    stepBook,
    stepReference: `${stepBook}.${parsed.chapter}.${parsed.verse}`,
    numberingNote: null,
  };
}

function getDataFilePath(meta: BookMeta): string {
  return path.join(
    process.cwd(),
    "src",
    "lib",
    "bible",
    "data",
    "original-language",
    meta.testament,
    `${meta.fileCode}.json`,
  );
}

function readBookData(meta: BookMeta): BookData | null {
  const cacheKey = `${meta.testament}:${meta.fileCode}`;

  if (bookDataCache.has(cacheKey)) {
    return bookDataCache.get(cacheKey) ?? null;
  }

  const filePath = getDataFilePath(meta);

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as BookData;

    bookDataCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    console.warn("[ORIGINAL_LANGUAGE] Failed to read local packet", {
      filePath,
      stepBook: meta.stepBook,
      fileCode: meta.fileCode,
      error: error instanceof Error ? error.message : String(error),
    });
    bookDataCache.set(cacheKey, null);
    return null;
  }
}

export function getOriginalLanguagePacket(reference: string): OriginalLanguagePacket | null {
  const resolved = resolveStepReference(reference);
  if (!resolved) return null;

  const meta = BOOK_META_BY_STEP_BOOK[resolved.stepBook];
  if (!meta) return null;

  const data = readBookData(meta);
  if (!data) return null;

  const words = data[resolved.stepReference];
  if (!words || words.length === 0) return null;

  return {
    reference,
    stepReference: resolved.stepReference,
    testament: meta.testament,
    language: meta.language,
    source: meta.source,
    license: "CC BY 4.0",
    words,
    numberingNote: resolved.numberingNote ?? null,
  };
}

function formatWordLabel(word: OriginalLanguageWord): string {
  if (word.transliteration) {
    return `${word.position}. ${word.surface} (${word.transliteration})`;
  }

  return `${word.position}. ${word.surface}`;
}

function getSourceNote(packet: OriginalLanguagePacket): string {
  if (packet.language === "hebrew") {
    return [
      "Use this Hebrew packet as the only source for Strong's numbers, Hebrew forms, morphology, lemma, and glosses.",
      "Do not add transliterations unless the packet explicitly supplies transliteration. If transliteration is missing, quote the Hebrew surface form directly instead.",
      "Do not invent common transliterations from memory.",
      "Do not describe Hebrew qatal simply as 'past tense'. Explain it cautiously as a perfective/completed verbal form that is often rendered with a past-tense verb in translation, depending on context.",
      "Do not describe Hebrew yiqtol simply as 'future tense'. Explain it cautiously as an imperfective/non-completed verbal form whose translation depends on context.",
      "Do not overbuild theology from Hebrew roots.",
      "Do not treat root/lemma gloss as the same as full contextual meaning.",
      "Explain Hebrew morphology in reader-friendly language; do not foreground raw morphology codes unless they are essential.",
      "Psalm references are keyed by English/KJV-style reference when available, while Hebrew references are preserved per word when they differ.",
    ].join(" ");
  }

  return "Use this Greek packet as the only source for Strong's numbers, Greek forms, morphology, lemma, and glosses. Do not add morphology or lexical claims that are not supported by this packet.";
}

export function formatOriginalLanguagePacketForPrompt(packet: OriginalLanguagePacket | null): string {
  if (!packet) {
    return "VERIFIED ORIGINAL-LANGUAGE DATA: not available for this verse in the local STEPBible packet. Do not invent Greek/Hebrew morphology, Strong's numbers, transliterations, or parsing.";
  }

  const lines = packet.words.map((word) => {
    const parts = [
      formatWordLabel(word),
      word.english ? `gloss: ${word.english}` : null,
      word.strong ? `Strong: ${word.strong}` : null,
      word.morphology ? `morphology: ${word.morphology}` : null,
      word.lemma ? `lemma: ${word.lemma}` : null,
      word.lemmaGloss ? `lemma gloss: ${word.lemmaGloss}` : null,
      word.hebrewReference &&
      word.englishReference &&
      word.hebrewReference !== word.englishReference
        ? `Hebrew ref: ${word.hebrewReference}; English ref: ${word.englishReference}`
        : null,
    ].filter(Boolean);

    return `- ${parts.join("; ")}`;
  });

  const numberingLine =
    packet.numberingNote && packet.language === "hebrew"
      ? `REFERENCE MAPPING NOTE: ${packet.numberingNote}`
      : null;

  return [
    `VERIFIED ORIGINAL-LANGUAGE DATA from ${packet.source} (${packet.license}) for ${packet.stepReference}:`,
    numberingLine,
    ...lines,
    getSourceNote(packet),
  ]
    .filter(Boolean)
    .join("\n");
}
