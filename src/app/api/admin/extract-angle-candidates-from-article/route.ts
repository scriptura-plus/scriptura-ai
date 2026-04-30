import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import {
  getAngleCards,
  type AngleCardRow,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type ExtractedCandidate = {
  id?: string;
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[EXTRACT_ANGLE_CANDIDATES] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJson(text: string): unknown {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    const objectStart = stripped.indexOf("{");
    const objectEnd = stripped.lastIndexOf("}");

    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    }

    const arrayStart = stripped.indexOf("[");
    const arrayEnd = stripped.lastIndexOf("]");

    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    }

    throw new Error("AI returned non-JSON response");
  }
}

function normalizeCandidate(
  value: unknown,
  index: number,
): ExtractedCandidate | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) return null;

  return {
    id: getString(value.id) ?? `article_candidate_${index + 1}`,
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters:
      getString(value.why_it_matters) ?? getString(value.whyItMatters),
  };
}

function normalizeCandidates(value: unknown): ExtractedCandidate[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is ExtractedCandidate => Boolean(item));
  }

  if (isRecord(value) && Array.isArray(value.candidates)) {
    return value.candidates
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is ExtractedCandidate => Boolean(item));
  }

  if (isRecord(value) && Array.isArray(value.cards)) {
    return value.cards
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is ExtractedCandidate => Boolean(item));
  }

  return [];
}

function cardForPrompt(card: AngleCardRow) {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    angle_summary: card.angle_summary,
    coverage_type: card.coverage_type,
    score_total: card.score_total,
    status: card.status,
  };
}

function buildExtractionPrompt(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  sourceTitle: string;
  sourceType: string;
  sourceLens: string;
  sourceArticle: string;
  existingCards: AngleCardRow[];
  count: number;
}): string {
  const existing = args.existingCards.map(cardForPrompt);

  const languageInstruction =
    args.lang === "ru"
      ? "Пиши по-русски."
      : args.lang === "es"
        ? "Write in Spanish."
        : "Write in English.";

  return `
You are Scriptura AI's senior editorial extractor.

Your task:
Read the source article below and extract up to ${args.count} NEW candidate "pearl" cards for the verse.

A pearl card is NOT a summary of the article.
A pearl card is one strong, text-anchored, memorable insight that can stand alone as a short reading card.

Verse reference:
${args.reference}

Verse text:
${args.verseText}

Language:
${args.lang}
${languageInstruction}

Source type:
${args.sourceType}

Source lens:
${args.sourceLens}

Source title:
${args.sourceTitle}

Existing cards already stored for this verse:
${JSON.stringify(existing, null, 2)}

Source article:
${args.sourceArticle}

Critical extraction rules:
1. Extract only genuinely card-worthy insights from the article.
2. Do NOT summarize the whole article.
3. Do NOT create a candidate if the article does not contain a strong enough angle.
4. Do NOT repeat existing cards or the same angle in different words.
5. Each candidate must have a specific textual anchor: word, phrase, syntax, contrast, context, or quotation from the verse/source.
6. If the idea depends on a selected article detail, preserve the key detail accurately.
7. Avoid generic moral comments.
8. Avoid invented facts.
9. Avoid overconfident Greek/Hebrew claims unless the article clearly supports them.
10. Prefer "I never noticed that" discoveries.
11. Make each card short enough for mobile reading.
12. If only one good candidate exists, return only one. Do not force ${args.count}.

Output ONLY valid JSON.

Return this exact shape:
{
  "candidates": [
    {
      "id": "article_candidate_1",
      "title": "...",
      "anchor": "...",
      "teaser": "...",
      "why_it_matters": "..."
    }
  ]
}

Card style:
- title: short, memorable, not clickbait
- anchor: exact textual support
- teaser: 3-5 sentences, specific and explanatory
- why_it_matters: 1-2 sentences
`.trim();
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const reference = getString(body?.reference);
    const verseText = getString(body?.verseText);
    const lang = isLang(body?.lang) ? body.lang : null;

    const sourceArticle = getString(body?.sourceArticle);
    const sourceTitle = getString(body?.sourceTitle) ?? "Untitled article";
    const sourceType = getString(body?.sourceType) ?? "lens_article";
    const sourceLens = getString(body?.sourceLens) ?? "unknown";

    const provider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();

    const requestedCount = getNumber(body?.count) ?? 3;
    const count = Math.max(1, Math.min(5, requestedCount));

    const requestedProcessLimit = getNumber(body?.processLimit) ?? 3;
    const processLimit = Math.max(1, Math.min(6, requestedProcessLimit));

    if (!reference || !verseText || !lang || !sourceArticle) {
      return NextResponse.json(
        {
          error:
            "reference, verseText, lang, and sourceArticle are required",
        },
        { status: 400 },
      );
    }

    const existing = await getAngleCards({
      reference,
      lang,
      statuses: ["featured", "reserve"],
      limit: 100,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { error: existing.error ?? "Failed to read existing angle cards" },
        { status: 500 },
      );
    }

    const prompt = buildExtractionPrompt({
      reference,
      verseText,
      lang,
      sourceTitle,
      sourceType,
      sourceLens,
      sourceArticle,
      existingCards: existing.cards,
      count,
    });

    const raw = await runAI(provider, prompt, lang, true);
    const parsed = extractJson(raw);
    const candidates = normalizeCandidates(parsed);
    const selectedCandidates = candidates.slice(0, processLimit);

    const adminSecret = req.headers.get("x-admin-secret") ?? "";

    const processUrl = new URL(
      "/api/admin/process-angle-candidate",
      req.url,
    ).toString();

    const results = [];

    for (const candidate of selectedCandidates) {
      const response = await fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference,
          verseText,
          lang,
          provider,
          source_provider: provider,
          source_model: `article_extractor_v1:${sourceLens}`,
          candidate,
          sourceArticle,
          targetFeaturedCount: 12,
        }),
      });

      const data = await response.json();

      results.push({
        candidate_title: candidate.title,
        status: response.status,
        ok: response.ok,
        data,
      });
    }

    const savedCount = results.filter((item) => {
      return isRecord(item.data) && typeof item.data.saved_id === "string";
    }).length;

    const skippedCount = results.filter((item) => {
      return isRecord(item.data) && item.data.skipped === true;
    }).length;

    return NextResponse.json({
      ok: true,
      extractor_prompt_version: "article_extractor_v1",
      source: {
        source_type: sourceType,
        source_lens: sourceLens,
        source_title: sourceTitle,
      },
      existing_cards_checked: existing.cards.length,
      extracted_count: candidates.length,
      processed_count: results.length,
      saved_count: savedCount,
      skipped_count: skippedCount,
      candidates,
      processed_candidates: selectedCandidates,
      results,
      raw,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Extract angle candidates from article failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
