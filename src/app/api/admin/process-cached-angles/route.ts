import { NextResponse } from "next/server";
import { getCachedResult } from "@/lib/cache/cachedResults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type CandidateCard = {
  id?: string;
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
  body?: string | null;
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
    console.error("[PROCESS_CACHED_ANGLES] ADMIN_SECRET is not configured");
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

function parseMaybeJson(value: unknown): unknown | null {
  if (typeof value !== "string") return value;

  const jsonText = extractFirstJsonBlock(value);

  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function normalizeCandidate(item: unknown, index: number): CandidateCard | null {
  if (!isRecord(item)) return null;

  const title = getString(item.title);
  const teaser =
    getString(item.teaser) ??
    getString(item.text) ??
    getString(item.body) ??
    getString(item.description);

  if (!title || !teaser) return null;

  return {
    id: getString(item.id) ?? `cached_candidate_${index + 1}`,
    title,
    anchor:
      getString(item.anchor) ??
      getString(item.support) ??
      getString(item.key_phrase) ??
      getString(item.keyPhrase),
    teaser,
    why_it_matters:
      getString(item.why_it_matters) ??
      getString(item.whyItMatters) ??
      getString(item.value),
    body: getString(item.body),
  };
}

function normalizeCachedCandidates(rawJson: unknown): CandidateCard[] {
  const parsed = parseMaybeJson(rawJson);

  if (Array.isArray(parsed)) {
    return parsed
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is CandidateCard => Boolean(item));
  }

  if (isRecord(parsed)) {
    if (Array.isArray(parsed.cards)) {
      return parsed.cards
        .map((item, index) => normalizeCandidate(item, index))
        .filter((item): item is CandidateCard => Boolean(item));
    }

    if (Array.isArray(parsed.angles)) {
      return parsed.angles
        .map((item, index) => normalizeCandidate(item, index))
        .filter((item): item is CandidateCard => Boolean(item));
    }

    if (Array.isArray(parsed.items)) {
      return parsed.items
        .map((item, index) => normalizeCandidate(item, index))
        .filter((item): item is CandidateCard => Boolean(item));
    }
  }

  return [];
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
    const provider = getString(body?.provider) ?? "openai";

    const requestedLimit = getNumber(body?.limit) ?? 3;
    const limit = Math.max(1, Math.min(3, requestedLimit));

    if (!reference || !verseText || !lang) {
      return NextResponse.json(
        { error: "reference, verseText, and lang are required" },
        { status: 400 },
      );
    }

    const cached = await getCachedResult(reference, "angles", lang);

    if (!cached?.raw_json) {
      return NextResponse.json({
        ok: true,
        cached_found: false,
        processed_count: 0,
        saved_count: 0,
        skipped_count: 0,
        candidates: [],
        results: [],
      });
    }

    const candidates = normalizeCachedCandidates(cached.raw_json);
    const selectedCandidates = candidates.slice(0, limit);

    const processUrl = new URL(
      "/api/admin/process-angle-candidate",
      req.url,
    ).toString();

    const adminSecret = req.headers.get("x-admin-secret") ?? "";

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
          source_provider: cached.provider ?? provider,
          source_model: cached.model ?? "cached_results",
          candidate,
          sourceArticle: "",
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
      cached_found: true,
      total_candidates_found: candidates.length,
      processed_count: results.length,
      saved_count: savedCount,
      skipped_count: skippedCount,
      candidates: selectedCandidates,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Process cached angles failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
