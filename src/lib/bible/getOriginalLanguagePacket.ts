import { normalizeReference } from "@/lib/bible/normalizeReference";

import matData from "@/lib/bible/data/original-language/nt/mat.json";
import mrkData from "@/lib/bible/data/original-language/nt/mrk.json";
import lukData from "@/lib/bible/data/original-language/nt/luk.json";
import jhnData from "@/lib/bible/data/original-language/nt/jhn.json";
import actData from "@/lib/bible/data/original-language/nt/act.json";
import romData from "@/lib/bible/data/original-language/nt/rom.json";
import oneCoData from "@/lib/bible/data/original-language/nt/1co.json";
import twoCoData from "@/lib/bible/data/original-language/nt/2co.json";
import galData from "@/lib/bible/data/original-language/nt/gal.json";
import ephData from "@/lib/bible/data/original-language/nt/eph.json";
import phpData from "@/lib/bible/data/original-language/nt/php.json";
import colData from "@/lib/bible/data/original-language/nt/col.json";
import oneThData from "@/lib/bible/data/original-language/nt/1th.json";
import twoThData from "@/lib/bible/data/original-language/nt/2th.json";
import oneTiData from "@/lib/bible/data/original-language/nt/1ti.json";
import twoTiData from "@/lib/bible/data/original-language/nt/2ti.json";
import titData from "@/lib/bible/data/original-language/nt/tit.json";
import phmData from "@/lib/bible/data/original-language/nt/phm.json";
import hebData from "@/lib/bible/data/original-language/nt/heb.json";
import jasData from "@/lib/bible/data/original-language/nt/jas.json";
import onePeData from "@/lib/bible/data/original-language/nt/1pe.json";
import twoPeData from "@/lib/bible/data/original-language/nt/2pe.json";
import oneJnData from "@/lib/bible/data/original-language/nt/1jn.json";
import twoJnData from "@/lib/bible/data/original-language/nt/2jn.json";
import threeJnData from "@/lib/bible/data/original-language/nt/3jn.json";
import judData from "@/lib/bible/data/original-language/nt/jud.json";
import revData from "@/lib/bible/data/original-language/nt/rev.json";

import psaData from "@/lib/bible/data/original-language/ot/psa.json";

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
};

type BookData = Record<string, OriginalLanguageWord[]>;

const NT_BOOK_DATA: Record<string, BookData> = {
  mat: matData as BookData,
  mrk: mrkData as BookData,
  luk: lukData as BookData,
  jhn: jhnData as BookData,
  act: actData as BookData,
  rom: romData as BookData,
  "1co": oneCoData as BookData,
  "2co": twoCoData as BookData,
  gal: galData as BookData,
  eph: ephData as BookData,
  php: phpData as BookData,
  col: colData as BookData,
  "1th": oneThData as BookData,
  "2th": twoThData as BookData,
  "1ti": oneTiData as BookData,
  "2ti": twoTiData as BookData,
  tit: titData as BookData,
  phm: phmData as BookData,
  heb: hebData as BookData,
  jas: jasData as BookData,
  "1pe": onePeData as BookData,
  "2pe": twoPeData as BookData,
  "1jn": oneJnData as BookData,
  "2jn": twoJnData as BookData,
  "3jn": threeJnData as BookData,
  jud: judData as BookData,
  rev: revData as BookData,
};

const OT_BOOK_DATA: Record<string, BookData> = {
  psa: psaData as BookData,
};

const CANONICAL_TO_STEP_BOOK: Record<string, string> = {
  // NT — English
  matthew: "Mat",
  mat: "Mat",
  mt: "Mat",
  mark: "Mrk",
  mrk: "Mrk",
  mk: "Mrk",
  luke: "Luk",
  luk: "Luk",
  lk: "Luk",
  john: "Jhn",
  jhn: "Jhn",
  acts: "Act",
  act: "Act",
  romans: "Rom",
  rom: "Rom",
  "1-corinthians": "1Co",
  "1 corinthians": "1Co",
  "first corinthians": "1Co",
  "1co": "1Co",
  "2-corinthians": "2Co",
  "2 corinthians": "2Co",
  "second corinthians": "2Co",
  "2co": "2Co",
  galatians: "Gal",
  gal: "Gal",
  ephesians: "Eph",
  eph: "Eph",
  philippians: "Php",
  php: "Php",
  colossians: "Col",
  col: "Col",
  "1-thessalonians": "1Th",
  "1 thessalonians": "1Th",
  "first thessalonians": "1Th",
  "1th": "1Th",
  "2-thessalonians": "2Th",
  "2 thessalonians": "2Th",
  "second thessalonians": "2Th",
  "2th": "2Th",
  "1-timothy": "1Ti",
  "1 timothy": "1Ti",
  "first timothy": "1Ti",
  "1ti": "1Ti",
  "2-timothy": "2Ti",
  "2 timothy": "2Ti",
  "second timothy": "2Ti",
  "2ti": "2Ti",
  titus: "Tit",
  tit: "Tit",
  philemon: "Phm",
  phm: "Phm",
  hebrews: "Heb",
  heb: "Heb",
  james: "Jas",
  jas: "Jas",
  "1-peter": "1Pe",
  "1 peter": "1Pe",
  "first peter": "1Pe",
  "1pe": "1Pe",
  "2-peter": "2Pe",
  "2 peter": "2Pe",
  "second peter": "2Pe",
  "2pe": "2Pe",
  "1-john": "1Jn",
  "1 john": "1Jn",
  "first john": "1Jn",
  "1jn": "1Jn",
  "2-john": "2Jn",
  "2 john": "2Jn",
  "second john": "2Jn",
  "2jn": "2Jn",
  "3-john": "3Jn",
  "3 john": "3Jn",
  "third john": "3Jn",
  "3jn": "3Jn",
  jude: "Jud",
  jud: "Jud",
  revelation: "Rev",
  rev: "Rev",

  // NT — Russian common names
  "матфея": "Mat",
  "от матфея": "Mat",
  "евангелие от матфея": "Mat",
  "марка": "Mrk",
  "от марка": "Mrk",
  "евангелие от марка": "Mrk",
  "луки": "Luk",
  "от луки": "Luk",
  "евангелие от луки": "Luk",
  "иоанна": "Jhn",
  "от иоанна": "Jhn",
  "евангелие от иоанна": "Jhn",
  "деяния": "Act",
  "деяния апостолов": "Act",
  "римлянам": "Rom",
  "к римлянам": "Rom",
  "1 коринфянам": "1Co",
  "1-е коринфянам": "1Co",
  "первая коринфянам": "1Co",
  "2 коринфянам": "2Co",
  "2-е коринфянам": "2Co",
  "вторая коринфянам": "2Co",
  "галатам": "Gal",
  "к галатам": "Gal",
  "эфесянам": "Eph",
  "к эфесянам": "Eph",
  "филиппийцам": "Php",
  "к филиппийцам": "Php",
  "колоссянам": "Col",
  "к колоссянам": "Col",
  "1 фессалоникийцам": "1Th",
  "1-е фессалоникийцам": "1Th",
  "1 солунянам": "1Th",
  "2 фессалоникийцам": "2Th",
  "2-е фессалоникийцам": "2Th",
  "2 солунянам": "2Th",
  "1 тимофею": "1Ti",
  "1-е тимофею": "1Ti",
  "2 тимофею": "2Ti",
  "2-е тимофею": "2Ti",
  "титу": "Tit",
  "филимону": "Phm",
  "евреям": "Heb",
  "к евреям": "Heb",
  "иакова": "Jas",
  "1 петра": "1Pe",
  "1-е петра": "1Pe",
  "2 петра": "2Pe",
  "2-е петра": "2Pe",
  "1 иоанна": "1Jn",
  "1-е иоанна": "1Jn",
  "2 иоанна": "2Jn",
  "2-е иоанна": "2Jn",
  "3 иоанна": "3Jn",
  "3-е иоанна": "3Jn",
  "иуды": "Jud",
  "откровение": "Rev",
  "откровение иоанна": "Rev",

  // NT — Spanish common names
  mateo: "Mat",
  marcos: "Mrk",
  lucas: "Luk",
  juan: "Jhn",
  hechos: "Act",
  romanos: "Rom",
  "1 corintios": "1Co",
  "2 corintios": "2Co",
  galatas: "Gal",
  gálatas: "Gal",
  efesios: "Eph",
  filipenses: "Php",
  colosenses: "Col",
  "1 tesalonicenses": "1Th",
  "2 tesalonicenses": "2Th",
  "1 timoteo": "1Ti",
  "2 timoteo": "2Ti",
  tito: "Tit",
  filemon: "Phm",
  filemón: "Phm",
  hebreos: "Heb",
  santiago: "Jas",
  "1 pedro": "1Pe",
  "2 pedro": "2Pe",
  "1 juan": "1Jn",
  "2 juan": "2Jn",
  "3 juan": "3Jn",
  judas: "Jud",
  apocalipsis: "Rev",

  // OT pilot — Psalms only
  psalm: "Psa",
  psalms: "Psa",
  psa: "Psa",
  ps: "Psa",
  "book of psalms": "Psa",
  "псалом": "Psa",
  "псалмы": "Psa",
  "псалтирь": "Psa",
  "пс": "Psa",
  salmo: "Psa",
  salmos: "Psa",
};

function normalizeBookKey(book: string): string {
  return book
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ");
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
} | null {
  const parsed = resolveParsedReference(reference);

  if (!parsed) return null;

  const stepBook = CANONICAL_TO_STEP_BOOK[parsed.book];

  if (!stepBook) return null;

  if (!Number.isFinite(parsed.chapter) || !Number.isFinite(parsed.verse)) {
    return null;
  }

  return {
    stepBook,
    stepReference: `${stepBook}.${parsed.chapter}.${parsed.verse}`,
  };
}

function getBookData(stepBook: string): {
  data: BookData | null;
  testament: "nt" | "ot";
  language: "greek" | "hebrew";
  source: "STEPBible TAGNT" | "STEPBible TOTHT";
} | null {
  const bookCode = stepBook.toLowerCase();

  if (NT_BOOK_DATA[bookCode]) {
    return {
      data: NT_BOOK_DATA[bookCode],
      testament: "nt",
      language: "greek",
      source: "STEPBible TAGNT",
    };
  }

  if (OT_BOOK_DATA[bookCode]) {
    return {
      data: OT_BOOK_DATA[bookCode],
      testament: "ot",
      language: "hebrew",
      source: "STEPBible TOTHT",
    };
  }

  return null;
}

export function getOriginalLanguagePacket(
  reference: string,
): OriginalLanguagePacket | null {
  const resolved = resolveStepReference(reference);

  if (!resolved) return null;

  const bookData = getBookData(resolved.stepBook);
  if (!bookData?.data) return null;

  const words = bookData.data[resolved.stepReference];
  if (!words || words.length === 0) return null;

  return {
    reference,
    stepReference: resolved.stepReference,
    testament: bookData.testament,
    language: bookData.language,
    source: bookData.source,
    license: "CC BY 4.0",
    words,
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
      "Do not overbuild theology from Hebrew roots.",
      "Do not treat root/lemma gloss as the same as full contextual meaning.",
      "Explain Hebrew morphology in reader-friendly language; do not foreground raw morphology codes unless they are essential.",
      "Psalm references are keyed by English/KJV-style reference when available, while Hebrew references are preserved per word when they differ.",
    ].join(" ");
  }

  return "Use this Greek packet as the only source for Strong's numbers, Greek forms, morphology, lemma, and glosses. Do not add morphology or lexical claims that are not supported by this packet.";
}

export function formatOriginalLanguagePacketForPrompt(
  packet: OriginalLanguagePacket | null,
): string {
  if (!packet) {
    return "VERIFIED ORIGINAL-LANGUAGE DATA: not available for this verse in the local STEPBible packet. Do not invent Greek/Hebrew morphology, Strong's numbers, or parsing.";
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

  return [
    `VERIFIED ORIGINAL-LANGUAGE DATA from ${packet.source} (${packet.license}) for ${packet.stepReference}:`,
    ...lines,
    getSourceNote(packet),
  ].join("\n");
}
