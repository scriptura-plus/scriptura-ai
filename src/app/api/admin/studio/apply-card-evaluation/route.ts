import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  AngleCardCoverageType,
  AngleCardStatus,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_APPLY_EVALUATION] ADMIN_SECRET is not configured");
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

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const cardId = getString(body?.card_id);
    const evaluation = body?.evaluation;

    if (!cardId || !isRecord(evaluation)) {
      return NextResponse.json(
        {
          error: "card_id and evaluation object are required",
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

    const scoreTotal = getNumber(evaluation.score_total);
    const status = statusFromPlacement(evaluation.placement);
    const coverageType = normalizeCoverageType(evaluation.coverage_type);
    const angleSummary = getString(evaluation.angle_summary);
    const rank = status === "featured" ? 999 : null;

    const updatePayload = {
      score_total: scoreTotal,
      scores: evaluation.scores ?? null,
      evaluation,
      battle: evaluation.battle ?? null,
      coverage_type: coverageType,
      angle_summary: angleSummary,
      status,
      rank,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("angle_cards")
      .update(updatePayload)
      .eq("id", cardId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      changed_database: true,
      card_id: cardId,
      applied: {
        score_total: scoreTotal,
        status,
        rank,
        coverage_type: coverageType,
        angle_summary: angleSummary,
      },
      card: data,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Apply card evaluation failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
