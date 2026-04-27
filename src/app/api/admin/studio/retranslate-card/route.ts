import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  translateAngleCard,
  type AngleCardLang,
  type TranslatableAngleCard,
} from "@/lib/angles/translateAngleCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AngleCardDbRow = {
  id: string;
  reference: string;
  lang: AngleCardLang;
  translation_group_id: string | null;
  origin_lang: AngleCardLang | null;

  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;

  canonical_ref: string | null;
  book_key: string | null;

  score_total: number | null;
  status: string;
  coverage_type: string | null;
  angle_summary: string | null;
  updated_at: string;
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_RETRANSLATE_CARD] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isLang(value: unknown): value is AngleCardLang {
  return value === "ru" || value === "en" || value === "es";
}

function toTranslatableCard(card: AngleCardDbRow): TranslatableAngleCard {
  return {
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
  };
}

function chooseSourceCard(cards: AngleCardDbRow[], targetLang: AngleCardLang) {
  const notTarget = cards.filter((card) => card.lang !== targetLang);

  const english = notTarget.find((card) => card.lang === "en");
  if (english) return english;

  const origin = notTarget.find(
    (card) => card.origin_lang && card.lang === card.origin_lang,
  );
  if (origin) return origin;

  const anyOther = notTarget[0];
  if (anyOther) return anyOther;

  return null;
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const cardId = getString(body?.card_id);
    const targetLang: AngleCardLang = isLang(body?.target_lang)
      ? body.target_lang
      : "ru";

    if (!cardId) {
      return NextResponse.json(
        { error: "card_id is required" },
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

    const { data: targetCardData, error: targetError } = await client
      .from("angle_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (targetError || !targetCardData) {
      return NextResponse.json(
        { error: targetError?.message ?? "Card not found" },
        { status: 404 },
      );
    }

    const targetCard = targetCardData as AngleCardDbRow;

    if (targetCard.lang !== targetLang) {
      return NextResponse.json(
        {
          error: `Target card lang is ${targetCard.lang}, but target_lang is ${targetLang}`,
        },
        { status: 400 },
      );
    }

    if (!targetCard.translation_group_id) {
      return NextResponse.json(
        {
          error:
            "This card has no translation_group_id. It cannot be retranslated as a language version of one thought yet.",
        },
        { status: 400 },
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

    const groupCards = (groupData ?? []) as AngleCardDbRow[];
    const sourceCard = chooseSourceCard(groupCards, targetLang);

    if (!sourceCard) {
      return NextResponse.json(
        {
          error:
            "No source card found in another language. Need EN/ES/RU source version to retranslate this card.",
        },
        { status: 400 },
      );
    }

    const translationResult = await translateAngleCard({
      reference: sourceCard.reference || targetCard.reference,
      originLang: sourceCard.lang,
      card: toTranslatableCard(sourceCard),
    });

    if (!translationResult.ok) {
      return NextResponse.json(
        { error: translationResult.error ?? "Retranslation failed" },
        { status: 500 },
      );
    }

    const translatedTarget = translationResult.cards.find(
      (card) => card.lang === targetLang,
    );

    if (!translatedTarget) {
      return NextResponse.json(
        { error: `No ${targetLang} translation returned` },
        { status: 500 },
      );
    }

    const updatePayload = {
      title: translatedTarget.title,
      anchor: translatedTarget.anchor,
      teaser: translatedTarget.teaser,
      why_it_matters: translatedTarget.why_it_matters,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedData, error: updateError } = await client
      .from("angle_cards")
      .update(updatePayload)
      .eq("id", targetCard.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      changed_database: true,
      card_id: targetCard.id,
      target_lang: targetLang,
      source_card_id: sourceCard.id,
      source_lang: sourceCard.lang,
      translation_group_id: targetCard.translation_group_id,
      updated_fields: updatePayload,
      card: updatedData,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Retranslate card failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
