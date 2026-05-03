import { normalizeReference } from "@/lib/bible/normalizeReference";

import jhnData from "@/lib/bible/data/original-language/nt/jhn.json";
import colData from "@/lib/bible/data/original-language/nt/col.json";

export type OriginalLanguageWord = {
  position: number;
  surface: string;
  transliteration: string;
  english: string;
  strong: string;
  morphology: string;
  lemma: string;
  lemmaGloss: string;
};

export type OriginalLanguagePacket = {
  reference: string;
  stepReference: string;
  testament: "nt";
  language: "greek";
  source: "STEPBible TAGNT";
  license: "CC BY 4.0";
  words: OriginalLanguageWord[];
};

type BookData = Record<string, OriginalLanguageWord[]>;

const NT_BOOK_DATA: Record<string, BookData> = {
  jhn: jhnData as BookData,
  col: colData as BookData,
};

const CANONICAL_TO_STEP_BOOK: Record<string, string> = {
  john: "Jhn",
  jhn: "Jhn",
  colossians: "Col",
  col: "Col",
};

function parseReferenceFallback(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} | null {
  const trimmed = reference.trim();

  const stepMatch = trimmed.match(/^([1-3]?[A-Za-z]{3})\.(\d+)\.(\d+)$/);
  if (stepMatch) {
    return {
      book: stepMatch[1].toLowerCase(),
      chapter: Number(stepMatch[2]),
      verse: Number(stepMatch[3]),
    };
  }

  const slugMatch = trimmed.match(/^([a-z0-9-]+)-(\d+)-(\d+)$/i);
  if (slugMatch) {
    return {
      book: slugMatch[1].toLowerCase(),
      chapter: Number(slugMatch[2]),
      verse: Number(slugMatch[3]),
    };
  }

  const plainMatch = trimmed.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (plainMatch) {
    return {
      book: plainMatch[1].trim().toLowerCase(),
      chapter: Number(plainMatch[2]),
      verse: Number(plainMatch[3]),
    };
  }

  return null;
}

function resolveStepReference(reference: string): string | null {
  const normalized = normalizeReference(reference);

  const parsed =
    normalized.book && normalized.chapter && normalized.verse
      ? {
          book: normalized.book.toLowerCase(),
          chapter: normalized.chapter,
          verse: normalized.verse,
        }
      : parseReferenceFallback(reference);

  if (!parsed) return null;

  const stepBook = CANONICAL_TO_STEP_BOOK[parsed.book];

  if (!stepBook) return null;
  if (!Number.isFinite(parsed.chapter) || !Number.isFinite(parsed.verse)) {
    return null;
  }

  return `${stepBook}.${parsed.chapter}.${parsed.verse}`;
}

export function getOriginalLanguagePacket(
  reference: string,
): OriginalLanguagePacket | null {
  const stepReference = resolveStepReference(reference);

  if (!stepReference) return null;

  const bookCode = stepReference.split(".")[0]?.toLowerCase();
  if (!bookCode) return null;

  const data = NT_BOOK_DATA[bookCode];
  if (!data) return null;

  const words = data[stepReference];
  if (!words || words.length === 0) return null;

  return {
    reference,
    stepReference,
    testament: "nt",
    language: "greek",
    source: "STEPBible TAGNT",
    license: "CC BY 4.0",
    words,
  };
}

export function formatOriginalLanguagePacketForPrompt(
  packet: OriginalLanguagePacket | null,
): string {
  if (!packet) {
    return "VERIFIED ORIGINAL-LANGUAGE DATA: not available for this verse in the local STEPBible packet. Do not invent Greek/Hebrew morphology, Strong's numbers, or parsing.";
  }

  const lines = packet.words.map((word) => {
    const parts = [
      `${word.position}. ${word.surface} (${word.transliteration})`,
      word.english ? `gloss: ${word.english}` : null,
      word.strong ? `Strong: ${word.strong}` : null,
      word.morphology ? `morphology: ${word.morphology}` : null,
      word.lemma ? `lemma: ${word.lemma}` : null,
      word.lemmaGloss ? `lemma gloss: ${word.lemmaGloss}` : null,
    ].filter(Boolean);

    return `- ${parts.join("; ")}`;
  });

  return [
    `VERIFIED ORIGINAL-LANGUAGE DATA from ${packet.source} (${packet.license}) for ${packet.stepReference}:`,
    ...lines,
    "Use this packet as the only source for Strong's numbers, Greek forms, morphology, lemma, and glosses. Do not add morphology or lexical claims that are not supported by this packet.",
  ].join("\n");
}
