import { createAdminClient } from "@/lib/supabase/server";

export type LensDiscoveryOutputCard = {
  kicker: string;
  title: string;
  body: string[];
  quotes?: Array<{
    label: string;
    text: string;
  }>;
};

export type LensDiscoveryOutput = {
  cards: LensDiscoveryOutputCard[];
  summary?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeQuotes(value: unknown): Array<{ label: string; text: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const label = toString(item.label);
      const text = toString(item.text);

      if (!label || !text) return null;

      return { label, text };
    })
    .filter((item): item is { label: string; text: string } => item !== null);
}

function normalizeOutputCard(value: unknown): LensDiscoveryOutputCard | null {
  if (!isRecord(value)) return null;

  const kicker = toString(value.kicker);
  const title = toString(value.title);
  const body = toStringArray(value.body);
  const quotes = normalizeQuotes(value.quotes);

  if (!title || body.length === 0) return null;

  return {
    kicker,
    title,
    body,
    ...(quotes.length > 0 ? { quotes } : {}),
  };
}

export function normalizeLensDiscoveryOutput(
  value: unknown
): LensDiscoveryOutput | null {
  if (!isRecord(value) || !Array.isArray(value.cards)) return null;

  const cards = value.cards
    .map(normalizeOutputCard)
    .filter((card): card is LensDiscoveryOutputCard => card !== null);

  if (cards.length === 0) return null;

  const summary = toString(value.summary);

  return {
    cards,
    ...(summary ? { summary } : {}),
  };
}

export async function getActiveLensDiscoveryCards(args: {
  reference: string;
  lensId: string;
  lang: string;
  limit?: number;
}): Promise<LensDiscoveryOutput | null> {
  const supabase = createAdminClient();

  if (!supabase) {
    console.error("[lens_discovery_cards] Supabase admin client is not configured");
    return null;
  }

  const { data, error } = await supabase
    .from("lens_discovery_cards")
    .select("title,kicker,content_json,summary,score,created_at")
    .eq("reference", args.reference)
    .eq("lens_id", args.lensId)
    .eq("lang", args.lang)
    .eq("status", "active")
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(args.limit ?? 3);

  if (error) {
    console.error("[lens_discovery_cards] read error", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const cards = data
    .map((row) => normalizeOutputCard(row.content_json))
    .filter((card): card is LensDiscoveryOutputCard => card !== null);

  if (cards.length === 0) return null;

  const summary =
    data.find((row) => typeof row.summary === "string" && row.summary.trim())
      ?.summary?.trim() ?? undefined;

  return {
    cards,
    ...(summary ? { summary } : {}),
  };
}

export async function saveLensDiscoveryCards(args: {
  reference: string;
  lensId: string;
  lang: string;
  protocolVersion?: string | null;
  provider?: string | null;
  model?: string | null;
  output: LensDiscoveryOutput;
  status?: string;
  score?: number | null;
  sourceKind?: string | null;
  sourceId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  if (!supabase) {
    console.error("[lens_discovery_cards] Supabase admin client is not configured");
    return;
  }

  const status = args.status ?? "active";
  const score = args.score ?? 75;

  const rows = args.output.cards.map((card) => ({
    reference: args.reference,
    lens_id: args.lensId,
    lang: args.lang,
    protocol_version: args.protocolVersion ?? null,
    provider: args.provider ?? null,
    model: args.model ?? null,
    status,
    score,
    title: card.title,
    kicker: card.kicker,
    content_json: card,
    summary: args.output.summary ?? null,
    source_kind: args.sourceKind ?? "ai_lens_generation",
    source_id: args.sourceId ?? null,
  }));

  const { error } = await supabase.from("lens_discovery_cards").insert(rows);

  if (error) {
    console.error("[lens_discovery_cards] save error", error);
  }
}
