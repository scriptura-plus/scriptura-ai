import "server-only";

import type { Provider } from "@/lib/ai/providers";
import type { Lang } from "@/lib/i18n/dictionary";
import { PEARL_V3_MODEL } from "./claude";
import { adaptPearlV3CardToPublicAngleCard, getSuggestedStatus } from "./adaptToAngleCard";
import { buildPearlV3VerseContext } from "./buildVerseContext";
import { runPearlV3Detector } from "./detector";
import { getPearlV3OriginalLanguageContext } from "./originalLanguageForScorer";
import { runPearlV3Scorer } from "./scorer";
import type {
  PearlV3RunOptions,
  PearlV3RunResult,
  PearlV3ScoredCard,
} from "./types";
import { runPearlV3Writer } from "./writer";

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export async function runPearlV3(args: {
  reference: string;
  verseText?: string | null;
  lang: Lang;
  provider: Provider;
  options?: PearlV3RunOptions;
}): Promise<PearlV3RunResult> {
  const writeLimit = clampInteger(args.options?.writeLimit, 8, 1, 12);
  const targetCount = clampInteger(args.options?.targetCount, 8, 1, 12);
  const minScore = clampInteger(args.options?.minScore, 70, 1, 100);
  const includeRaw = Boolean(args.options?.includeRaw);

  const verseContext = await buildPearlV3VerseContext({
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    provider: args.provider,
  });

  const originalLanguage = getPearlV3OriginalLanguageContext(args.reference);

  const detector = await runPearlV3Detector(verseContext);
  const selectedAngles = detector.angles.slice(0, writeLimit);

  const written = await Promise.all(
    selectedAngles.map(async (angle) => {
      const writer = await runPearlV3Writer(verseContext, angle);

      return {
        angle,
        writer,
      };
    }),
  );

  const writeSuccesses = written.filter((item) => item.writer.card);

  const scored = await Promise.all(
    writeSuccesses.map(async (item) => {
      const card = item.writer.card;
      if (!card) return null;

      const scorer = await runPearlV3Scorer({
        ctx: verseContext,
        card,
        originalLanguageForScorer: originalLanguage.formatted,
      });

      if (!scorer.result) {
        return null;
      }

      const scoredCard: PearlV3ScoredCard = {
        card,
        angle: item.angle,
        score: scorer.result,
        suggestedStatus: getSuggestedStatus(scorer.result),
        rawWriterOutput: item.writer.rawOutput,
        rawScorerOutput: scorer.rawOutput,
      };

      return scoredCard;
    }),
  );

  const scoredCards = scored.filter((item): item is PearlV3ScoredCard =>
    Boolean(item),
  );

  const sorted = [...scoredCards].sort((a, b) => b.score.score - a.score.score);

  const recommended = sorted
    .filter((item) => item.score.score >= minScore)
    .slice(0, targetCount);

  const fallback =
    recommended.length > 0
      ? recommended
      : sorted.slice(0, Math.min(3, targetCount));

  const returnedCards = fallback.map((item) =>
    adaptPearlV3CardToPublicAngleCard(item.card),
  );

  return {
    ok: true,
    model: PEARL_V3_MODEL,
    reference: args.reference,
    canonicalRef: verseContext.canonicalRef,
    verseContext,
    lexiconAvailable: originalLanguage.available,
    angles: detector.angles,
    cards: returnedCards,
    scoredCards: sorted,
    rejectedCards: sorted.filter((item) => item.score.score < minScore),
    debug: {
      anglesCount: detector.angles.length,
      writeLimit,
      writtenCount: writeSuccesses.length,
      scoredCount: scoredCards.length,
      returnedCount: returnedCards.length,
      minScore,
      targetCount,
    },
    raw: includeRaw
      ? {
          detector: detector.rawOutput,
          originalLanguageForScorer: originalLanguage.formatted,
        }
      : undefined,
  };
}

