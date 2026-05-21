import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import type { Lang } from "@/lib/i18n/dictionary";
import { runPearlV3 } from "@/lib/pearl-v3/runPearlV3";
import {
  mapPearlV3ResultToPublishedCards,
  savePublishedLensSet,
} from "@/lib/cache/publishedLensSets";

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

function isAuthorized(request: Request): boolean {
  const adminSecret = process.env.ADMIN_SECRET?.trim();

  if (!adminSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret = request.headers.get("x-admin-secret")?.trim();
  return providedSecret === adminSecret;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const reference = getString(body?.reference);
    const verseText = getString(body?.verseText);
    const lang: Lang = isLang(body?.lang) ? body.lang : "ru";
    const provider: Provider = isProvider(body?.provider)
      ? body.provider
      : "claude";

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "reference is required" },
        { status: 400 },
      );
    }

    const pearlResult = await runPearlV3({
      reference,
      verseText,
      lang,
      provider,
      options: {
        writeLimit: getNumber(body?.writeLimit) ?? 12,
        targetCount: getNumber(body?.targetCount) ?? 6,
        minScore: getNumber(body?.minScore) ?? 70,
        includeRaw: Boolean(body?.includeRaw),
      },
    });

    const cards = mapPearlV3ResultToPublishedCards(pearlResult);

    if (cards.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pearl v3 produced no publishable cards.",
          pearlResult,
        },
        { status: 422 },
      );
    }

    const saved = await savePublishedLensSet({
      canonicalRef: pearlResult.canonicalRef ?? reference,
      referenceLabel: pearlResult.verseContext.centralRef ?? reference,
      lang,
      lensId: "pearl",
      sourcePipeline: "pearl_v3",
      sourceModel: pearlResult.model,
      generatedAt: new Date().toISOString(),
      metadata: {
        reference,
        provider,
        debug: pearlResult.debug,
        lexiconAvailable: pearlResult.lexiconAvailable,
      },
      cards,
    });

    if (saved.error || !saved.data) {
      return NextResponse.json(
        {
          ok: false,
          error: saved.error ?? "Failed to save published Pearl set.",
          pearlResult,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      source: "published_lens_sets",
      lensId: "pearl",
      model: pearlResult.model,
      reference,
      canonicalRef: pearlResult.canonicalRef,
      setId: saved.data.set.id,
      version: saved.data.set.version,
      savedCards: saved.data.cards.length,
      pearlDebug: pearlResult.debug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[PUBLISHED_PEARL_V3_GENERATE] failed", {
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
