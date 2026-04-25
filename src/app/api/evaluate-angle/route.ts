import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import {
  buildEvaluateAnglePrompt,
  type EvaluateAngleCard,
} from "@/lib/prompts/buildEvaluateAnglePrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "ru" | "es";

const isLang = (value: unknown): value is Lang =>
  value === "en" || value === "ru" || value === "es";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvaluateAngleCard(value: unknown): value is EvaluateAngleCard {
  if (!isPlainObject(value)) return false;
  return typeof value.title === "string" && value.title.trim().length > 0;
}

function normalizeCardArray(value: unknown): EvaluateAngleCard[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isEvaluateAngleCard);
}

function extractJsonObject(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("Evaluator returned non-JSON response");
  }
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[EVALUATOR] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const reference =
      typeof body?.reference === "string" ? body.reference.trim() : "";
    const verseText =
      typeof body?.verseText === "string" ? body.verseText.trim() : "";
    const lang: Lang = isLang(body?.lang) ? body.lang : "en";
    const provider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();

    const candidate = body?.candidate;

    if (!reference || !verseText) {
      return NextResponse.json(
        { error: "reference and verseText are required" },
        { status: 400 },
      );
    }

    if (!isEvaluateAngleCard(candidate)) {
      return NextResponse.json(
        { error: "candidate card with title is required" },
        { status: 400 },
      );
    }

    const featuredCards = normalizeCardArray(body?.featuredCards);
    const reserveCards = normalizeCardArray(body?.reserveCards);
    const sourceArticle =
      typeof body?.sourceArticle === "string"
        ? body.sourceArticle.trim()
        : undefined;

    const targetFeaturedCount =
      typeof body?.targetFeaturedCount === "number" &&
      Number.isFinite(body.targetFeaturedCount)
        ? body.targetFeaturedCount
        : 12;

    const prompt = buildEvaluateAnglePrompt({
      reference,
      verseText,
      lang,
      candidate,
      featuredCards,
      reserveCards,
      sourceArticle,
      targetFeaturedCount,
    });

    const text = await runAI(provider, prompt, lang, true);
    const evaluation = extractJsonObject(text);

    return NextResponse.json({
      evaluation,
      raw: text,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Angle evaluation failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
