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
import { getFeaturedAngleCards } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "ru" | "es";

const TARGET_ANGLE_COUNT = 12;

const isLang = (v: unknown): v is Lang =>
  v === "en" || v === "ru" || v === "es";

const isLensId = (v: unknown): v is LensId =>
  typeof v === "string" && (LENS_ORDER as string[]).includes(v);

const isExtraId = (v: unknown): v is ExtraId =>
  typeof v === "string" && (EXTRA_ORDER as string[]).includes(v);

type AngleCardLike = {
  id?: string;
  title: string;
  anchor?: string | null;
  teaser?: string | null;
  why_it_matters?: string | null;
  body?: string | null;
  score_total?: number | null;
  status?: string | null;
  coverage_type?: string | null;
  source?: string | null;
};

function stringifyCachedRawJson(rawJson: unknown): string {
  if (typeof rawJson === "string") return rawJson;
  return JSON.stringify(rawJson);
}

function parseReference(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} {
  const match = reference.trim().match(/^(.+?)\s+(\d+):(\d+)$/);

  if (!match) {
    console.warn("[CACHE] could not parse reference, using fallback", {
      reference,
    });

    return {
      book: reference,
      chapter: 0,
      verse: 0,
    };
  }

  const book = match[1]?.trim() || reference;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);

  return {
    book,
    chapter: Number.isFinite(chapter) ? chapter : 0,
    verse: Number.isFinite(verse) ? verse : 0,
  };
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

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonBlock(text: string): string | null {
  const stripped = stripCodeFence(text);

  if (stripped.startsWith("[") || stripped.startsWith("{")) {
    return stripped;
  }

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return stripped.slice(arrayStart, arrayEnd + 1);
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return stripped.slice(objectStart, objectEnd + 1);
  }

  return null;
}

function parseCacheableJson(text: string): unknown | null {
  const jsonText = extractFirstJsonBlock(text);

  if (!jsonText) {
    console.warn("[CACHE] no JSON block found", {
      preview: text.slice(0, 500),
    });
    return null;
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("[CACHE] JSON parse failed", {
      message: error instanceof Error ? error.message : String(error),
      preview: jsonText.slice(0, 1000),
    });
    return null;
  }
}

function normalizeCachedCards(rawJson: unknown): AngleCardLike[] {
  const value =
    typeof rawJson === "string" ? parseCacheableJson(rawJson) : rawJson;

  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => {
        return typeof item === "object" && item !== null && !Array.isArray(item);
      })
      .map((item) => ({
        title: typeof item.title === "string" ? item.title : "",
        anchor:
          typeof item.anchor === "string"
            ? item.anchor
            : typeof item.support === "string"
              ? item.support
              : null,
        teaser:
          typeof item.teaser === "string"
            ? item.teaser
            : typeof item.text === "string"
              ? item.text
              : typeof item.body === "string"
                ? item.body
                : "",
        why_it_matters:
          typeof item.why_it_matters === "string"
            ? item.why_it_matters
            : typeof item.whyItMatters === "string"
              ? item.whyItMatters
              : null,
        body: typeof item.body === "string" ? item.body : null,
        source: "cached_results",
      }))
      .filter((item) => item.title && item.teaser);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "cards" in value
  ) {
    const cards = (value as { cards?: unknown }).cards;
    return normalizeCachedCards(cards);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "angles" in value
  ) {
    const angles = (value as { angles?: unknown }).angles;
    return normalizeCachedCards(angles);
  }

  return [];
}

async function buildAnglesResponseFromCards(args: {
  reference: string;
  lang: Lang;
}): Promise<string | null> {
  const featuredResult = await getFeaturedAngleCards({
    reference: args.reference,
    lang: args.lang,
    limit: TARGET_ANGLE_COUNT,
  });

  if (!featuredResult.ok || featuredResult.cards.length === 0) {
    return null;
  }

  const featuredCards: AngleCardLike[] = featuredResult.cards.map((card) => ({
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    score_total: card.score_total,
    status: card.status,
    coverage_type: card.coverage_type,
    source: "angle_cards",
  }));

  if (featuredCards.length >= TARGET_ANGLE_COUNT) {
    return JSON.stringify(featuredCards.slice(0, TARGET_ANGLE_COUNT));
  }

  const cached = await getCachedResult(args.reference, "angles", args.lang);
  const cachedCards = cached?.raw_json
    ? normalizeCachedCards(cached.raw_json)
    : [];

  const seenTitles = new Set(
    featuredCards.map((card) => card.title.trim().toLowerCase()),
  );

  const fallbackCards = cachedCards.filter((card) => {
    const titleKey = card.title.trim().toLowerCase();
    if (!titleKey || seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });

  const merged = [...featuredCards, ...fallbackCards].slice(
    0,
    TARGET_ANGLE_COUNT,
  );

  return JSON.stringify(merged);
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
      console.log("[ANGLE_CARDS] lookup", {
        reference,
        lens: "angles",
        lang,
      });

      const angleCardsText = await buildAnglesResponseFromCards({
        reference,
        lang,
      });

      if (angleCardsText) {
        console.log("[ANGLE_CARDS] hit", {
          reference,
          lang,
        });

        return NextResponse.json({
          text: angleCardsText,
          cached: true,
          source: "angle_cards",
        });
      }

      console.log("[ANGLE_CARDS] miss", {
        reference,
        lang,
      });

      const cached = await getCachedResult(reference, "angles", lang);

      if (cached?.raw_json) {
        return NextResponse.json({
          text: stringifyCachedRawJson(cached.raw_json),
          cached: true,
          source: "cached_results",
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

      if (cacheableJson) {
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
      } else {
        console.warn("[CACHE] skipped save because response was not valid JSON", {
          reference,
          lens: "angles",
          lang,
          provider,
          preview: text.slice(0, 1000),
        });
      }
    }

    return NextResponse.json({ text, cached: false });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
