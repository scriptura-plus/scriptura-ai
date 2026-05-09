import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import {
  runDay1Calibration,
  runDay1DetectorPreview,
  runDay15MultiVersePreview,
} from "@/lib/discovery-refinery/day1/runDay1Pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

type Day1Action =
  | "calibration"
  | "detector_preview"
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
    value === "day15_multi_verse_preview"
  );
}

function getProvider(value: unknown, fallback: Provider): Provider {
  return isProvider(value) ? value : fallback;
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
            "Day-1 calibration checks deterministic duplicate handling, Same-Angle Judge behavior, Verifier behavior, and code routing.",
          next:
            result.ok
              ? "Run detector_preview or day15_multi_verse_preview."
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
          next:
            "Review queue items manually. Do not auto-save anything yet.",
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
