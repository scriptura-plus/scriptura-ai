import { runAI } from "@/lib/ai/runAI";
import { type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { buildEvaluateAnglePrompt } from "@/lib/prompts/buildEvaluateAnglePrompt";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getAllStudioCardsForVerse,
  type AngleCardLang,
  type AngleCardRow,
  type AngleCardStatus,
} from "@/lib/cache/angleCards";

type EvaluationObject = Record<string, unknown>;

type RebalanceCardDecision = {
  card_id: string;
  translation_group_id: string | null;
  title: string;
  old_status: AngleCardStatus;
  old_rank: number | null;
  old_score: number | null;
  new_status: AngleCardStatus;
  new_rank: number | null;
  new_score: number | null;
  is_locked: boolean;
  reason: string;
  evaluation: EvaluationObject | null;
};

type RebalanceResult = {
  ok: boolean;
  applied: boolean;
  reference: string;
  canonical_ref: string | null;
  lang: AngleCardLang;
  target_featured_count: number;
  total_cards_seen: number;
  eligible_cards_count: number;
  locked_cards_count: number;
  changed_count: number;
  decisions: RebalanceCardDecision[];
  errors: string[];
};

type RebalanceArgs = {
  reference: string;
  lang: AngleCardLang;
  canonical_ref?: string | null;
  verseText?: string | null;
  provider?: Provider;
  targetFeaturedCount?: number;
  maxCards?: number;
  apply?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): EvaluationObject {
  const stripped = stripCodeFence(text);

  try {
    const parsed = JSON.parse(stripped);
    if (isRecord(parsed)) return parsed;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      const parsed = JSON.parse(stripped.slice(start, end + 1));
      if (isRecord(parsed)) return parsed;
    }
  }

  throw new Error("Evaluator returned non-JSON response");
}

function getEffectiveScore(card: AngleCardRow): number {
  return (card.score_total ?? 0) + (card.moderator_boost ?? 0);
}

function toEvaluatorCard(card: AngleCardRow) {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor ?? undefined,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? undefined,
    score_total: card.score_total ?? undefined,
    status: card.status,
    is_locked: card.is_locked,
    angle_summary: card.angle_summary ?? undefined,
  };
}

function getEvaluationScore(evaluation: EvaluationObject | null): number | null {
  if (!evaluation) return null;
  return getNumber(evaluation.score_total);
}

function getEvaluationPlacement(evaluation: EvaluationObject | null): string | null {
  if (!evaluation) return null;
  return getString(evaluation.placement);
}

function getEvaluationReason(evaluation: EvaluationObject | null): string {
  if (!evaluation) return "No evaluator reason.";
  return getString(evaluation.reason) ?? "No evaluator reason.";
}

function placementToHardStatus(placement: string | null): AngleCardStatus | null {
  if (!placement) return null;

  const normalized = placement.trim().toLowerCase();

  if (normalized === "hidden") return "hidden";
  if (normalized === "reject" || normalized === "rejected") return "rejected";

  return null;
}

function isEligibleForAutoRebalance(card: AngleCardRow): boolean {
  if (card.is_locked) return false;

  return card.status === "featured" || card.status === "reserve";
}

function isProtectedFromAutoRebalance(card: AngleCardRow): boolean {
  if (card.is_locked) return true;
  if (card.status === "rejected") return true;
  if (card.status === "hidden") return true;
  if (card.status === "rewrite") return true;

  return false;
}

async function resolveVerseText(args: {
  reference: string;
  lang: AngleCardLang;
  provider: Provider;
  verseText?: string | null;
}): Promise<string> {
  if (args.verseText && args.verseText.trim()) {
    return args.verseText.trim();
  }

  const verse = await getVerseText(args.reference, args.lang, args.provider);
  return verse.text;
}

async function evaluateCardInCurrentSet(args: {
  reference: string;
  verseText: string;
  lang: AngleCardLang;
  card: AngleCardRow;
  otherCards: AngleCardRow[];
  provider: Provider;
  targetFeaturedCount: number;
}): Promise<EvaluationObject> {
  const featuredCards = args.otherCards.filter(
    (card) => card.status === "featured",
  );

  const reserveCards = args.otherCards.filter(
    (card) => card.status === "reserve",
  );

  const prompt = buildEvaluateAnglePrompt({
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    candidate: toEvaluatorCard(args.card),
    featuredCards: featuredCards.map(toEvaluatorCard),
    reserveCards: reserveCards.map(toEvaluatorCard),
    targetFeaturedCount: args.targetFeaturedCount,
  });

  const text = await runAI(args.provider, prompt, args.lang, true);
  return extractJsonObject(text);
}

async function applyDecisionToDatabase(decision: RebalanceCardDecision): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      error: "Supabase admin client unavailable",
    };
  }

  const patch = {
    status: decision.new_status,
    rank: decision.new_rank,
    score_total: decision.new_score,
    evaluation: decision.evaluation,
    moderator_decision: "auto_rebalance_v1",
    updated_at: new Date().toISOString(),
  };

  if (decision.translation_group_id) {
    const { error } = await client
      .from("angle_cards")
      .update(patch)
      .eq("translation_group_id", decision.translation_group_id);

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: true,
      error: null,
    };
  }

  const { error } = await client
    .from("angle_cards")
    .update(patch)
    .eq("id", decision.card_id);

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    error: null,
  };
}

export async function rebalanceVerseCards(
  args: RebalanceArgs,
): Promise<RebalanceResult> {
  const provider = args.provider ?? "openai";
  const targetFeaturedCount = args.targetFeaturedCount ?? 12;
  const maxCards = args.maxCards ?? 24;
  const apply = args.apply ?? false;

  const existing = await getAllStudioCardsForVerse({
    reference: args.reference,
    canonical_ref: args.canonical_ref ?? null,
    lang: args.lang,
    limit: Math.max(maxCards, 100),
  });

  if (!existing.ok) {
    return {
      ok: false,
      applied: false,
      reference: args.reference,
      canonical_ref: args.canonical_ref ?? null,
      lang: args.lang,
      target_featured_count: targetFeaturedCount,
      total_cards_seen: 0,
      eligible_cards_count: 0,
      locked_cards_count: 0,
      changed_count: 0,
      decisions: [],
      errors: [existing.error ?? "Failed to read cards"],
    };
  }

  const allCards = existing.cards;
  const lockedCards = allCards.filter((card) => card.is_locked);
  const eligibleCards = allCards
    .filter(isEligibleForAutoRebalance)
    .sort((a, b) => getEffectiveScore(b) - getEffectiveScore(a))
    .slice(0, maxCards);

  const verseText = await resolveVerseText({
    reference: args.reference,
    lang: args.lang,
    provider,
    verseText: args.verseText,
  });

  const evaluated: Array<{
    card: AngleCardRow;
    evaluation: EvaluationObject | null;
    score: number;
    hardStatus: AngleCardStatus | null;
    reason: string;
  }> = [];

  const errors: string[] = [];

  for (const card of eligibleCards) {
    try {
      const otherCards = allCards.filter(
        (other) =>
          other.id !== card.id &&
          !isProtectedFromAutoRebalance(other) &&
          (other.status === "featured" || other.status === "reserve"),
      );

      const evaluation = await evaluateCardInCurrentSet({
        reference: args.reference,
        verseText,
        lang: args.lang,
        card,
        otherCards,
        provider,
        targetFeaturedCount,
      });

      const score = getEvaluationScore(evaluation) ?? card.score_total ?? 0;
      const placement = getEvaluationPlacement(evaluation);
      const hardStatus = placementToHardStatus(placement);

      evaluated.push({
        card,
        evaluation,
        score,
        hardStatus,
        reason: getEvaluationReason(evaluation),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to evaluate card";

      errors.push(`${card.id}: ${message}`);

      evaluated.push({
        card,
        evaluation: null,
        score: card.score_total ?? 0,
        hardStatus: null,
        reason: "Evaluator failed; preserved with previous score.",
      });
    }
  }

  const lockedFeaturedCount = lockedCards.filter(
    (card) => card.status === "featured",
  ).length;

  const featuredSlots = Math.max(0, targetFeaturedCount - lockedFeaturedCount);

  const stillEligible = evaluated
    .filter((item) => item.hardStatus === null)
    .sort((a, b) => b.score - a.score);

  const promotedIds = new Set(
    stillEligible.slice(0, featuredSlots).map((item) => item.card.id),
  );

  const decisions: RebalanceCardDecision[] = evaluated.map((item, index) => {
    const hardStatus = item.hardStatus;

    const newStatus: AngleCardStatus = hardStatus
      ? hardStatus
      : promotedIds.has(item.card.id)
        ? "featured"
        : "reserve";

    const newRank =
      newStatus === "featured"
        ? Array.from(promotedIds).indexOf(item.card.id) + 1
        : null;

    return {
      card_id: item.card.id,
      translation_group_id: item.card.translation_group_id,
      title: item.card.title,
      old_status: item.card.status,
      old_rank: item.card.rank,
      old_score: item.card.score_total,
      new_status: newStatus,
      new_rank: newRank > 0 ? newRank : null,
      new_score: item.score,
      is_locked: item.card.is_locked,
      reason:
        item.reason ||
        `Auto rebalance decision #${index + 1}: ${newStatus}.`,
      evaluation: item.evaluation,
    };
  });

  const changedDecisions = decisions.filter((decision) => {
    return (
      decision.old_status !== decision.new_status ||
      decision.old_rank !== decision.new_rank ||
      decision.old_score !== decision.new_score
    );
  });

  if (apply) {
    for (const decision of changedDecisions) {
      const result = await applyDecisionToDatabase(decision);

      if (!result.ok) {
        errors.push(
          `${decision.card_id}: ${result.error ?? "Failed to apply decision"}`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    applied: apply,
    reference: args.reference,
    canonical_ref: args.canonical_ref ?? null,
    lang: args.lang,
    target_featured_count: targetFeaturedCount,
    total_cards_seen: allCards.length,
    eligible_cards_count: eligibleCards.length,
    locked_cards_count: lockedCards.length,
    changed_count: changedDecisions.length,
    decisions,
    errors,
  };
}
