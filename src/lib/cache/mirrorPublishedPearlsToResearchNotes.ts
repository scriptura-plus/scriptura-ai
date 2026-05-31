import { createAdminClient } from "@/lib/supabase/server";
import type {
  PublishedLensCardRow,
  PublishedLensSetRow,
} from "@/lib/cache/publishedLensSets";

type MirrorReferenceParts = {
  book_key?: string | null;
  book?: string | null;
  chapter?: number | null;
  verse?: number | null;
};

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getCardBody(card: PublishedLensCardRow): string | null {
  return cleanString(card.body) ?? cleanString(card.teaser);
}

function buildContentJson(args: {
  set: PublishedLensSetRow;
  card: PublishedLensCardRow;
}) {
  return {
    published_set_id: args.set.id,
    published_card_id: args.card.id,
    position: args.card.position,
    title: args.card.title,
    anchor: args.card.anchor,
    body: args.card.body,
    teaser: args.card.teaser,
    why_it_matters: args.card.why_it_matters,
    score: args.card.score,
    status: args.card.status,
    source_angle: args.card.source_angle,
    raw_card: args.card.raw_card,
    raw_score: args.card.raw_score,
    source_pipeline: args.set.source_pipeline,
    source_model: args.set.source_model,
    generated_at: args.set.generated_at,
    canonical_ref: args.set.canonical_ref,
    reference_label: args.set.reference_label,
    review_status: "generated_unreviewed",
  };
}

export async function mirrorPublishedPearlsToResearchNotes(args: {
  set: PublishedLensSetRow;
  cards: PublishedLensCardRow[];
  referenceParts?: MirrorReferenceParts | null;
}): Promise<void> {
  const supabase = createAdminClient();

  if (!supabase) {
    console.error("[RESEARCH_NOTES_MIRROR] skipped: Supabase admin client unavailable", {
      setId: args.set.id,
      canonicalRef: args.set.canonical_ref,
    });
    return;
  }

  for (const card of args.cards) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from("research_notes")
        .select("id")
        .eq("legacy_table", "published_lens_cards")
        .eq("legacy_id", card.id)
        .maybeSingle();

      if (existingError) {
        console.error("[RESEARCH_NOTES_MIRROR] lookup failed", {
          setId: args.set.id,
          cardId: card.id,
          canonicalRef: args.set.canonical_ref,
          message: existingError.message,
          details: existingError.details,
          hint: existingError.hint,
          code: existingError.code,
        });
        continue;
      }

      if (existing?.id) {
        console.log("[RESEARCH_NOTES_MIRROR] skipped duplicate", {
          setId: args.set.id,
          cardId: card.id,
          noteId: existing.id,
          canonicalRef: args.set.canonical_ref,
        });
        continue;
      }

      const { error: insertError } = await supabase.from("research_notes").insert({
        reference: args.set.reference_label ?? args.set.canonical_ref,
        canonical_ref: args.set.canonical_ref,
        book_key: args.referenceParts?.book_key ?? null,
        book: args.referenceParts?.book ?? null,
        chapter: args.referenceParts?.chapter ?? null,
        verse: args.referenceParts?.verse ?? null,
        lang: args.set.lang,

        source_id: null,
        legacy_table: "published_lens_cards",
        legacy_id: card.id,

        note_kind: "generated_observation_card",
        lens_id: "pearl",
        source_kind: "pearl_v3_auto_public",
        protocol_version: "pearl_v3",

        title: card.title,
        kicker: null,
        summary: card.why_it_matters,
        body: getCardBody(card),
        anchor: card.anchor,
        content_json: buildContentJson({ set: args.set, card }),

        status: "active",
        score: card.score,
        confidence: null,
        evidence_level: "textual_observation",
      });

      if (insertError) {
        console.error("[RESEARCH_NOTES_MIRROR] insert failed", {
          setId: args.set.id,
          cardId: card.id,
          canonicalRef: args.set.canonical_ref,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        });
      }
    } catch (error) {
      console.error("[RESEARCH_NOTES_MIRROR] unexpected card mirror error", {
        setId: args.set.id,
        cardId: card.id,
        canonicalRef: args.set.canonical_ref,
        error,
      });
    }
  }
}
