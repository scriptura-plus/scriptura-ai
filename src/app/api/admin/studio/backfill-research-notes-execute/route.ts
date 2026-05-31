import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { computePublishedPearlBackfillPlan } from "@/lib/research-notes/computePublishedPearlBackfillPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRM = "BACKFILL_RESEARCH_NOTES_FROM_PUBLISHED_PEARL";

function getAdminSecret(req: Request, url: URL): string | null {
  return (
    req.headers.get("x-admin-secret") ||
    url.searchParams.get("admin_secret") ||
    null
  );
}

function parseLimit(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPreviewFromSample(sampleRow: unknown): Record<string, unknown> | null {
  if (!isRecord(sampleRow)) return null;
  const preview = sampleRow.preview;
  return isRecord(preview) ? preview : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "dry_run";
  const confirm = url.searchParams.get("confirm");
  const limit = parseLimit(url.searchParams.get("limit"));

  const expectedSecret = process.env.ADMIN_SECRET;
  const providedSecret = getAdminSecret(req, url);

  if (!expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        writes: false,
        error: "ADMIN_SECRET is not configured.",
      },
      { status: 500 }
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        writes: false,
        error: "Unauthorized. ADMIN_SECRET required.",
      },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        writes: false,
        error: "Supabase admin client is unavailable.",
      },
      { status: 500 }
    );
  }

  try {
    const plan = await computePublishedPearlBackfillPlan(supabase);

    if (mode !== "execute") {
      return NextResponse.json({
        ok: true,
        mode: "dry_run",
        writes: false,
        executeAllowed: false,
        requiredForExecute: {
          mode: "execute",
          confirm: CONFIRM,
          limit: "explicit positive integer; first approved execute is limit=5",
        },
        plan,
      });
    }

    if (confirm !== CONFIRM) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          writes: false,
          error: "Missing or invalid confirm token.",
          requiredConfirm: CONFIRM,
        },
        { status: 400 }
      );
    }

    if (limit === null) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          writes: false,
          error: "Explicit limit is required for execute.",
        },
        { status: 400 }
      );
    }

    if (![5, 183].includes(limit)) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          writes: false,
          error: "Approved execute limits are 5 pilot or 183 full backfill only.",
          allowedLimits: [5, 183],
          requestedLimit: limit,
        },
        { status: 400 }
      );
    }

    const sample = Array.isArray(plan.sample) ? plan.sample : [];
    const selectedPreviews = sample
      .map(getPreviewFromSample)
      .filter((preview): preview is Record<string, unknown> => Boolean(preview))
      .slice(0, limit);

    if (selectedPreviews.length !== limit) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          writes: false,
          error: "Not enough preview rows available for requested limit.",
          requestedLimit: limit,
          availablePreviewRows: selectedPreviews.length,
        },
        { status: 400 }
      );
    }

    const selectedLegacyIds = selectedPreviews
      .map((preview) => preview.legacy_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const { data: existingBefore, error: existingBeforeError } = await supabase
      .from("research_notes")
      .select("legacy_id")
      .eq("note_kind", "generated_observation_card")
      .eq("lens_id", "pearl")
      .eq("legacy_table", "published_lens_cards")
      .in("legacy_id", selectedLegacyIds);

    if (existingBeforeError) {
      throw new Error(
        `Duplicate guard pre-check failed: ${existingBeforeError.message}`
      );
    }

    if ((existingBefore ?? []).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          writes: false,
          error: "Duplicate guard blocked insert. Some selected legacy_id rows already exist.",
          existingBefore,
        },
        { status: 409 }
      );
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("research_notes")
      .insert(selectedPreviews)
      .select("id, canonical_ref, reference, lang, legacy_table, legacy_id, source_kind, content_json");

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    const inserted = insertedRows ?? [];

    const { data: duplicatesAfter, error: duplicatesAfterError } = await supabase
      .from("research_notes")
      .select("legacy_id")
      .eq("note_kind", "generated_observation_card")
      .eq("lens_id", "pearl")
      .eq("legacy_table", "published_lens_cards")
      .in("legacy_id", selectedLegacyIds);

    if (duplicatesAfterError) {
      throw new Error(
        `Duplicate guard post-check failed: ${duplicatesAfterError.message}`
      );
    }

    const duplicateCountByLegacyId = new Map<string, number>();

    for (const row of duplicatesAfter ?? []) {
      const legacyId = isRecord(row) ? row.legacy_id : null;
      if (typeof legacyId === "string") {
        duplicateCountByLegacyId.set(
          legacyId,
          (duplicateCountByLegacyId.get(legacyId) ?? 0) + 1
        );
      }
    }

    const duplicateViolations = Array.from(duplicateCountByLegacyId.entries())
      .filter(([, count]) => count !== 1)
      .map(([legacy_id, count]) => ({ legacy_id, count }));

    return NextResponse.json({
      ok: true,
      mode: "execute",
      writes: true,
      requestedLimit: limit,
      inserted: inserted.length,
      insertedRows: inserted,
      duplicateGuard: {
        legacy_table: "published_lens_cards",
        legacy_id: "published_lens_cards.id",
        selectedLegacyIds,
        duplicateViolations,
        passed: duplicateViolations.length === 0,
      },
      rollbackMarkers: {
        source_kind: "published_lens_cards_backfill",
        legacy_table: "published_lens_cards",
        content_json_review_status: "backfilled_from_published",
        content_json_source_pipeline: "published_lens_cards_backfill",
      },
      warning: "Full backfill was not run. This route currently allows only limit=5.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        writes: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

