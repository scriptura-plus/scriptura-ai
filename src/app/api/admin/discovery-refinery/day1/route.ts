import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import {
  runDay1Calibration,
  runDay1DetectorPreview,
  runDay15FixturePreview,
  runDay15MultiVersePreview,
} from "@/lib/discovery-refinery/day1/runDay1Pipeline";
import { saveDiscoveryRefineryRun } from "@/lib/discovery-refinery/runLog/saveDiscoveryRefineryRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

type Day1Action =
  | "calibration"
  | "detector_preview"
  | "day15_fixture_preview"
  | "day15_multi_verse_preview";

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[DISCOVERY_REFINERY_DAY1] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function isDay1Action(value: unknown): value is Day1Action {
  return (
    value === "calibration" ||
    value === "detector_preview" ||
    value === "day15_fixture_preview" ||
    value === "day15_multi_verse_preview"
  );
}

function getProvider(value: unknown, fallback: Provider): Provider {
  return isProvider(value) ? value : fallback;
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function trySaveRunLog(args: {
  result: unknown;
  mode: string;
  isFixture: boolean;
  fixtureId?: string | null;
}) {
  try {
    const saved = await saveDiscoveryRefineryRun({
      result: args.result,
      mode: args.mode,
      isFixture: args.isFixture,
      fixtureId: args.fixtureId ?? null,
    });

    return {
      saved: !saved.skipped,
      skipped: saved.skipped,
      run_id: saved.run_id,
      signal_count: saved.signal_count,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save run log";

    console.error("[DISCOVERY_REFINERY_DAY1] run-log save failed", {
      mode: args.mode,
      fixtureId: args.fixtureId,
      message,
      error,
    });

    return {
      saved: false,
      skipped: false,
      run_id: null,
      signal_count: 0,
      error: message,
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const action: Day1Action = isDay1Action(body?.action)
      ? body.action
      : "calibration";

    const detectorProvider = getProvider(body?.detectorProvider, "claude");
    const judgeProvider = getProvider(body?.judgeProvider, "openai");
    const verifierProvider = getProvider(body?.verifierProvider, "openai");

    if (action === "calibration") {
      const result = await runDay1Calibration({
        judgeProvider,
        verifierProvider,
      });

      return NextResponse.json({
        ...result,
        run_log: {
          saved: false,
          skipped: true,
          reason: "Calibration is not saved to run-log v0.",
        },
        meta: {
          action,
          purpose:
            "Day-1 calibration checks deterministic duplicate handling, Same-Angle Judge behavior, Verifier behavior, and code routing.",
          next:
            result.ok
              ? "Run detector_preview or day15_fixture_preview."
              : "Inspect failed calibration cases before continuing.",
        },
      });
    }

    if (action === "detector_preview") {
      const result = await runDay1DetectorPreview({
        detectorProvider,
        judgeProvider,
        verifierProvider,
      });

      const runLog = await trySaveRunLog({
        result,
        mode: "fixture_preview",
        isFixture: true,
        fixtureId: "matthew_11_29",
      });

      return NextResponse.json({
        ...result,
        run_log: runLog,
        meta: {
          action,
          purpose:
            "Day-1 detector preview runs argument_structure_mapping_v1 on Matthew 11:29 and creates moderator queue items.",
          next:
            "Review queue items manually. Run-log v0 should now contain this diagnostic run.",
        },
      });
    }

    if (action === "day15_fixture_preview") {
      const fixtureId = getString(body?.fixtureId, "matthew_11_29");

      const result = await runDay15FixturePreview({
        fixtureId,
        detectorProvider,
        judgeProvider,
        verifierProvider,
      });

      const runLog = await trySaveRunLog({
        result,
        mode: "fixture_preview",
        isFixture: true,
        fixtureId,
      });

      return NextResponse.json({
        ...result,
        run_log: runLog,
        meta: {
          action,
          fixtureId,
          purpose:
            "Single-fixture Discovery Refinery preview saves one diagnostic run plus its signal rows to Supabase run-log v0.",
          next:
            "Check discovery_refinery_runs and discovery_refinery_signals in Supabase.",
        },
      });
    }

    const result = await runDay15MultiVersePreview({
      detectorProvider,
      judgeProvider,
      verifierProvider,
    });

    return NextResponse.json({
      ...result,
      run_log: {
        saved: false,
        skipped: true,
        reason:
          "Batch preview is not saved by run-log v0 yet. Save single fixture previews first.",
      },
      meta: {
        ...result.meta,
        action,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery Refinery run failed";

    console.error("[DISCOVERY_REFINERY_DAY1] route error", {
      message,
      error,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
