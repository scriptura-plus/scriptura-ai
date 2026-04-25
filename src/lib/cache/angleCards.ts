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

export type AngleCardInput = {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: "ru" | "en" | "es";

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

  lang: "ru" | "en" | "es";

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
  lang: "ru" | "en" | "es";
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
    .limit(args.limit ?? 24);

  if (error) {
    return {
      ok: false,
      cards: [],
      error: error.message,
    };
  }

  return {
    ok: true,
    cards: (data ?? []) as AngleCardRow[],
    error: null,
  };
}

export async function getFeaturedAngleCards(args: {
  reference: string;
  lang: "ru" | "en" | "es";
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
  return getAngleCards({
    reference: args.reference,
    lang: args.lang,
    statuses: ["featured"],
    limit: args.limit ?? 12,
  });
}

export async function getReserveAngleCards(args: {
  reference: string;
  lang: "ru" | "en" | "es";
  limit?: number;
}): Promise<{
  ok: boolean;
  cards: AngleCardRow[];
  error: string | null;
}> {
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
