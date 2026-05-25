import { createAdminClient } from "@/lib/supabase/server";

export type PublishedLensId = "pearl" | "lexicon" | "context" | "translations";
export type PublishedLensLang = "ru" | "en" | "es";
export type PublishedLensSetStatus = "published" | "draft" | "archived";
export type PublishedLensCardStatus = "published" | "hidden" | "draft";

export type PublishedLensSetRow = {
  id: string;
  canonical_ref: string;
  reference_label: string | null;
  lang: PublishedLensLang;
  lens_id: PublishedLensId;
  status: PublishedLensSetStatus;
  version: number;
  source_pipeline: string | null;
  source_model: string | null;
  generated_at: string | null;
  published_at: string | null;
  manually_edited_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublishedLensCardRow = {
  id: string;
  set_id: string;
  position: number;
  title: string;
  anchor: string | null;
  teaser: string | null;
  body: string | null;
  why_it_matters: string | null;
  score: number | null;
  claim_type: string | null;
  weakness_root: string | null;
  scorer_reasoning: string | null;
  weakness_detail: string | null;
  source_angle: unknown | null;
  raw_card: unknown | null;
  raw_score: unknown | null;
  status: PublishedLensCardStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublishedLensSetWithCards = {
  set: PublishedLensSetRow;
  cards: PublishedLensCardRow[];
};

export type PublishedLensCardInput = {
  title: string;
  anchor?: string | null;
  teaser?: string | null;
  body?: string | null;
  why_it_matters?: string | null;
  score?: number | null;
  claim_type?: string | null;
  weakness_root?: string | null;
  scorer_reasoning?: string | null;
  weakness_detail?: string | null;
  source_angle?: unknown | null;
  raw_card?: unknown | null;
  raw_score?: unknown | null;
  status?: PublishedLensCardStatus;
  metadata?: Record<string, unknown>;
};

export type SavePublishedLensSetArgs = {
  canonicalRef: string;
  referenceLabel?: string | null;
  lang: PublishedLensLang;
  lensId: PublishedLensId;
  sourcePipeline?: string | null;
  sourceModel?: string | null;
  generatedAt?: string | null;
  metadata?: Record<string, unknown>;
  cards: PublishedLensCardInput[];
};

export type GetPublishedLensSetArgs = {
  canonicalRef: string;
  lang: PublishedLensLang;
  lensId: PublishedLensId;
  includeHidden?: boolean;
};

export type PublishedLensResult<T> = {
  data: T | null;
  error: string | null;
};

type UnknownRecord = Record<string, unknown>;

export function uiLensToPublishedLens(lensId: string): PublishedLensId | null {
  if (lensId === "angles") return "pearl";
  if (lensId === "word") return "lexicon";
  if (lensId === "context") return "context";
  if (lensId === "translations") return "translations";
  return null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  const s = cleanString(value);
  return s ? s : null;
}

function optionalNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function normalizeScore(value: unknown): number | null {
  const n = optionalNumber(value);
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeCardInput(card: PublishedLensCardInput, index: number) {
  return {
    position: index + 1,
    title: cleanString(card.title),
    anchor: optionalString(card.anchor),
    teaser: optionalString(card.teaser),
    body: optionalString(card.body),
    why_it_matters: optionalString(card.why_it_matters),
    score: normalizeScore(card.score),
    claim_type: optionalString(card.claim_type),
    weakness_root: optionalString(card.weakness_root),
    scorer_reasoning: optionalString(card.scorer_reasoning),
    weakness_detail: optionalString(card.weakness_detail),
    source_angle: card.source_angle ?? null,
    raw_card: card.raw_card ?? null,
    raw_score: card.raw_score ?? null,
    status: card.status ?? "published",
    metadata: card.metadata ?? {},
  };
}

export async function getPublishedLensSet(
  args: GetPublishedLensSetArgs
): Promise<PublishedLensResult<PublishedLensSetWithCards>> {
  const client = createAdminClient();

  if (!client) {
    return {
      data: null,
      error: "Supabase admin client is unavailable.",
    };
  }

  const { data: set, error: setError } = await client
    .from("published_lens_sets")
    .select("*")
    .eq("canonical_ref", args.canonicalRef)
    .eq("lang", args.lang)
    .eq("lens_id", args.lensId)
    .eq("status", "published")
    .maybeSingle();

  if (setError) {
    return {
      data: null,
      error: setError.message,
    };
  }

  if (!set) {
    return {
      data: null,
      error: null,
    };
  }

  let cardsQuery = client
    .from("published_lens_cards")
    .select("*")
    .eq("set_id", set.id)
    .order("position", { ascending: true });

  if (!args.includeHidden) {
    cardsQuery = cardsQuery.eq("status", "published");
  }

  const { data: cards, error: cardsError } = await cardsQuery;

  if (cardsError) {
    return {
      data: null,
      error: cardsError.message,
    };
  }

  return {
    data: {
      set: set as PublishedLensSetRow,
      cards: (cards ?? []) as PublishedLensCardRow[],
    },
    error: null,
  };
}

export async function savePublishedLensSet(
  args: SavePublishedLensSetArgs
): Promise<PublishedLensResult<PublishedLensSetWithCards>> {
  const client = createAdminClient();

  if (!client) {
    return {
      data: null,
      error: "Supabase admin client is unavailable.",
    };
  }

  const cleanedCards = args.cards
    .map(normalizeCardInput)
    .filter((card) => card.title.length > 0);

  if (cleanedCards.length === 0) {
    return {
      data: null,
      error: "Cannot save a published lens set without cards.",
    };
  }

  const { data: existingSet, error: existingError } = await client
    .from("published_lens_sets")
    .select("id, version")
    .eq("canonical_ref", args.canonicalRef)
    .eq("lang", args.lang)
    .eq("lens_id", args.lensId)
    .maybeSingle();

  if (existingError) {
    return {
      data: null,
      error: existingError.message,
    };
  }

  const nextVersion =
    existingSet && typeof existingSet.version === "number"
      ? existingSet.version + 1
      : 1;

  const now = new Date().toISOString();

  const { data: savedSet, error: setError } = await client
    .from("published_lens_sets")
    .upsert(
      {
        canonical_ref: args.canonicalRef,
        reference_label: args.referenceLabel ?? null,
        lang: args.lang,
        lens_id: args.lensId,
        status: "published",
        version: nextVersion,
        source_pipeline: args.sourcePipeline ?? null,
        source_model: args.sourceModel ?? null,
        generated_at: args.generatedAt ?? now,
        published_at: now,
        metadata: args.metadata ?? {},
      },
      {
        onConflict: "canonical_ref,lang,lens_id",
      }
    )
    .select("*")
    .single();

  if (setError) {
    return {
      data: null,
      error: setError.message,
    };
  }

  const { error: deleteError } = await client
    .from("published_lens_cards")
    .delete()
    .eq("set_id", savedSet.id);

  if (deleteError) {
    return {
      data: null,
      error: deleteError.message,
    };
  }

  const cardsToInsert = cleanedCards.map((card) => ({
    ...card,
    set_id: savedSet.id,
  }));

  const { data: savedCards, error: cardsError } = await client
    .from("published_lens_cards")
    .insert(cardsToInsert)
    .select("*")
    .order("position", { ascending: true });

  if (cardsError) {
    return {
      data: null,
      error: cardsError.message,
    };
  }

  return {
    data: {
      set: savedSet as PublishedLensSetRow,
      cards: (savedCards ?? []) as PublishedLensCardRow[],
    },
    error: null,
  };
}

export function mapPearlV3ResultToPublishedCards(result: unknown): PublishedLensCardInput[] {
  const root = asRecord(result);
  const scoredCards = Array.isArray(root.scoredCards) ? root.scoredCards : [];
  const cards: PublishedLensCardInput[] = [];

  for (const item of scoredCards) {
    const itemRecord = asRecord(item);
    const card = asRecord(itemRecord.card);
    const score = asRecord(itemRecord.score);
    const suggestedStatus = cleanString(itemRecord.suggestedStatus);

    if (suggestedStatus === "rejected") {
      continue;
    }

    const finalScore = normalizeScore(score.score);

    if (finalScore !== null && finalScore < 70) {
      continue;
    }

    const mappedCard: PublishedLensCardInput = {
      title: cleanString(card.title),
      anchor: optionalString(card.anchor),
      teaser: optionalString(card.teaser) ?? optionalString(card.body),
      body: optionalString(card.body) ?? optionalString(card.teaser),
      why_it_matters:
        optionalString(card.why_it_matters) ?? optionalString(card.whyMatters),
      score: finalScore,
      claim_type: optionalString(score.claimType),
      weakness_root: optionalString(score.weaknessRoot),
      scorer_reasoning: optionalString(score.reasoning),
      weakness_detail: optionalString(score.weaknessDetail),
      source_angle: itemRecord.angle ?? null,
      raw_card: card,
      raw_score: score,
      status: "published",
      metadata: {
        suggestedStatus,
      },
    };

    if (mappedCard.title.trim().length > 0) {
      cards.push(mappedCard);
    }
  }

  return cards;
}

export function publishedCardsToAngleCardsJson(cards: PublishedLensCardRow[]): string {
  const angleCards = cards.map((card) => ({
    title: card.title,
    teaser: card.teaser ?? card.body ?? "",
    anchor: card.anchor ?? "",
    why_it_matters: card.why_it_matters ?? "",
  }));

  return JSON.stringify(angleCards, null, 2);
}


