import "server-only";

import type {
  PearlV3CardDraft,
  PearlV3PublicCard,
  PearlV3ScoreResult,
  PearlV3SuggestedStatus,
} from "./types";

export function getSuggestedStatus(
  score: PearlV3ScoreResult,
): PearlV3SuggestedStatus {
  if (score.score >= 82) return "featured";

  if (score.score >= 70) {
    return score.weaknessRoot === "execution" ? "rewrite" : "reserve";
  }

  return "rejected";
}

export function adaptPearlV3CardToPublicAngleCard(
  card: PearlV3CardDraft,
): PearlV3PublicCard {
  return {
    title: card.title.trim(),
    anchor: card.anchor.trim(),
    teaser: card.teaser.trim(),
    why_it_matters: card.why_it_matters.trim(),
  };
}
