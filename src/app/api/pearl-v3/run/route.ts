import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import type { Lang } from "@/lib/i18n/dictionary";
import { runPearlV3 } from "@/lib/pearl-v3/runPearlV3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "ru" || value === "es";
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const reference = getString(body?.reference);
    const verseText = getString(body?.verseText);
    const lang: Lang = isLang(body?.lang) ? body.lang : "ru";
    const provider: Provider = isProvider(body?.provider)
      ? body.provider
      : "gemini";

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "reference is required" },
        { status: 400 },
      );
    }

    const result = await runPearlV3({
      reference,
      verseText,
      lang,
      provider,
      options: {
        writeLimit: getNumber(body?.writeLimit),
        targetCount: getNumber(body?.targetCount),
        minScore: getNumber(body?.minScore),
        includeRaw: Boolean(body?.includeRaw),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[PEARL_V3_RUN] failed", {
      error: message,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
