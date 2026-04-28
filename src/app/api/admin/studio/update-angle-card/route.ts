import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AngleCardStatus =
  | "featured"
  | "reserve"
  | "rewrite"
  | "hidden"
  | "rejected";

const VALID_STATUSES: AngleCardStatus[] = [
  "featured",
  "reserve",
  "rewrite",
  "hidden",
  "rejected",
];

function isValidStatus(value: unknown): value is AngleCardStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as AngleCardStatus);
}

function getAdminSecret(req: Request): string | null {
  return req.headers.get("x-admin-secret");
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    return false;
  }

  return getAdminSecret(req) === expected;
}

function normalizeBoost(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const rounded = Math.round(value);

  if (rounded < -30) return -30;
  if (rounded > 30) return 30;

  return rounded;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const cardId =
      typeof body?.card_id === "string" && body.card_id.trim()
        ? body.card_id.trim()
        : "";

    if (!cardId) {
      return NextResponse.json(
        { error: "card_id is required" },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {
      moderator_reviewed_at: new Date().toISOString(),
    };

    if ("moderator_boost" in body) {
      const boost = normalizeBoost(body.moderator_boost);

      if (boost === null) {
        return NextResponse.json(
          { error: "moderator_boost must be a number between -30 and 30" },
          { status: 400 },
        );
      }

      patch.moderator_boost = boost;
    }

    if ("status" in body) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 },
        );
      }

      patch.status = body.status;
    }

    if ("is_locked" in body) {
      if (typeof body.is_locked !== "boolean") {
        return NextResponse.json(
          { error: "is_locked must be boolean" },
          { status: 400 },
        );
      }

      patch.is_locked = body.is_locked;
    }

    if ("moderator_note" in body) {
      patch.moderator_note = normalizeOptionalText(body.moderator_note);
    }

    if ("moderator_decision" in body) {
      patch.moderator_decision = normalizeOptionalText(body.moderator_decision);
    }

    const client = createAdminClient();

    if (!client) {
      return NextResponse.json(
        { error: "Supabase admin client unavailable" },
        { status: 500 },
      );
    }

    const { data, error } = await client
      .from("angle_cards")
      .update(patch)
      .eq("id", cardId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      card: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update angle card",
      },
      { status: 500 },
    );
  }
}
