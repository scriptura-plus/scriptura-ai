import type { Lang } from "@/lib/i18n/dictionary";

export type PearlV3ClaimType =
  | "structural"
  | "rhetorical"
  | "narrative"
  | "lexical"
  | "intertextual"
  | "theological";

export type PearlV3WeaknessRoot = "angle" | "execution" | "none";

export type PearlV3SuggestedStatus =
  | "featured"
  | "reserve"
  | "rewrite"
  | "rejected";

export type PearlV3VerseContext = {
  reference: string;
  canonicalRef: string | null;
  bookKey: string | null;
  chapter: number;
  verse: number;
  lang: Lang;
  centralRef: string;
  centralText: string;
  chapterReference: string;
  chapterText: string;
};

export type PearlV3Angle = {
  index: number;
  anchor: string;
  observation: string;
  whyInteresting: string;
};

export type PearlV3CardDraft = {
  title: string;
  anchor: string;
  teaser: string;
  why_it_matters: string;
};

export type PearlV3ScoreResult = {
  textualGround: string;
  score: number;
  claimType: PearlV3ClaimType;
  reasoning: string;
  weaknessRoot: PearlV3WeaknessRoot;
  weaknessDetail: string;
};

export type PearlV3ScoredCard = {
  card: PearlV3CardDraft;
  angle: PearlV3Angle;
  score: PearlV3ScoreResult;
  suggestedStatus: PearlV3SuggestedStatus;
  rawWriterOutput: string;
  rawScorerOutput: string;
};

export type PearlV3PublicCard = {
  title: string;
  anchor: string;
  teaser: string;
  why_it_matters: string;
};

export type PearlV3RunOptions = {
  writeLimit?: number;
  targetCount?: number;
  minScore?: number;
  includeRaw?: boolean;
};

export type PearlV3RunResult = {
  ok: true;
  model: string;
  reference: string;
  canonicalRef: string | null;
  verseContext: PearlV3VerseContext;
  lexiconAvailable: boolean;
  angles: PearlV3Angle[];
  cards: PearlV3PublicCard[];
  scoredCards: PearlV3ScoredCard[];
  rejectedCards: PearlV3ScoredCard[];
  debug: {
    anglesCount: number;
    writeLimit: number;
    writtenCount: number;
    scoredCount: number;
    returnedCount: number;
    minScore: number;
    targetCount: number;
  };
  raw?: {
    detector: string;
    originalLanguageForScorer: string;
  };
};
