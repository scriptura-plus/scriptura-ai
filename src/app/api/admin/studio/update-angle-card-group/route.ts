import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupStatus = "featured" | "reserve" | "hidden" | "rejected";

type AngleCardRow = {
  id: string;
  translation_group_id: string | null;
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[UPDATE_ANGLE_CARD_GROUP] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isGroupStatus(value: unknown): value is GroupStatus {
  return (
    value === "featured" ||
    value === "reserve" ||
    value === "hidden" ||
    value === "rejected"
  );
}

function normalizeDecision(value: unknown, status: GroupStatus): string {
  const provided = getString(value);

  if (provided) return provided;

  if (status === "featured") return "group_force_featured";
  if (status === "reserve") return "group_move_reserve";
  if (status === "hidden") return "group_hide";
  if (status === "rejected") return "group_reject";

  return "group_update";
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const cardId = getString(body?.card_id);
    const status = isGroupStatus(body?.status) ? body.status : null;
    const moderatorDecision = status
      ? normalizeDecision(body?.moderator_decision, status)
      : null;
    const moderatorNote = getString(body?.moderator_note);

    if (!cardId || !status || !moderatorDecision) {
      return NextResponse.json(
        {
          error:
            "card_id and status are required. status must be featured, reserve, hidden, or rejected.",
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

    const { data: cardData, error: cardError } = await client
      .from("angle_cards")
      .select("id, translation_group_id")
      .eq("id", cardId)
      .single();

    if (cardError || !cardData) {
      return NextResponse.json(
        { error: cardError?.message ?? "Card not found" },
        { status: 404 },
      );
    }

    const card = cardData as AngleCardRow;
    const reviewedAt = new Date().toISOString();

    const patch = {
      status,
      moderator_decision: moderatorDecision,
      moderator_note: moderatorNote,
      moderator_reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    };

    const query = client
      .from("angle_cards")
      .update(patch)
      .select(
        "id, lang, title, status, translation_group_id, moderator_decision, moderator_note, moderator_reviewed_at, updated_at",
      );

    const { data: updatedRows, error: updateError } = card.translation_group_id
      ? await query.eq("translation_group_id", card.translation_group_id)
      : await query.eq("id", card.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      changed_database: true,
      mode: card.translation_group_id ? "translation_group" : "single_card",
      card_id: card.id,
      translation_group_id: card.translation_group_id,
      status,
      moderator_decision: moderatorDecision,
      updated_count: updatedRows?.length ?? 0,
      cards: updatedRows ?? [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Update angle card group failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
