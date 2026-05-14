import "server-only";

import type { Provider } from "@/lib/ai/providers";
import type { Lang } from "@/lib/i18n/dictionary";
import { getChapterText, getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import type { PearlV3VerseContext } from "./types";

function markCentralVerse(chapterText: string, verseNumber: number): string {
  const lines = chapterText.replace(/\r\n/g, "\n").split("\n");
  let marked = false;

  const versePattern = new RegExp(`^\\s*${verseNumber}\\s*([.)])\\s+`);

  const nextLines = lines.map((line) => {
    if (marked) return line;

    if (versePattern.test(line)) {
      marked = true;
      return line.replace(versePattern, `${verseNumber}$1 [ЦЕНТР] `);
    }

    return line;
  });

  if (marked) {
    return nextLines.join("\n").trim();
  }

  return [
    chapterText.trim(),
    "",
    `[ЦЕНТР] ${verseNumber}. Центральный стих не был найден в номерованном тексте главы автоматически.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function buildPearlV3VerseContext(args: {
  reference: string;
  verseText?: string | null;
  lang: Lang;
  provider: Provider;
}): Promise<PearlV3VerseContext> {
  const normalized = normalizeReference(args.reference);

  if (!normalized.canonical_ref || !normalized.chapter || !normalized.verse) {
    throw new Error(
      `Pearl v3 could not normalize reference: ${args.reference}`,
    );
  }

  if (
    typeof normalized.end_verse === "number" &&
    normalized.end_verse > 0 &&
    normalized.end_verse !== normalized.verse
  ) {
    throw new Error(
      "Pearl v3 MVP currently supports one central verse only, not verse ranges.",
    );
  }

  const central =
    args.verseText && args.verseText.trim()
      ? {
          reference: args.reference,
          text: args.verseText.trim(),
        }
      : await getVerseText(args.reference, args.lang, args.provider);

  const chapter = await getChapterText(args.reference, args.lang, args.provider);

  return {
    reference: args.reference,
    canonicalRef: normalized.canonical_ref,
    bookKey: normalized.book_key,
    chapter: normalized.chapter,
    verse: normalized.verse,
    lang: args.lang,
    centralRef: central.reference || args.reference,
    centralText: central.text.trim(),
    chapterReference: chapter.reference,
    chapterText: markCentralVerse(chapter.text, normalized.verse),
  };
}
