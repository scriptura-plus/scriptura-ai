import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuggestionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "archived"
  | "applied"
  | "ignored";

type EditorialSuggestionRow = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  book_key: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lang: string;

  suggestion_type: string;
  status: SuggestionStatus | string;

  existing_card_id: string | null;
  candidate_card_id: string | null;
  candidate_payload: unknown | null;

  score_existing: number | null;
  score_candidate: number | null;
  score_delta: number | null;

  angle_relationship: string | null;
  relationship_confidence: string | null;
  same_angle_summary: string | null;
  matched_card_id: string | null;

  reason: string | null;
  risk: string | null;
  risk_level: string | null;
  source_summary: string | null;

  source_id: string | null;
  note_id: string | null;

  provider: string | null;
  model: string | null;
  evaluator_version: string | null;
  decision_engine_version: string | null;

  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  moderator_decision: string | null;

  created_at: string;
  updated_at: string;
};

type SuggestionCounts = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  archived: number;
  applied: number;
  ignored: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_EDITORIAL_SUGGESTIONS] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStatus(value: string | null): SuggestionStatus | "all" {
  const normalized = (value ?? "pending").trim().toLowerCase();

  if (normalized === "all") return "all";
  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  if (normalized === "archived") return "archived";
  if (normalized === "applied") return "applied";
  if (normalized === "ignored") return "ignored";

  return "pending";
}

function normalizeWriteStatus(value: unknown): SuggestionStatus | null {
  const raw = getString(value);
  if (!raw) return null;

  const normalized = raw.toLowerCase();

  if (normalized === "pending") return "pending";
  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  if (normalized === "archived") return "archived";
  if (normalized === "applied") return "applied";
  if (normalized === "ignored") return "ignored";

  return null;
}

function countStatuses(rows: EditorialSuggestionRow[]): SuggestionCounts {
  const counts: SuggestionCounts = {
    total: rows.length,
    pending: 0,
    accepted: 0,
    rejected: 0,
    archived: 0,
    applied: 0,
    ignored: 0,
  };

  for (const row of rows) {
    if (row.status === "pending") counts.pending += 1;
    if (row.status === "accepted") counts.accepted += 1;
    if (row.status === "rejected") counts.rejected += 1;
    if (row.status === "archived") counts.archived += 1;
    if (row.status === "applied") counts.applied += 1;
    if (row.status === "ignored") counts.ignored += 1;
  }

  return counts;
}

function countBy(
  rows: EditorialSuggestionRow[],
  key: keyof EditorialSuggestionRow,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const raw = row[key];
    const value = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

function compactSuggestion(row: EditorialSuggestionRow) {
  return {
    id: row.id,
    reference: row.reference,
    canonical_ref: row.canonical_ref,
    book_key: row.book_key,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    lang: row.lang,

    suggestion_type: row.suggestion_type,
    status: row.status,

    existing_card_id: row.existing_card_id,
    candidate_card_id: row.candidate_card_id,
    candidate_payload: row.candidate_payload,

    score_existing: row.score_existing,
    score_candidate: row.score_candidate,
    score_delta: row.score_delta,

    angle_relationship: row.angle_relationship,
    relationship_confidence: row.relationship_confidence,
    same_angle_summary: row.same_angle_summary,
    matched_card_id: row.matched_card_id,

    reason: row.reason,
    risk: row.risk,
    risk_level: row.risk_level,
    source_summary: row.source_summary,

    source_id: row.source_id,
    note_id: row.note_id,

    provider: row.provider,
    model: row.model,
    evaluator_version: row.evaluator_version,
    decision_engine_version: row.decision_engine_version,

    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    review_note: row.review_note,
    moderator_decision: row.moderator_decision,

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const client = createAdminClient();

  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);

  const reference = getString(url.searchParams.get("reference"));
  const canonicalRef = getString(url.searchParams.get("canonical_ref"));
  const lang = getString(url.searchParams.get("lang")) ?? "ru";
  const status = normalizeStatus(url.searchParams.get("status"));
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "20") || 20, 1),
    100,
  );

  let query = client
    .from("editorial_suggestions")
    .select(
      [
        "id",
        "reference",
        "canonical_ref",
        "book_key",
        "book",
        "chapter",
        "verse",
        "lang",
        "suggestion_type",
        "status",
        "existing_card_id",
        "candidate_card_id",
        "candidate_payload",
        "score_existing",
        "score_candidate",
        "score_delta",
        "angle_relationship",
        "relationship_confidence",
        "same_angle_summary",
        "matched_card_id",
        "reason",
        "risk",
        "risk_level",
        "source_summary",
        "source_id",
        "note_id",
        "provider",
        "model",
        "evaluator_version",
        "decision_engine_version",
        "reviewed_at",
        "reviewed_by",
        "review_note",
        "moderator_decision",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("lang", lang)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (canonicalRef) {
    query = query.eq("canonical_ref", canonicalRef);
  } else if (reference) {
    query = query.eq("reference", reference);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[STUDIO_EDITORIAL_SUGGESTIONS] read error", {
      reference,
      canonicalRef,
      lang,
      status,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to load editorial suggestions",
      },
      { status: 500 },
    );
  }

  const suggestions = (data ?? []) as unknown as EditorialSuggestionRow[];

  return NextResponse.json({
    ok: true,
    reference,
    canonical_ref: canonicalRef,
    lang,
    status,
    count: suggestions.length,
    summary: {
      statuses: countStatuses(suggestions),
      suggestion_types: countBy(suggestions, "suggestion_type"),
      angle_relationships: countBy(suggestions, "angle_relationship"),
      risk_levels: countBy(suggestions, "risk_level"),
    },
    suggestions: suggestions.map(compactSuggestion),
  });
}

export async function PATCH(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const client = createAdminClient();

  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  const body: unknown = await req.json().catch(() => null);

  if (!isRecord(body)) {
    return NextResponse.json(
      { ok: false, error: "JSON body is required" },
      { status: 400 },
    );
  }

  const id = getString(body.id);
  const status = normalizeWriteStatus(body.status);
  const moderatorDecision = getString(body.moderator_decision);
  const reviewNote = getString(body.review_note);
  const reviewedBy = getString(body.reviewed_by) ?? "studio";

  if (!id || !status) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "id and status are required. Status must be pending, accepted, rejected, archived, applied, or ignored.",
      },
      { status: 400 },
    );
  }

  const patch = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
    review_note: reviewNote,
    moderator_decision: moderatorDecision,
  };

  const { data, error } = await client
    .from("editorial_suggestions")
    .update(patch)
    .eq("id", id)
    .select(
      [
        "id",
        "reference",
        "canonical_ref",
        "book_key",
        "book",
        "chapter",
        "verse",
        "lang",
        "suggestion_type",
        "status",
        "existing_card_id",
        "candidate_card_id",
        "candidate_payload",
        "score_existing",
        "score_candidate",
        "score_delta",
        "angle_relationship",
        "relationship_confidence",
        "same_angle_summary",
        "matched_card_id",
        "reason",
        "risk",
        "risk_level",
        "source_summary",
        "source_id",
        "note_id",
        "provider",
        "model",
        "evaluator_version",
        "decision_engine_version",
        "reviewed_at",
        "reviewed_by",
        "review_note",
        "moderator_decision",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .single();

  if (error) {
    console.error("[STUDIO_EDITORIAL_SUGGESTIONS] update error", {
      id,
      status,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to update editorial suggestion",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    suggestion: compactSuggestion(data as unknown as EditorialSuggestionRow),
  });
}
