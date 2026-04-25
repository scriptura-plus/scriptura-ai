import { NextResponse } from "next/server";
import { getCachedResult } from "@/lib/cache/cachedResults";
import {
  getAngleCards,
  type AngleCardRow,
} from "@/lib/cache/angleCards";

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

type ExistingSignatureSet = {
  titles: Set<string>;
  originalTitles: Set<string>;
  anchors: Set<string>;
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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[«»"“”'‘’.,;:!?()[\]{}—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function getOriginalTitle(card: AngleCardRow): string | null {
  if (!isRecord(card.original_card)) return null;
  return getString(card.original_card.title);
}

function buildExistingSignatureSet(cards: AngleCardRow[]): ExistingSignatureSet {
  const titles = new Set<string>();
  const originalTitles = new Set<string>();
  const anchors = new Set<string>();

  for (const card of cards) {
    const title = normalizeText(card.title);
    if (title) titles.add(title);

    const originalTitle = normalizeText(getOriginalTitle(card));
    if (originalTitle) originalTitles.add(originalTitle);

    const anchor = normalizeText(card.anchor);
    if (anchor) anchors.add(anchor);
  }

  return {
    titles,
    originalTitles,
    anchors,
  };
}

function isAlreadyRepresented(
  candidate: CandidateCard,
  signatures: ExistingSignatureSet,
): {
  duplicate: boolean;
  reason: string | null;
} {
  const title = normalizeText(candidate.title);
  const anchor = normalizeText(candidate.anchor);

  if (title && signatures.titles.has(title)) {
    return {
      duplicate: true,
      reason: "existing_title",
    };
  }

  if (title && signatures.originalTitles.has(title)) {
    return {
      duplicate: true,
      reason: "existing_original_title",
    };
  }

  if (anchor && signatures.anchors.has(anchor)) {
    return {
      duplicate: true,
      reason: "existing_anchor",
    };
  }

  return {
    duplicate: false,
    reason: null,
  };
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
        pre_skipped_count: 0,
        candidates: [],
        results: [],
      });
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

    const signatures = buildExistingSignatureSet(existing.cards);

    const candidates = normalizeCachedCandidates(cached.raw_json);

    const selectedCandidates: CandidateCard[] = [];
    const preSkippedResults = [];

    for (const candidate of candidates) {
      const duplicateCheck = isAlreadyRepresented(candidate, signatures);

      if (duplicateCheck.duplicate) {
        preSkippedResults.push({
          candidate_title: candidate.title,
          status: 200,
          ok: true,
          data: {
            ok: true,
            skipped: true,
            skip_reason: "already_represented",
            duplicate_reason: duplicateCheck.reason,
            saved_id: null,
            status: "skipped_existing",
          },
        });
        continue;
      }

      selectedCandidates.push(candidate);

      if (selectedCandidates.length >= limit) break;
    }

    const processUrl = new URL(
      "/api/admin/process-angle-candidate",
      req.url,
    ).toString();

    const adminSecret = req.headers.get("x-admin-secret") ?? "";

    const processedResults = [];

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

      processedResults.push({
        candidate_title: candidate.title,
        status: response.status,
        ok: response.ok,
        data,
      });
    }

    const results = [...preSkippedResults, ...processedResults];

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
      existing_cards_checked: existing.cards.length,
      requested_process_limit: limit,
      pre_skipped_count: preSkippedResults.length,
      processed_count: processedResults.length,
      saved_count: savedCount,
      skipped_count: skippedCount,
      candidates_selected_for_processing: selectedCandidates,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Process cached angles failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
