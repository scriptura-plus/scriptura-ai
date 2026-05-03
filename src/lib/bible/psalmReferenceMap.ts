export type PsalmReferenceResolution = {
  stepChapter: number;
  stepVerse: number;
  blocked: boolean;
  note: string | null;
};

const BLOCKED_LOCAL_PSALMS = new Set([9, 113, 114, 115, 146, 147]);

export function resolveLocalPsalmToStepReference(args: {
  chapter: number;
  verse: number;
}): PsalmReferenceResolution {
  const { chapter, verse } = args;

  if (!Number.isFinite(chapter) || !Number.isFinite(verse) || chapter < 1 || verse < 1) {
    return {
      stepChapter: chapter,
      stepVerse: verse,
      blocked: true,
      note: "Invalid Psalm reference.",
    };
  }

  if (BLOCKED_LOCAL_PSALMS.has(chapter)) {
    return {
      stepChapter: chapter,
      stepVerse: verse,
      blocked: true,
      note:
        "This Psalm is in a known numbering split zone. Hebrew lookup is blocked until verse-level mapping is verified.",
    };
  }

  if (chapter >= 1 && chapter <= 8) {
    return {
      stepChapter: chapter,
      stepVerse: verse,
      blocked: false,
      note: null,
    };
  }

  if (chapter >= 10 && chapter <= 112) {
    return {
      stepChapter: chapter + 1,
      stepVerse: verse,
      blocked: false,
      note: `Local Psalm ${chapter}:${verse} is mapped to STEPBible/KJV-style Psa.${chapter + 1}.${verse}.`,
    };
  }

  if (chapter >= 116 && chapter <= 145) {
    return {
      stepChapter: chapter + 1,
      stepVerse: verse,
      blocked: false,
      note: `Local Psalm ${chapter}:${verse} is mapped to STEPBible/KJV-style Psa.${chapter + 1}.${verse}.`,
    };
  }

  if (chapter >= 148 && chapter <= 150) {
    return {
      stepChapter: chapter,
      stepVerse: verse,
      blocked: false,
      note: null,
    };
  }

  return {
    stepChapter: chapter,
    stepVerse: verse,
    blocked: true,
    note:
      "This Psalm reference is outside the current safe Psalm mapping ranges. Hebrew lookup is blocked.",
  };
}
