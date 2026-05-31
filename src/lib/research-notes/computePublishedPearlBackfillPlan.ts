type SupabaseLike = {
  from: (table: string) => any;
};

type PublishedSetRow = {
  id: string;
  canonical_ref: string | null;
  reference_label: string | null;
  lang: string | null;
  lens_id: string | null;
  created_at: string | null;
};

type PublishedCardRow = {
  id: string;
  set_id: string;
  position: number | null;
  title: string | null;
  anchor: string | null;
  teaser: string | null;
  body: string | null;
  why_it_matters: string | null;
  score: number | null;
  claim_type: string | null;
  weakness_root: string | null;
  scorer_reasoning: string | null;
  weakness_detail: string | null;
  source_angle: unknown;
  raw_card: unknown;
  raw_score: unknown;
  status: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type ExistingMirrorRow = {
  legacy_id: string | null;
};

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function buildResearchNotePreview(card: PublishedCardRow, set: PublishedSetRow) {
  return {
    reference: set.reference_label,
    canonical_ref: set.canonical_ref,
    lang: set.lang,
    note_kind: "generated_observation_card",
    lens_id: "pearl",
    source_kind: "published_lens_cards_backfill",
    protocol_version: "pearl_v3_backfill_from_published",
    legacy_table: "published_lens_cards",
    legacy_id: card.id,
    title: card.title,
    anchor: card.anchor,
    summary: card.teaser,
    body: card.body,
    status: "active",
    score: card.score,
    evidence_level: null,
    content_json: {
      review_status: "backfilled_from_published",
      published_set_id: set.id,
      published_card_id: card.id,
      position: card.position,
      title: card.title,
      anchor: card.anchor,
      teaser: card.teaser,
      body: card.body,
      why_it_matters: card.why_it_matters,
      claim_type: card.claim_type,
      weakness_root: card.weakness_root,
      weakness_detail: card.weakness_detail,
      scorer_reasoning: card.scorer_reasoning,
      source_angle: card.source_angle,
      raw_card: card.raw_card,
      raw_score: card.raw_score,
      metadata: card.metadata,
      original_status: card.status,
      original_card_created_at: card.created_at,
      original_card_updated_at: card.updated_at,
      source_pipeline: "published_lens_cards_backfill",
      source_model: null,
      legacy_table: "published_lens_cards",
      legacy_id: card.id,
    },
  };
}

export async function computePublishedPearlBackfillPlan(supabase: SupabaseLike) {
  const { data: setsData, error: setsError } = await supabase
    .from("published_lens_sets")
    .select("id, canonical_ref, reference_label, lang, lens_id, created_at")
    .eq("lens_id", "pearl");

  if (setsError) {
    throw new Error(`Failed to fetch published_lens_sets: ${setsError.message}`);
  }

  const sets = (setsData ?? []) as PublishedSetRow[];
  const setsById = new Map(sets.map((set) => [set.id, set]));
  const setIds = sets.map((set) => set.id);

  if (setIds.length === 0) {
    return {
      totalPublishedPearlCards: 0,
      alreadyMirrored: 0,
      missing: 0,
      affectedCanonicalRefs: [],
      sample: [],
    };
  }

  const { data: cardsData, error: cardsError } = await supabase
    .from("published_lens_cards")
    .select(
      [
        "id",
        "set_id",
        "position",
        "title",
        "anchor",
        "teaser",
        "body",
        "why_it_matters",
        "score",
        "claim_type",
        "weakness_root",
        "scorer_reasoning",
        "weakness_detail",
        "source_angle",
        "raw_card",
        "raw_score",
        "status",
        "metadata",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .in("set_id", setIds);

  if (cardsError) {
    throw new Error(`Failed to fetch published_lens_cards: ${cardsError.message}`);
  }

  const cards = (cardsData ?? []) as PublishedCardRow[];

  const { data: mirrorsData, error: mirrorsError } = await supabase
    .from("research_notes")
    .select("legacy_id")
    .eq("note_kind", "generated_observation_card")
    .eq("lens_id", "pearl")
    .eq("legacy_table", "published_lens_cards");

  if (mirrorsError) {
    throw new Error(`Failed to fetch research_notes mirrors: ${mirrorsError.message}`);
  }

  const mirroredIds = new Set(
    ((mirrorsData ?? []) as ExistingMirrorRow[])
      .map((row) => row.legacy_id)
      .filter((id): id is string => Boolean(id))
  );

  const missingCards = cards.filter((card) => !mirroredIds.has(card.id));

  const affectedMap = new Map<string, {
    canonical_ref: string | null;
    reference: string | null;
    lang: string | null;
    missing_count: number;
  }>();

  for (const card of missingCards) {
    const set = setsById.get(card.set_id);
    const canonicalRef = set?.canonical_ref ?? null;
    const lang = set?.lang ?? null;
    const key = `${canonicalRef ?? "unknown"}::${lang ?? "unknown"}`;

    const current = affectedMap.get(key) ?? {
      canonical_ref: canonicalRef,
      reference: set?.reference_label ?? null,
      lang,
      missing_count: 0,
    };

    current.missing_count += 1;
    affectedMap.set(key, current);
  }

  const sample = missingCards.map((card) => {
    const set = setsById.get(card.set_id);

    if (!set) {
      return {
        source: card,
        warning: "Missing published_lens_sets row for card.set_id",
        preview: null,
      };
    }

    return {
      source: {
        id: card.id,
        set_id: card.set_id,
        canonical_ref: set.canonical_ref,
        reference_label: set.reference_label,
        lang: set.lang,
        position: card.position,
        title: card.title,
        anchor: card.anchor,
        teaser: card.teaser,
        body: card.body,
        why_it_matters: card.why_it_matters,
        score: card.score,
        status: card.status,
      },
      preview: buildResearchNotePreview(card, set),
    };
  });

  return {
    totalPublishedPearlCards: cards.length,
    alreadyMirrored: mirroredIds.size,
    missing: missingCards.length,
    affectedCanonicalRefs: Array.from(affectedMap.values()).sort(
      (a, b) => b.missing_count - a.missing_count
    ),
    sample,
    notes: {
      readOnly: true,
      duplicateGuard: {
        legacy_table: "published_lens_cards",
        legacy_id: "published_lens_cards.id",
      },
      noWritesPerformed: true,
    },
  };
}

