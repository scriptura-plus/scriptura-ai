import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  translateAngleCard,
  type AngleCardLang,
  type TranslatableAngleCard,
  type TranslatedAngleCard,
} from "@/lib/angles/translateAngleCard";
import type {
  AngleCardCoverageType,
  AngleCardStatus,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AngleCardDbRow = {
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

type RewrittenCard = {
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
};

const ALL_LANGS: AngleCardLang[] = ["ru", "en", "es"];

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_APPLY_REWRITE] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isLang(value: unknown): value is AngleCardLang {
  return value === "ru" || value === "en" || value === "es";
}

function normalizeCoverageType(value: unknown): AngleCardCoverageType | null {
  if (
    value === "lexical" ||
    value === "grammatical" ||
    value === "structural" ||
    value === "contextual" ||
    value === "translation" ||
    value === "rhetorical" ||
    value === "historical" ||
    value === "conceptual" ||
    value === "other"
  ) {
    return value;
  }

  return null;
}

function normalizePlacement(value: unknown): string | null {
  const raw = getString(value);
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();

  if (normalized === "featured_new") return "featured_new";
  if (normalized === "replace_existing") return "replace_existing";
  if (normalized === "reserve") return "reserve";
  if (normalized === "rewrite") return "rewrite";
  if (normalized === "hidden") return "hidden";
  if (normalized === "reject") return "reject";
  if (normalized === "rejected") return "rejected";
  if (normalized === "needs_human_review") return "needs_human_review";

  return normalized;
}

function statusFromPlacement(placement: unknown): AngleCardStatus {
  const normalized = normalizePlacement(placement);

  if (normalized === "featured_new" || normalized === "replace_existing") {
    return "featured";
  }

  if (normalized === "reserve") {
    return "reserve";
  }

  if (normalized === "rewrite") {
    return "rewrite";
  }

  if (normalized === "hidden") {
    return "hidden";
  }

  if (normalized === "reject" || normalized === "rejected") {
    return "rejected";
  }

  if (normalized === "needs_human_review") {
    return "reserve";
  }

  return "reserve";
}

function normalizeRewrittenCard(value: unknown): RewrittenCard {
  if (!isRecord(value)) {
    throw new Error("rewritten_card must be an object");
  }

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) {
    throw new Error("rewritten_card.title and rewritten_card.teaser are required");
  }

  return {
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters: getString(value.why_it_matters),
  };
}

function toTranslatableCard(card: RewrittenCard): TranslatableAngleCard {
  return {
    title: card.title,
    anchor: card.anchor ?? null,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? null,
  };
}

function byLang(cards: TranslatedAngleCard[], lang: AngleCardLang) {
  return cards.find((card) => card.lang === lang) ?? null;
}

function getEditorModel() {
  return process.env.OPENAI_MODEL || "gpt-5.5";
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const cardId = getString(body?.card_id);
    const currentLang = isLang(body?.lang) ? body.lang : null;
    const rewrittenCard = normalizeRewrittenCard(body?.rewritten_card);
    const evaluation = body?.evaluation;

    if (!cardId || !currentLang || !isRecord(evaluation)) {
      return NextResponse.json(
        {
          error:
            "card_id, lang, rewritten_card, and evaluation object are required",
        },
        { status: 400 },
      );
    }

    const client = createAdminClient();

    if (!client) {
      return NextResponse.json(
        { error: "Supabase admin client unavailable" },
        { status: 500 },
      );
    }

    const { data: targetData, error: targetError } = await client
      .from("angle_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (targetError || !targetData) {
      return NextResponse.json(
        { error: targetError?.message ?? "Card not found" },
        { status: 404 },
      );
    }

    const targetCard = targetData as AngleCardDbRow;

    if (targetCard.lang !== currentLang) {
      return NextResponse.json(
        {
          error: `Card lang is ${targetCard.lang}, but request lang is ${currentLang}`,
        },
        { status: 400 },
      );
    }

    if (!targetCard.translation_group_id) {
      return NextResponse.json(
        {
          error:
            "This card has no translation_group_id. Multilingual rewrite cannot be applied safely.",
        },
        { status: 400 },
      );
    }

    const translationResult = await translateAngleCard({
      reference: targetCard.reference,
      originLang: currentLang,
      card: toTranslatableCard(rewrittenCard),
    });

    if (!translationResult.ok) {
      return NextResponse.json(
        {
          error:
            translationResult.error ??
            "Failed to translate rewritten card into RU/EN/ES",
        },
        { status: 500 },
      );
    }

    const translatedCards = translationResult.cards;

    const missingLangs = ALL_LANGS.filter(
      (lang) => !translatedCards.some((card) => card.lang === lang),
    );

    if (missingLangs.length > 0) {
      return NextResponse.json(
        {
          error: `Translation result is missing languages: ${missingLangs.join(
            ", ",
          )}`,
        },
        { status: 500 },
      );
    }

    const { data: groupData, error: groupError } = await client
      .from("angle_cards")
      .select("*")
      .eq("translation_group_id", targetCard.translation_group_id);

    if (groupError) {
      return NextResponse.json(
        { error: groupError.message },
        { status: 500 },
      );
    }

    const groupRows = (groupData ?? []) as AngleCardDbRow[];

    const scoreTotal = getNumber(evaluation.score_total);
    const status = statusFromPlacement(evaluation.placement);
    const rank = status === "featured" ? 999 : null;
    const coverageType = normalizeCoverageType(evaluation.coverage_type);
    const angleSummary = getString(evaluation.angle_summary);
    const now = new Date().toISOString();

    const updatedIds: string[] = [];
    const insertedIds: string[] = [];

    for (const lang of ALL_LANGS) {
      const translated = byLang(translatedCards, lang);

      if (!translated) {
        continue;
      }

      const existingRow = groupRows.find((row) => row.lang === lang);

      const sharedEvaluationPayload = {
        score_total: scoreTotal,
        scores: evaluation.scores ?? null,
        evaluation,
        battle: evaluation.battle ?? null,
        coverage_type: coverageType,
        angle_summary: angleSummary,
        status,
        rank,
        editor_provider: "openai",
        editor_model: getEditorModel(),
        rewritten_from_card_id: targetCard.id,
        prompt_version: "angle_cards_v1_rewrite",
        updated_at: now,
      };

      const textPayload = {
        title: translated.title,
        anchor: translated.anchor,
        teaser: translated.teaser,
        why_it_matters: translated.why_it_matters,
      };

      if (existingRow) {
        const { error: updateError } = await client
          .from("angle_cards")
          .update({
            ...textPayload,
            ...sharedEvaluationPayload,
          })
          .eq("id", existingRow.id);

        if (updateError) {
          return NextResponse.json(
            {
              error: `Failed to update ${lang} version: ${updateError.message}`,
            },
            { status: 500 },
          );
        }

        updatedIds.push(existingRow.id);
      } else {
        const { data: inserted, error: insertError } = await client
          .from("angle_cards")
          .insert({
            reference: targetCard.reference,
            book: targetCard.book,
            chapter: targetCard.chapter,
            verse: targetCard.verse,
            lang,

            canonical_ref: targetCard.canonical_ref,
            book_key: targetCard.book_key,
            translation_group_id: targetCard.translation_group_id,
            origin_lang: currentLang,

            ...textPayload,

            score_total: scoreTotal,
            scores: evaluation.scores ?? null,
            evaluation,
            battle: evaluation.battle ?? null,
            coverage_type: coverageType,
            angle_summary: angleSummary,

            status,
            rank,
            is_locked: false,

            source_type: "studio_rewrite",
            source_provider: targetCard.source_provider,
            source_model: targetCard.source_model,

            editor_provider: "openai",
            editor_model: getEditorModel(),

            original_card: {
              source_card_id: targetCard.id,
              source_title: targetCard.title,
              source_anchor: targetCard.anchor,
              source_teaser: targetCard.teaser,
              source_why_it_matters: targetCard.why_it_matters,
            },
            rewritten_from_card_id: targetCard.id,
            replaced_card_id: null,

            prompt_version: "angle_cards_v1_rewrite",
          })
          .select("id")
          .single();

        if (insertError) {
          return NextResponse.json(
            {
              error: `Failed to insert ${lang} version: ${insertError.message}`,
            },
            { status: 500 },
          );
        }

        if (inserted?.id) {
          insertedIds.push(inserted.id);
        }
      }
    }

    const { data: updatedCurrentCard, error: readBackError } = await client
      .from("angle_cards")
      .select("*")
      .eq("id", targetCard.id)
      .single();

    if (readBackError) {
      return NextResponse.json(
        { error: readBackError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      changed_database: true,
      mode: "multilingual_rewrite_applied",
      card_id: targetCard.id,
      translation_group_id: targetCard.translation_group_id,
      origin_lang: currentLang,
      updated_ids: updatedIds,
      inserted_ids: insertedIds,
      applied: {
        score_total: scoreTotal,
        status,
        rank,
        coverage_type: coverageType,
        angle_summary: angleSummary,
      },
      card: updatedCurrentCard,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Apply card rewrite failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
