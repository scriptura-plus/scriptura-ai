import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import {
  runDay1Calibration,
  runDay1DetectorPreview,
  runDay15FixturePreview,
  runDay15MultiVersePreview,
} from "@/lib/discovery-refinery/day1/runDay1Pipeline";

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

function getFixtureId(value: unknown): string {
  if (typeof value !== "string") return "matthew_11_29";

  const trimmed = value.trim();
  return trimmed || "matthew_11_29";
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
        meta: {
          action,
          purpose:
            "Day-1 calibration checks duplicate handling, Same-Angle Judge behavior, Verifier behavior, and code routing.",
          next: result.ok
            ? "Run detector_preview or a single day15_fixture_preview."
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

      return NextResponse.json({
        ...result,
        meta: {
          action,
          purpose:
            "Day-1 detector preview runs argument_structure_mapping_v1 on Matthew 11:29 and creates moderator queue items.",
          next: "Review queue items manually. Do not auto-save anything yet.",
        },
      });
    }

    if (action === "day15_fixture_preview") {
      const fixtureId = getFixtureId(body?.fixtureId);

      const result = await runDay15FixturePreview({
        fixtureId,
        detectorProvider,
        judgeProvider,
        verifierProvider,
      });

      return NextResponse.json({
        ...result,
        meta: {
          ...(result.meta ?? {}),
          action,
          fixtureId,
          purpose:
            "Day-1.5 single-fixture preview runs one verse at a time to avoid long request timeouts.",
          boundary:
            "No Supabase writes, no Studio moderation, no Card Crafter. Diagnostic JSON only.",
          next:
            "Review this single fixture result, then run the next fixture separately.",
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
      meta: {
        ...result.meta,
        action,
        warning:
          "This full multi-verse action can still timeout on Vercel. Prefer day15_fixture_preview one verse at a time.",
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
