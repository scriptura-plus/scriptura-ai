import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import {
  buildLensPrompt,
  type LensId,
  LENS_ORDER,
} from "@/lib/prompts/buildLensPrompt";
import {
  buildExtraPrompt,
  type ExtraId,
  EXTRA_ORDER,
} from "@/lib/prompts/buildExtraPrompt";
import { buildExpandPrompt } from "@/lib/prompts/buildExpandPrompt";
import { getCachedResult, saveCachedResult } from "@/lib/cache/cachedResults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "ru" | "es";

const isLang = (v: unknown): v is Lang =>
  v === "en" || v === "ru" || v === "es";

const isLensId = (v: unknown): v is LensId =>
  typeof v === "string" && (LENS_ORDER as string[]).includes(v);

const isExtraId = (v: unknown): v is ExtraId =>
  typeof v === "string" && (EXTRA_ORDER as string[]).includes(v);

function stringifyCachedRawJson(rawJson: unknown): string {
  if (typeof rawJson === "string") return rawJson;
  return JSON.stringify(rawJson);
}

function parseReference(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} | null {
  const match = reference.trim().match(/^(.+?)\s+(\d+):(\d+)$/);

  if (!match) return null;

  const book = match[1]?.trim();
  const chapter = Number(match[2]);
  const verse = Number(match[3]);

  if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return null;
  }

  return { book, chapter, verse };
}

function getModelName(provider: string): string {
  if (provider === "openai") {
    return process.env.OPENAI_MODEL || "gpt-5.5";
  }

  if (provider === "claude") {
    return process.env.ANTHROPIC_MODEL || "claude";
  }

  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  return provider;
}

function parseCacheableJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const kind = body?.kind;
    const id = body?.id;
    const reference =
      typeof body?.reference === "string" ? body.reference.trim() : "";
    const verseText =
      typeof body?.verseText === "string" ? body.verseText.trim() : "";
    const lang: Lang = isLang(body?.lang) ? body.lang : "en";
    const provider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();

    if (!reference || !verseText) {
      return NextResponse.json(
        { error: "reference and verseText are required" },
        { status: 400 },
      );
    }

    const shouldUseAnglesCache =
      kind === "lens" && id === "angles" && isLensId(id);

    if (shouldUseAnglesCache) {
      const cached = await getCachedResult(reference, "angles", lang);

      if (cached?.raw_json) {
        return NextResponse.json({
          text: stringifyCachedRawJson(cached.raw_json),
          cached: true,
        });
      }
    }

    let prompt: string;
    let expectJSON = false;

    if (kind === "lens" && isLensId(id)) {
      prompt = buildLensPrompt({ lens: id, reference, verseText, lang });
      expectJSON = true;
    } else if (kind === "extra" && isExtraId(id)) {
      prompt = buildExtraPrompt({ id, reference, verseText, lang });
      expectJSON = true;
    } else if (kind === "context") {
      const { buildContextPrompt } = await import(
        "@/lib/prompts/buildContextPrompt"
      );
      prompt = buildContextPrompt({ reference, verseText, lang });
      expectJSON = true;
    } else if (kind === "expand-angle") {
      const angleTitle =
        typeof body?.angleTitle === "string" ? body.angleTitle.trim() : "";
      const anchor = typeof body?.anchor === "string" ? body.anchor.trim() : "";

      if (!angleTitle) {
        return NextResponse.json(
          { error: "angleTitle is required for expand-angle" },
          { status: 400 },
        );
      }

      prompt = buildExpandPrompt({
        angleTitle,
        anchor,
        reference,
        verseText,
        lang,
      });

      // expand-angle returns prose markdown, not JSON.
    } else {
      return NextResponse.json(
        {
          error:
            "kind must be 'lens', 'extra', 'context', or 'expand-angle' with a valid id",
        },
        { status: 400 },
      );
    }

    const text = await runAI(provider, prompt, lang, expectJSON);

    // DEBUG: log raw Gemini output for structured lenses.
    if (provider === "gemini" && expectJSON) {
      console.log("[DEBUG gemini raw]", {
        kind,
        id: id ?? null,
        len: text.length,
        first: text[0] ?? "(empty)",
        last: text[text.length - 1] ?? "(empty)",
        preview: text.slice(0, 2000),
      });
    }

    if (shouldUseAnglesCache) {
      const parsedReference = parseReference(reference);
      const cacheableJson = parseCacheableJson(text);

      if (parsedReference && cacheableJson) {
        await saveCachedResult({
          reference,
          book: parsedReference.book,
          chapter: parsedReference.chapter,
          verse: parsedReference.verse,
          lens: "angles",
          lang,
          provider,
          model: getModelName(provider),
          raw_json: cacheableJson,
        });
      }
    }

    return NextResponse.json({ text, cached: false });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
