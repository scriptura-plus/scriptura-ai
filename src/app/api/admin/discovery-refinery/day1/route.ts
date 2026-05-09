import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import {
  runDay1Calibration,
  runDay1DetectorPreview,
} from "@/lib/discovery-refinery/day1/runDay1Pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

type Day1Action = "calibration" | "detector_preview";

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[DISCOVERY_REFINERY_DAY1] ADMIN_SECRET is not configured");
    return false;
  }

  const headerSecret = req.headers.get("x-admin-secret");
  const authHeader = req.headers.get("authorization");

  if (headerSecret === expected) return true;
  if (authHeader === `Bearer ${expected}`) return true;

  return false;
}

function getAction(value: unknown): Day1Action {
  if (value === "detector_preview") return "detector_preview";
  return "calibration";
}

function getProvider(value: unknown, fallback: Provider): Provider {
  return isProvider(value) ? value : fallback;
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));

    const action = getAction(body?.action ?? body?.mode);

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
            "Day-1 calibration checks known-answer cases before running the real detector.",
          next:
            result.ok
              ? "Calibration passed. You can run detector_preview next."
              : "Calibration did not fully pass. Review failed cases before expanding scope.",
        },
      });
    }

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
          result.ok
            ? "Review queue items manually. Do not auto-save anything yet."
            : "Fix detector / judge / verifier issues before proceeding.",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Day-1 pipeline failed";

    console.error("[DISCOVERY_REFINERY_DAY1] route failed", {
      message,
    });

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "/api/admin/discovery-refinery/day1",
    method: "POST",
    actions: ["calibration", "detector_preview"],
    default_action: "calibration",
    default_providers: {
      detectorProvider: "claude",
      judgeProvider: "openai",
      verifierProvider: "openai",
    },
    body_examples: [
      {
        action: "calibration",
        judgeProvider: "openai",
        verifierProvider: "openai",
      },
      {
        action: "detector_preview",
        detectorProvider: "claude",
        judgeProvider: "openai",
        verifierProvider: "openai",
      },
    ],
  });
}
