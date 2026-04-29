import { runAI, resolveAIModel } from "@/lib/ai/runAI";
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
  editor_provider: Provider;
  editor_model: string;
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

type EvaluatedCard = {
  card: AngleCardRow;
  evaluation: EvaluationObject | null;
  score: number;
  placement: string | null;
  battleWinner: string | null;
  battleAction: string | null;
  reason: string;
  newStatus: AngleCardStatus;
};

const FEATURED_SCORE_THRESHOLD = 82;
const RESERVE_SCORE_THRESHOLD = 70;

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
  if (!evaluation) return "Evaluator failed; preserved with previous score.";
  return getString(evaluation.reason) ?? "No evaluator reason.";
}

function getEvaluationBattle(evaluation: EvaluationObject | null): Record<string, unknown> | null {
  if (!evaluation) return null;
  return isRecord(evaluation.battle) ? evaluation.battle : null;
}

function getBattleWinner(evaluation: EvaluationObject | null): string | null {
  const battle = getEvaluationBattle(evaluation);
  if (!battle) return null;

  const winner = getString(battle.winner);
  return winner ? winner.trim().toLowerCase() : null;
}

function getBattleAction(evaluation: EvaluationObject | null): string | null {
  const battle = getEvaluationBattle(evaluation);
  if (!battle) return null;

  const action = getString(battle.battle_action);
  return action ? action.trim().toLowerCase() : null;
}

function normalizePlacement(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function isEligibleForAutoRebalance(card: AngleCardRow): boolean {
  if (card.is_locked) return false;

  return card.status === "featured" || card.status === "reserve";
}

function isComparableCard(card: AngleCardRow): boolean {
  if (card.is_locked) return true;

  return card.status === "featured" || card.status === "reserve";
}

function chooseStatusFromEvaluation(args: {
  score: number;
  placement: string | null;
  battleWinner: string | null;
  battleAction: string | null;
}): AngleCardStatus {
  const placement = normalizePlacement(args.placement);
  const battleWinner = args.battleWinner;
  const battleAction = args.battleAction;
  const score = args.score;

  if (placement === "reject" || placement === "rejected") {
    return "rejected";
  }

  if (placement === "hidden") {
    return "hidden";
  }

  if (battleAction === "keep_existing_hide_candidate") {
    return "hidden";
  }

  if (placement === "rewrite") {
    return "reserve";
  }

  if (placement === "needs_human_review") {
    return "reserve";
  }

  if (placement === "reserve") {
    return "reserve";
  }

  if (
    battleWinner === "matched" ||
    battleAction === "keep_existing_send_candidate_to_reserve"
  ) {
    return score >= RESERVE_SCORE_THRESHOLD ? "reserve" : "hidden";
  }

  if (
    (placement === "featured_new" || placement === "replace_existing") &&
    score >= FEATURED_SCORE_THRESHOLD
  ) {
    return "featured";
  }

  if (score >= FEATURED_SCORE_THRESHOLD) {
    return "featured";
  }

  if (score >= RESERVE_SCORE_THRESHOLD) {
    return "reserve";
  }

  return "hidden";
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

async function applyDecisionToDatabase(args: {
  decision: RebalanceCardDecision;
  provider: Provider;
}): Promise<{
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
    status: args.decision.new_status,
    rank: args.decision.new_rank,
    score_total: args.decision.new_score,
    evaluation: args.decision.evaluation,
    editor_provider: args.provider,
    editor_model: resolveAIModel(args.provider),
    moderator_decision: "auto_rebalance_threshold_v2",
    updated_at: new Date().toISOString(),
  };

  if (args.decision.translation_group_id) {
    const { error } = await client
      .from("angle_cards")
      .update(patch)
      .eq("translation_group_id", args.decision.translation_group_id);

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
    .eq("id", args.decision.card_id);

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

function buildDecisions(evaluated: EvaluatedCard[]): RebalanceCardDecision[] {
  const featuredItems = evaluated
    .filter((item) => item.newStatus === "featured")
    .sort((a, b) => b.score - a.score);

  const rankByCardId = new Map<string, number>();

  featuredItems.forEach((item, index) => {
    rankByCardId.set(item.card.id, index + 1);
  });

  return evaluated.map((item, index) => {
    const newRank =
      item.newStatus === "featured"
        ? rankByCardId.get(item.card.id) ?? null
        : null;

    return {
      card_id: item.card.id,
      translation_group_id: item.card.translation_group_id,
      title: item.card.title,
      old_status: item.card.status,
      old_rank: item.card.rank,
      old_score: item.card.score_total,
      new_status: item.newStatus,
      new_rank: newRank,
      new_score: item.score,
      is_locked: item.card.is_locked,
      reason:
        item.reason ||
        `Auto rebalance decision #${index + 1}: ${item.newStatus}.`,
      evaluation: item.evaluation,
    };
  });
}

export async function rebalanceVerseCards(
  args: RebalanceArgs,
): Promise<RebalanceResult> {
  const provider = args.provider ?? "claude";
  const editorModel = resolveAIModel(provider);

  const targetFeaturedCount = args.targetFeaturedCount ?? 100;
  const maxCards = args.maxCards ?? 48;
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
      editor_provider: provider,
      editor_model: editorModel,
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

  const evaluated: EvaluatedCard[] = [];
  const errors: string[] = [];

  for (const card of eligibleCards) {
    try {
      const otherCards = allCards.filter(
        (other) => other.id !== card.id && isComparableCard(other),
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
      const battleWinner = getBattleWinner(evaluation);
      const battleAction = getBattleAction(evaluation);

      const newStatus = chooseStatusFromEvaluation({
        score,
        placement,
        battleWinner,
        battleAction,
      });

      evaluated.push({
        card,
        evaluation,
        score,
        placement,
        battleWinner,
        battleAction,
        reason: getEvaluationReason(evaluation),
        newStatus,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to evaluate card";

      errors.push(`${card.id}: ${message}`);

      const fallbackScore = card.score_total ?? 0;

      evaluated.push({
        card,
        evaluation: null,
        score: fallbackScore,
        placement: null,
        battleWinner: null,
        battleAction: null,
        reason: "Evaluator failed; preserved with previous score.",
        newStatus:
          fallbackScore >= FEATURED_SCORE_THRESHOLD
            ? "featured"
            : fallbackScore >= RESERVE_SCORE_THRESHOLD
              ? "reserve"
              : "hidden",
      });
    }
  }

  const decisions = buildDecisions(evaluated);

  const changedDecisions = decisions.filter((decision) => {
    return (
      decision.old_status !== decision.new_status ||
      decision.old_rank !== decision.new_rank ||
      decision.old_score !== decision.new_score
    );
  });

  if (apply) {
    for (const decision of changedDecisions) {
      const result = await applyDecisionToDatabase({
        decision,
        provider,
      });

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
    editor_provider: provider,
    editor_model: editorModel,
    target_featured_count: targetFeaturedCount,
    total_cards_seen: allCards.length,
    eligible_cards_count: eligibleCards.length,
    locked_cards_count: lockedCards.length,
    changed_count: changedDecisions.length,
    decisions,
    errors,
  };
}
