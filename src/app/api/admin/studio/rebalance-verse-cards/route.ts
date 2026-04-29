import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { rebalanceVerseCards } from "@/lib/angles/rebalanceVerseCards";
import type { AngleCardLang } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[STUDIO_REBALANCE_VERSE_CARDS] ADMIN_SECRET is not configured");
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

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isLang(value: unknown): value is AngleCardLang {
  return value === "ru" || value === "en" || value === "es";
}

function resolveEditorProvider(bodyProvider: unknown): Provider {
  if (isProvider(bodyProvider)) return bodyProvider;

  const envProvider = process.env.ANGLE_EDITOR_PROVIDER;

  if (isProvider(envProvider)) return envProvider;

  return "claude";
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    const reference = getString(body.reference);
    const canonical_ref = getString(body.canonical_ref);
    const lang = isLang(body.lang) ? body.lang : null;
    const verseText = getString(body.verseText);
    const targetFeaturedCount = getNumber(body.targetFeaturedCount) ?? 100;
    const maxCards = getNumber(body.maxCards) ?? 24;
    const apply = getBoolean(body.apply) ?? false;
    const provider = resolveEditorProvider(body.provider);

    if (!reference || !lang) {
      return NextResponse.json(
        { error: "reference and lang are required" },
        { status: 400 },
      );
    }

    const result = await rebalanceVerseCards({
      reference,
      canonical_ref,
      lang,
      verseText,
      provider,
      targetFeaturedCount,
      maxCards,
      apply,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Rebalance verse cards failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
