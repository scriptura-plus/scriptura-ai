import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResearchSourceRow = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  lang: string;
  source_kind: string;
  source_type: string | null;
  source_provider: string | null;
  source_model: string | null;
  source_title: string | null;
  title: string | null;
  status: string;
  extraction_status: string;
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
};

type ResearchNoteRow = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  lang: string;
  note_kind: string;
  lens_id: string | null;
  source_kind: string | null;
  title: string | null;
  kicker: string | null;
  summary: string | null;
  body: string | null;
  anchor: string | null;
  status: string;
  score: number | null;
  confidence: string | null;
  candidate_status: string;
  created_at: string;
  updated_at: string;
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_RESEARCH_MEMORY] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function countBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const raw = row[key];
    const value = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

function compactSource(row: ResearchSourceRow) {
  return {
    id: row.id,
    reference: row.reference,
    canonical_ref: row.canonical_ref,
    lang: row.lang,
    source_kind: row.source_kind,
    source_type: row.source_type,
    source_provider: row.source_provider,
    source_model: row.source_model,
    title: row.source_title || row.title || row.source_type || row.source_kind,
    status: row.status,
    extraction_status: row.extraction_status,
    extraction_error: row.extraction_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function compactNote(row: ResearchNoteRow) {
  return {
    id: row.id,
    reference: row.reference,
    canonical_ref: row.canonical_ref,
    lang: row.lang,
    note_kind: row.note_kind,
    lens_id: row.lens_id,
    source_kind: row.source_kind,
    title: row.title,
    kicker: row.kicker,
    summary: row.summary,
    body_preview: row.body ? row.body.slice(0, 260) : null,
    anchor: row.anchor,
    status: row.status,
    score: row.score,
    confidence: row.confidence,
    candidate_status: row.candidate_status,
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
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "12") || 12, 1),
    50,
  );

  if (!reference && !canonicalRef) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing reference or canonical_ref",
      },
      { status: 400 },
    );
  }

  let sourcesQuery = client
    .from("research_sources")
    .select(
      [
        "id",
        "reference",
        "canonical_ref",
        "lang",
        "source_kind",
        "source_type",
        "source_provider",
        "source_model",
        "source_title",
        "title",
        "status",
        "extraction_status",
        "extraction_error",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("lang", lang)
    .order("created_at", { ascending: false })
    .limit(limit);

  let notesQuery = client
    .from("research_notes")
    .select(
      [
        "id",
        "reference",
        "canonical_ref",
        "lang",
        "note_kind",
        "lens_id",
        "source_kind",
        "title",
        "kicker",
        "summary",
        "body",
        "anchor",
        "status",
        "score",
        "confidence",
        "candidate_status",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("lang", lang)
    .order("created_at", { ascending: false })
    .limit(limit);

  let sourceCountQuery = client
    .from("research_sources")
    .select("id", { count: "exact", head: true })
    .eq("lang", lang);

  let noteCountQuery = client
    .from("research_notes")
    .select("id", { count: "exact", head: true })
    .eq("lang", lang);

  if (canonicalRef) {
    sourcesQuery = sourcesQuery.eq("canonical_ref", canonicalRef);
    notesQuery = notesQuery.eq("canonical_ref", canonicalRef);
    sourceCountQuery = sourceCountQuery.eq("canonical_ref", canonicalRef);
    noteCountQuery = noteCountQuery.eq("canonical_ref", canonicalRef);
  } else if (reference) {
    sourcesQuery = sourcesQuery.eq("reference", reference);
    notesQuery = notesQuery.eq("reference", reference);
    sourceCountQuery = sourceCountQuery.eq("reference", reference);
    noteCountQuery = noteCountQuery.eq("reference", reference);
  }

  const [sourcesResult, notesResult, sourceCountResult, noteCountResult] =
    await Promise.all([
      sourcesQuery,
      notesQuery,
      sourceCountQuery,
      noteCountQuery,
    ]);

  if (sourcesResult.error) {
    console.error("[STUDIO_RESEARCH_MEMORY] sources read error", {
      reference,
      canonicalRef,
      lang,
      message: sourcesResult.error.message,
      details: sourcesResult.error.details,
      hint: sourcesResult.error.hint,
      code: sourcesResult.error.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: sourcesResult.error.message || "Failed to load research sources",
      },
      { status: 500 },
    );
  }

  if (notesResult.error) {
    console.error("[STUDIO_RESEARCH_MEMORY] notes read error", {
      reference,
      canonicalRef,
      lang,
      message: notesResult.error.message,
      details: notesResult.error.details,
      hint: notesResult.error.hint,
      code: notesResult.error.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: notesResult.error.message || "Failed to load research notes",
      },
      { status: 500 },
    );
  }

  if (sourceCountResult.error) {
    console.error("[STUDIO_RESEARCH_MEMORY] source count error", {
      reference,
      canonicalRef,
      lang,
      message: sourceCountResult.error.message,
      details: sourceCountResult.error.details,
      hint: sourceCountResult.error.hint,
      code: sourceCountResult.error.code,
    });
  }

  if (noteCountResult.error) {
    console.error("[STUDIO_RESEARCH_MEMORY] note count error", {
      reference,
      canonicalRef,
      lang,
      message: noteCountResult.error.message,
      details: noteCountResult.error.details,
      hint: noteCountResult.error.hint,
      code: noteCountResult.error.code,
    });
  }

  const sources = (sourcesResult.data ?? []) as unknown as ResearchSourceRow[];
  const notes = (notesResult.data ?? []) as unknown as ResearchNoteRow[];

  return NextResponse.json({
    ok: true,
    reference,
    canonical_ref: canonicalRef,
    lang,
    summary: {
      sources_count: sourceCountResult.count ?? sources.length,
      notes_count: noteCountResult.count ?? notes.length,
      source_kinds: countBy(sources, "source_kind"),
      source_types: countBy(sources, "source_type"),
      extraction_statuses: countBy(sources, "extraction_status"),
      note_kinds: countBy(notes, "note_kind"),
      note_statuses: countBy(notes, "status"),
      candidate_statuses: countBy(notes, "candidate_status"),
    },
    latest_sources: sources.map(compactSource),
    latest_notes: notes.map(compactNote),
  });
}
