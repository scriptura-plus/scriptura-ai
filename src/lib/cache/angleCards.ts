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

function getEffectiveScore(card: Pick<AngleCardRow, "score_total" | "moderator_boost">): number {
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
      "reference, book, chapter, verse, lang, canonical_ref, book_key, status, score_total, moderator_boost, source_model, source_type, created_at, updated_at",
    )
    .eq("lang", args.lang)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return {
      ok: false,
      verses: [],
      error: error.message,
    };
  }

  const grouped = new Map<string, StudioVerseSummary>();

  for (const row of data ?? []) {
    const card = row as {
      reference: string;
      book: string;
      chapter: number;
      verse: number;
      lang: AngleCardLang;
      canonical_ref: string | null;
      book_key: string | null;
      status: AngleCardStatus;
      score_total: number | null;
      moderator_boost: number | null;
      source_model: string | null;
      source_type: string | null;
      created_at: string;
      updated_at: string;
    };

    const effectiveScore = (card.score_total ?? 0) + (card.moderator_boost ?? 0);

    const groupKey = card.canonical_ref || card.reference;
    const key = `${card.lang}::${groupKey}`;
    const existing = grouped.get(key);

    const source =
      card.source_model?.replace("article_extractor_v1:", "") ||
      card.source_type ||
      "unknown";

    if (!existing) {
      grouped.set(key, {
        reference: card.reference,
        book: card.book,
        chapter: card.chapter,
        verse: card.verse,
        lang: card.lang,
        canonical_ref: card.canonical_ref,
        book_key: card.book_key,
        total_count: 1,
        featured_count: card.status === "featured" ? 1 : 0,
        reserve_count: card.status === "reserve" ? 1 : 0,
        hidden_count: card.status === "hidden" ? 1 : 0,
        rejected_count: card.status === "rejected" ? 1 : 0,
        best_score: typeof card.score_total === "number" ? effectiveScore : null,
        sources: source ? [source] : [],
        last_activity_at: card.created_at,
      });
      continue;
    }

    existing.total_count += 1;

    if (card.status === "featured") existing.featured_count += 1;
    if (card.status === "reserve") existing.reserve_count += 1;
    if (card.status === "hidden") existing.hidden_count += 1;
    if (card.status === "rejected") existing.rejected_count += 1;

    if (!existing.canonical_ref && card.canonical_ref) {
      existing.canonical_ref = card.canonical_ref;
    }

    if (!existing.book_key && card.book_key) {
      existing.book_key = card.book_key;
    }

    if (
      typeof card.score_total === "number" &&
      (existing.best_score === null || effectiveScore > existing.best_score)
    ) {
      existing.best_score = effectiveScore;
    }

    if (source && !existing.sources.includes(source)) {
      existing.sources.push(source);
    }

    if (card.created_at > existing.last_activity_at) {
      existing.last_activity_at = card.created_at;
    }
  }

  const verses = Array.from(grouped.values())
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    .slice(0, args.limit ?? 50);

  return {
    ok: true,
    verses,
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
