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

type SupabaseAdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type SavedLensDiscoveryRow = {
  id: string;
  reference: string;
  lens_id: string;
  lang: string;
  protocol_version: string | null;
  provider: string | null;
  model: string | null;
  status: string | null;
  score: number | null;
  title: string | null;
  kicker: string | null;
  content_json: unknown | null;
  summary: string | null;
  source_kind: string | null;
  source_id: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function getResearchNoteKind(lensId: string): string {
  if (lensId === "translations") return "translation_note";
  if (lensId === "word") return "lexical_note";
  if (lensId === "context") return "context_note";
  if (lensId === "angles") return "candidate_angle";
  return "candidate_angle";
}

function getAnchorFromCard(card: LensDiscoveryOutputCard): string | null {
  const firstQuote = card.quotes?.find((quote) => quote.text.trim());
  return firstQuote?.text.trim() ?? null;
}

function getBodyFromCard(card: LensDiscoveryOutputCard): string {
  return card.body.join("\n\n").trim();
}

async function syncLensDiscoveryRowToResearchNote(
  supabase: SupabaseAdminClient,
  row: SavedLensDiscoveryRow,
): Promise<void> {
  try {
    const card = normalizeOutputCard(row.content_json);

    if (!card) {
      console.error("[research_notes] skipped invalid lens discovery content", {
        legacyId: row.id,
        reference: row.reference,
        lensId: row.lens_id,
      });
      return;
    }

    const now = new Date().toISOString();

    const notePayload = {
      reference: row.reference,
      canonical_ref: row.reference,
      book_key: null,
      book: null,
      chapter: null,
      verse: null,
      lang: row.lang,

      source_id: null,
      legacy_table: "lens_discovery_cards",
      legacy_id: row.id,

      note_kind: getResearchNoteKind(row.lens_id),
      lens_id: row.lens_id,
      source_kind: row.source_kind ?? "ai_lens_generation",
      protocol_version: row.protocol_version,

      title: card.title,
      kicker: card.kicker || row.kicker,
      summary: row.summary,
      body: getBodyFromCard(card),
      anchor: getAnchorFromCard(card),
      content_json: row.content_json,

      status: row.status ?? "active",
      score: row.score,
      confidence: null,
      evidence_level: null,
      hypothesis_level: null,

      candidate_status: "not_processed",
      angle_card_id: null,
      rejected_reason: null,

      provider: row.provider,
      model: row.model,
      editor_provider: null,
      editor_model: null,
      prompt_version: row.protocol_version,

      updated_at: now,
    };

    const { data: existing, error: existingError } = await supabase
      .from("research_notes")
      .select("id")
      .eq("legacy_table", "lens_discovery_cards")
      .eq("legacy_id", row.id)
      .maybeSingle();

    if (existingError) {
      console.error("[research_notes] lookup error", {
        legacyId: row.id,
        reference: row.reference,
        lensId: row.lens_id,
        message: existingError.message,
        details: existingError.details,
        hint: existingError.hint,
        code: existingError.code,
      });
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("research_notes")
        .update(notePayload)
        .eq("id", existing.id);

      if (updateError) {
        console.error("[research_notes] update error", {
          legacyId: row.id,
          noteId: existing.id,
          reference: row.reference,
          lensId: row.lens_id,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
      }

      return;
    }

    const { error: insertError } = await supabase.from("research_notes").insert({
      ...notePayload,
      created_at: row.created_at ?? now,
    });

    if (insertError) {
      console.error("[research_notes] insert error", {
        legacyId: row.id,
        reference: row.reference,
        lensId: row.lens_id,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
    }
  } catch (error) {
    console.error("[research_notes] unexpected sync error", {
      legacyId: row.id,
      reference: row.reference,
      lensId: row.lens_id,
      error,
    });
  }
}

async function syncLensDiscoveryRowsToResearchNotes(
  supabase: SupabaseAdminClient,
  rows: SavedLensDiscoveryRow[],
): Promise<void> {
  for (const row of rows) {
    await syncLensDiscoveryRowToResearchNote(supabase, row);
  }
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

  const baseStatus = args.status ?? "active";
  const baseScore = args.score ?? 75;

  const rows = args.output.cards.map((card, index) => {
    const status =
      baseStatus === "active" && index >= 3 ? "reserve" : baseStatus;

    const score =
      baseStatus === "active" && index >= 3
        ? Math.max(baseScore - 5, 0)
        : baseScore;

    return {
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
    };
  });

  const { data, error } = await supabase
    .from("lens_discovery_cards")
    .insert(rows)
    .select(
      "id,reference,lens_id,lang,protocol_version,provider,model,status,score,title,kicker,content_json,summary,source_kind,source_id,created_at,updated_at",
    );

  if (error) {
    console.error("[lens_discovery_cards] save error", error);
    return;
  }

  if (data && data.length > 0) {
    await syncLensDiscoveryRowsToResearchNotes(
      supabase,
      data as SavedLensDiscoveryRow[],
    );
  }
}
