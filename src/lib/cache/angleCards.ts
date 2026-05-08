import { createAdminClient } from "@/lib/supabase/server";

export type AngleCardStatus =
  | "featured"
  | "reserve"
  | "rewrite"
  | "hidden"
  | "rejected";

export type AngleCardCoverageType =
  | "lexical"
  | "grammatical"
  | "structural"
  | "contextual"
  | "translation"
  | "rhetorical"
  | "historical"
  | "conceptual"
  | "other";

export type AngleCardLang = "ru" | "en" | "es";

export type AngleCardInput = {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: AngleCardLang;

  canonical_ref?: string | null;
  book_key?: string | null;
  translation_group_id?: string | null;
  origin_lang?: AngleCardLang | null;

  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;

  angle_summary?: string | null;
  coverage_type?: AngleCardCoverageType | null;

  score_total?: number | null;
  scores?: unknown;
  evaluation?: unknown;
  battle?: unknown;

  status: AngleCardStatus;
  rank?: number | null;
  is_locked?: boolean;

  moderator_boost?: number | null;
  moderator_note?: string | null;
  moderator_decision?: string | null;
  moderator_reviewed_at?: string | null;

  source_type?: string;
  source_provider?: string | null;
  source_model?: string | null;

  editor_provider?: string | null;
  editor_model?: string | null;

  original_card?: unknown;
  rewritten_from_card_id?: string | null;
  replaced_card_id?: string | null;

  prompt_version?: string;
};

export type AngleCardRow = {
  id: string;

  reference: string;
  book: string;
  chapter: number;
  verse: number;

  lang: AngleCardLang;

  canonical_ref: string | null;
  book_key: string | null;
  translation_group_id: string | null;
  origin_lang: AngleCardLang | null;

  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;

  angle_summary: string | null;
  coverage_type: AngleCardCoverageType | null;

  score_total: number | null;
  scores: unknown | null;
  evaluation: unknown | null;
  battle: unknown | null;

  status: AngleCardStatus;
  rank: number | null;

  is_locked: boolean;

  moderator_boost: number;
  moderator_note: string | null;
  moderator_decision: string | null;
  moderator_reviewed_at: string | null;

  source_type: string;
  source_provider: string | null;
  source_model: string | null;

  editor_provider: string | null;
  editor_model: string | null;

  original_card: unknown | null;
  rewritten_from_card_id: string | null;
  replaced_card_id: string | null;

  prompt_version: string;

  created_at: string;
  updated_at: string;
};

export type PublicAngleCard = {
  id: string;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  score_total: number | null;
  status: AngleCardStatus;
  coverage_type: AngleCardCoverageType | null;
};

export type StudioVerseSummary = {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: AngleCardLang;
  canonical_ref: string | null;
  book_key: string | null;
  total_count: number;
  featured_count: number;
  reserve_count: number;
  hidden_count: number;
  rejected_count: number;
  best_score: number | null;
  sources: string[];
  last_activity_at: string;
};

function getEffectiveScore(
  card: Pick<AngleCardRow, "score_total" | "moderator_boost">,
): number {
  return (card.score_total ?? 0) + (card.moderator_boost ?? 0);
}

function getStatusWeight(status: AngleCardStatus): number {
  if (status === "featured") return 1;
  if (status === "reserve") return 2;
  if (status === "rewrite") return 3;
  if (status === "hidden") return 4;
  if (status === "rejected") return 5;
  return 99;
}

function sortAngleCards(cards: AngleCardRow[]): AngleCardRow[] {
  return [...cards].sort((a, b) => {
    const statusDiff = getStatusWeight(a.status) - getStatusWeight(b.status);
    if (statusDiff !== 0) return statusDiff;

    const aHasRank = typeof a.rank === "number";
    const bHasRank = typeof b.rank === "number";

    if (aHasRank && bHasRank && a.rank !== b.rank) {
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    }

    if (aHasRank && !bHasRank) return -1;
    if (!aHasRank && bHasRank) return 1;

    const scoreDiff = getEffectiveScore(b) - getEffectiveScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    return a.created_at.localeCompare(b.created_at);
  });
}

function applyLimit(cards: AngleCardRow[], limit?: number): AngleCardRow[] {
  return cards.slice(0, limit ?? 24);
}

export async function saveAngleCard(input: AngleCardInput): Promise<{
  ok: boolean;
  id: string | null;
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      id: null,
      error: "Supabase admin client unavailable",
    };
  }

  const { data, error } = await client
    .from("angle_cards")
    .insert({
      reference: input.reference,
      book: input.book,
      chapter: input.chapter,
      verse: input.verse,
      lang: input.lang,

      canonical_ref: input.canonical_ref ?? null,
      book_key: input.book_key ?? null,
      translation_group_id: input.translation_group_id ?? null,
      origin_lang: input.origin_lang ?? input.lang,

      title: input.title,
      anchor: input.anchor ?? null,
      teaser: input.teaser,
      why_it_matters: input.why_it_matters ?? null,

      angle_summary: input.angle_summary ?? null,
      coverage_type: input.coverage_type ?? null,

      score_total: input.score_total ?? null,
      scores: input.scores ?? null,
      evaluation: input.evaluation ?? null,
      battle: input.battle ?? null,

      status: input.status,
      rank: input.rank ?? null,
      is_locked: input.is_locked ?? false,

      moderator_boost: input.moderator_boost ?? 0,
      moderator_note: input.moderator_note ?? null,
      moderator_decision: input.moderator_decision ?? null,
      moderator_reviewed_at: input.moderator_reviewed_at ?? null,

      source_type: input.source_type ?? "manual_test",
      source_provider: input.source_provider ?? null,
      source_model: input.source_model ?? null,

      editor_provider: input.editor_provider ?? null,
      editor_model: input.editor_model ?? null,

      original_card: input.original_card ?? null,
      rewritten_from_card_id: input.rewritten_from_card_id ?? null,
      replaced_card_id: input.replaced_card_id ?? null,

      prompt_version: input.prompt_version ?? "angle_cards_v1",
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      id: null,
      error: error.message,
    };
  }

  return {
    ok: true,
    id: data?.id ?? null,
    error: null,
  };
}

export async function getAngleCards(args: {
  reference: string;
  lang: AngleCardLang;
  statuses?: AngleCardStatus[];
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      cards: [],
      error: "Supabase admin client unavailable",
    };
  }

  const statuses = args.statuses ?? ["featured", "reserve"];
  const dbLimit = Math.max((args.limit ?? 24) * 4, 100);

  const { data, error } = await client
    .from("angle_cards")
    .select("*")
    .eq("reference", args.reference)
    .eq("lang", args.lang)
    .in("status", statuses)
    .order("status", { ascending: true })
    .order("rank", { ascending: true, nullsFirst: false })
    .order("score_total", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(dbLimit);

  if (error) {
    return {
      ok: false,
      cards: [],
      error: error.message,
    };
  }

  const sortedCards = sortAngleCards((data ?? []) as AngleCardRow[]);

  return {
    ok: true,
    cards: applyLimit(sortedCards, args.limit),
    error: null,
  };
}

export async function getAngleCardsByCanonicalRef(args: {
  canonical_ref: string;
  lang: AngleCardLang;
  statuses?: AngleCardStatus[];
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      cards: [],
      error: "Supabase admin client unavailable",
    };
  }

  const statuses = args.statuses ?? ["featured", "reserve"];
  const dbLimit = Math.max((args.limit ?? 24) * 4, 100);

  const { data, error } = await client
    .from("angle_cards")
    .select("*")
    .eq("canonical_ref", args.canonical_ref)
    .eq("lang", args.lang)
    .in("status", statuses)
    .order("status", { ascending: true })
    .order("rank", { ascending: true, nullsFirst: false })
    .order("score_total", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(dbLimit);

  if (error) {
    return {
      ok: false,
      cards: [],
      error: error.message,
    };
  }

  const sortedCards = sortAngleCards((data ?? []) as AngleCardRow[]);

  return {
    ok: true,
    cards: applyLimit(sortedCards, args.limit),
    error: null,
  };
}

type StudioSummarySeed = {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: AngleCardLang;
  canonical_ref: string | null;
  book_key: string | null;
  last_activity_at: string;
};

function getCardActivityAt(card: Pick<AngleCardRow, "created_at" | "updated_at">): string {
  return card.updated_at || card.created_at;
}

function summarizeStudioVerseCards(args: {
  seed: StudioSummarySeed;
  cards: AngleCardRow[];
}): StudioVerseSummary {
  const sources = new Set<string>();
  let bestScore: number | null = null;

  const summary: StudioVerseSummary = {
    reference: args.seed.reference,
    book: args.seed.book,
    chapter: args.seed.chapter,
    verse: args.seed.verse,
    lang: args.seed.lang,
    canonical_ref: args.seed.canonical_ref,
    book_key: args.seed.book_key,
    total_count: args.cards.length,
    featured_count: 0,
    reserve_count: 0,
    hidden_count: 0,
    rejected_count: 0,
    best_score: null,
    sources: [],
    last_activity_at: args.seed.last_activity_at,
  };

  for (const card of args.cards) {
    if (card.status === "featured") summary.featured_count += 1;
    if (card.status === "reserve") summary.reserve_count += 1;
    if (card.status === "hidden") summary.hidden_count += 1;
    if (card.status === "rejected") summary.rejected_count += 1;

    if (card.canonical_ref && !summary.canonical_ref) {
      summary.canonical_ref = card.canonical_ref;
    }

    if (card.book_key && !summary.book_key) {
      summary.book_key = card.book_key;
    }

    if (typeof card.score_total === "number") {
      const effectiveScore = getEffectiveScore(card);
      if (bestScore === null || effectiveScore > bestScore) {
        bestScore = effectiveScore;
      }
    }

    const source =
      card.source_model?.replace("article_extractor_v1:", "") ||
      card.source_type ||
      "unknown";

    if (source) sources.add(source);

    const activityAt = getCardActivityAt(card);
    if (activityAt > summary.last_activity_at) {
      summary.last_activity_at = activityAt;
    }
  }

  summary.best_score = bestScore;
  summary.sources = Array.from(sources);

  return summary;
}

async function loadAllStudioCardsForSummary(args: {
  reference: string;
  canonical_ref: string | null;
  lang: AngleCardLang;
}): Promise<{
  cards: AngleCardRow[];
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      cards: [],
      error: "Supabase admin client unavailable",
    };
  }

  const statuses: AngleCardStatus[] = [
    "featured",
    "reserve",
    "rewrite",
    "hidden",
    "rejected",
  ];

  let query = client
    .from("angle_cards")
    .select("*")
    .eq("lang", args.lang)
    .in("status", statuses)
    .limit(1000);

  if (args.canonical_ref) {
    query = query.eq("canonical_ref", args.canonical_ref);
  } else {
    query = query.eq("reference", args.reference);
  }

  const { data, error } = await query;

  if (error) {
    return {
      cards: [],
      error: error.message,
    };
  }

  const cards = ((data ?? []) as AngleCardRow[]).filter((card) => {
    if (args.canonical_ref) {
      return card.canonical_ref === args.canonical_ref;
    }

    return card.reference === args.reference;
  });

  if (cards.length > 0 || !args.canonical_ref) {
    return {
      cards,
      error: null,
    };
  }

  const fallback = await client
    .from("angle_cards")
    .select("*")
    .eq("reference", args.reference)
    .eq("lang", args.lang)
    .in("status", statuses)
    .limit(1000);

  if (fallback.error) {
    return {
      cards,
      error: fallback.error.message,
    };
  }

  return {
    cards: (fallback.data ?? []) as AngleCardRow[],
    error: null,
  };
}

export async function getStudioVerseSummaries(args: {
  lang: AngleCardLang;
  days?: number;
  limit?: number;
}): Promise<{
  ok: boolean;
  verses: StudioVerseSummary[];
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      verses: [],
      error: "Supabase admin client unavailable",
    };
  }

  const days = args.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("angle_cards")
    .select(
      "reference, book, chapter, verse, lang, canonical_ref, book_key, created_at, updated_at",
    )
    .eq("lang", args.lang)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    return {
      ok: false,
      verses: [],
      error: error.message,
    };
  }

  const seeds = new Map<string, StudioSummarySeed>();

  for (const row of data ?? []) {
    const card = row as {
      reference: string;
      book: string;
      chapter: number;
      verse: number;
      lang: AngleCardLang;
      canonical_ref: string | null;
      book_key: string | null;
      created_at: string;
      updated_at: string;
    };

    const groupKey = card.canonical_ref || card.reference;
    const key = `${card.lang}::${groupKey}`;
    const activityAt = card.updated_at || card.created_at;
    const existing = seeds.get(key);

    if (!existing) {
      seeds.set(key, {
        reference: card.reference,
        book: card.book,
        chapter: card.chapter,
        verse: card.verse,
        lang: card.lang,
        canonical_ref: card.canonical_ref,
        book_key: card.book_key,
        last_activity_at: activityAt,
      });
      continue;
    }

    if (!existing.canonical_ref && card.canonical_ref) {
      existing.canonical_ref = card.canonical_ref;
    }

    if (!existing.book_key && card.book_key) {
      existing.book_key = card.book_key;
    }

    if (activityAt > existing.last_activity_at) {
      existing.reference = card.reference;
      existing.book = card.book;
      existing.chapter = card.chapter;
      existing.verse = card.verse;
      existing.last_activity_at = activityAt;
    }
  }

  const sortedSeeds = Array.from(seeds.values())
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    .slice(0, args.limit ?? 50);

  const summaries: StudioVerseSummary[] = [];

  for (const seed of sortedSeeds) {
    const result = await loadAllStudioCardsForSummary({
      reference: seed.reference,
      canonical_ref: seed.canonical_ref,
      lang: seed.lang,
    });

    if (result.error) {
      return {
        ok: false,
        verses: [],
        error: result.error,
      };
    }

    summaries.push(
      summarizeStudioVerseCards({
        seed,
        cards: result.cards,
      }),
    );
  }

  return {
    ok: true,
    verses: summaries.sort((a, b) =>
      b.last_activity_at.localeCompare(a.last_activity_at),
    ),
    error: null,
  };
}

export async function getAllStudioCardsForVerse(args: {
  reference: string;
  lang: AngleCardLang;
  canonical_ref?: string | null;
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
  if (args.canonical_ref) {
    return getAngleCardsByCanonicalRef({
      canonical_ref: args.canonical_ref,
      lang: args.lang,
      statuses: ["featured", "reserve", "rewrite", "hidden", "rejected"],
      limit: args.limit ?? 100,
    });
  }

  return getAngleCards({
    reference: args.reference,
    lang: args.lang,
    statuses: ["featured", "reserve", "rewrite", "hidden", "rejected"],
    limit: args.limit ?? 100,
  });
}

export async function getFeaturedAngleCards(args: {
  reference: string;
  lang: AngleCardLang;
  canonical_ref?: string | null;
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
  if (args.canonical_ref) {
    return getAngleCardsByCanonicalRef({
      canonical_ref: args.canonical_ref,
      lang: args.lang,
      statuses: ["featured"],
      limit: args.limit ?? 12,
    });
  }

  return getAngleCards({
    reference: args.reference,
    lang: args.lang,
    statuses: ["featured"],
    limit: args.limit ?? 12,
  });
}

export async function getReserveAngleCards(args: {
  reference: string;
  lang: AngleCardLang;
  canonical_ref?: string | null;
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
  if (args.canonical_ref) {
    return getAngleCardsByCanonicalRef({
      canonical_ref: args.canonical_ref,
      lang: args.lang,
      statuses: ["reserve"],
      limit: args.limit ?? 24,
    });
  }

  return getAngleCards({
    reference: args.reference,
    lang: args.lang,
    statuses: ["reserve"],
    limit: args.limit ?? 24,
  });
}

export async function getAngleCardById(id: string): Promise<{
  ok: boolean;
  card: AngleCardRow | null;
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      card: null,
      error: "Supabase admin client unavailable",
    };
  }

  const { data, error } = await client
    .from("angle_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      card: null,
      error: error.message,
    };
  }

  return {
    ok: true,
    card: (data as AngleCardRow | null) ?? null,
    error: null,
  };
}

export async function updateAngleCardStatus(args: {
  id: string;
  status: AngleCardStatus;
  moderator_decision?: string | null;
  moderator_note?: string | null;
}): Promise<{
  ok: boolean;
  id: string | null;
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      id: null,
      error: "Supabase admin client unavailable",
    };
  }

  const { data, error } = await client
    .from("angle_cards")
    .update({
      status: args.status,
      moderator_decision: args.moderator_decision ?? null,
      moderator_note: args.moderator_note ?? null,
      moderator_reviewed_at: new Date().toISOString(),
      rank: args.status === "featured" ? 999 : null,
    })
    .eq("id", args.id)
    .eq("is_locked", false)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      id: null,
      error: error.message,
    };
  }

  return {
    ok: true,
    id: data?.id ?? null,
    error: null,
  };
}

export async function hideAngleCardThoughtGroupByCardId(args: {
  cardId: string;
  reason?: string | null;
  moderator_decision?: string | null;
}): Promise<{
  ok: boolean;
  hidden_count: number;
  hidden_ids: string[];
  target_card: AngleCardRow | null;
  used_translation_group: boolean;
  error: string | null;
}> {
  const client = createAdminClient();

  if (!client) {
    return {
      ok: false,
      hidden_count: 0,
      hidden_ids: [],
      target_card: null,
      used_translation_group: false,
      error: "Supabase admin client unavailable",
    };
  }

  const target = await getAngleCardById(args.cardId);

  if (!target.ok) {
    return {
      ok: false,
      hidden_count: 0,
      hidden_ids: [],
      target_card: null,
      used_translation_group: false,
      error: target.error ?? "Failed to read target card",
    };
  }

  if (!target.card) {
    return {
      ok: false,
      hidden_count: 0,
      hidden_ids: [],
      target_card: null,
      used_translation_group: false,
      error: "Target card not found",
    };
  }

  const decision = args.moderator_decision ?? "replaced_by_better_card";
  const note =
    args.reason ??
    "Hidden automatically because evaluator selected a stronger replacement card.";

  const updatePayload = {
    status: "hidden" as AngleCardStatus,
    rank: null,
    moderator_decision: decision,
    moderator_note: note,
    moderator_reviewed_at: new Date().toISOString(),
  };

  const activeStatuses: AngleCardStatus[] = ["featured", "reserve", "rewrite"];

  if (target.card.translation_group_id) {
    const { data, error } = await client
      .from("angle_cards")
      .update(updatePayload)
      .eq("translation_group_id", target.card.translation_group_id)
      .eq("is_locked", false)
      .in("status", activeStatuses)
      .select("id");

    if (error) {
      return {
        ok: false,
        hidden_count: 0,
        hidden_ids: [],
        target_card: target.card,
        used_translation_group: true,
        error: error.message,
      };
    }

    const hiddenIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);

    return {
      ok: true,
      hidden_count: hiddenIds.length,
      hidden_ids: hiddenIds,
      target_card: target.card,
      used_translation_group: true,
      error: null,
    };
  }

  const { data, error } = await client
    .from("angle_cards")
    .update(updatePayload)
    .eq("id", args.cardId)
    .eq("is_locked", false)
    .in("status", activeStatuses)
    .select("id");

  if (error) {
    return {
      ok: false,
      hidden_count: 0,
      hidden_ids: [],
      target_card: target.card,
      used_translation_group: false,
      error: error.message,
    };
  }

  const hiddenIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);

  return {
    ok: true,
    hidden_count: hiddenIds.length,
    hidden_ids: hiddenIds,
    target_card: target.card,
    used_translation_group: false,
    error: null,
  };
}

export function toPublicAngleCard(card: AngleCardRow): PublicAngleCard {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    score_total: card.score_total,
    status: card.status,
    coverage_type: card.coverage_type,
  };
}
