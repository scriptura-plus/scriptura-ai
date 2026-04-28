import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type ExtractedCandidate = {
  id: string;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  estimated_score: number | null;
  strength_reason: string | null;
  risk: string | null;
  source_excerpt: string | null;
};

type RejectedIdea = {
  idea: string;
  reason: string;
};

type ExtractResponse = {
  candidates: ExtractedCandidate[];
  rejected: RejectedIdea[];
  summary: string;
};

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[EXTRACT_CARDS_FROM_MATERIAL] ADMIN_SECRET is not configured");
    return false;
  }

  return req.headers.get("x-admin-secret") === expected;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): unknown {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }

    throw new Error("AI returned non-JSON response");
  }
}

function normalizeCandidate(value: unknown, index: number): ExtractedCandidate | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const title = getString(record.title);
  const teaser = getString(record.teaser);

  if (!title || !teaser) return null;

  const rawScore = getNumber(record.estimated_score);
  const estimatedScore =
    rawScore === null ? null : Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    id: getString(record.id) ?? `manual_candidate_${index + 1}`,
    title,
    anchor: getString(record.anchor),
    teaser,
    why_it_matters: getString(record.why_it_matters),
    estimated_score: estimatedScore,
    strength_reason: getString(record.strength_reason),
    risk: getString(record.risk),
    source_excerpt: getString(record.source_excerpt),
  };
}

function normalizeRejected(value: unknown): RejectedIdea | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const idea = getString(record.idea);
  const reason = getString(record.reason);

  if (!idea || !reason) return null;

  return { idea, reason };
}

function normalizeExtractResponse(parsed: unknown): ExtractResponse {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Extractor returned invalid JSON object");
  }

  const record = parsed as Record<string, unknown>;

  const candidatesRaw = Array.isArray(record.candidates) ? record.candidates : [];
  const rejectedRaw = Array.isArray(record.rejected) ? record.rejected : [];

  const candidates = candidatesRaw
    .map((item, index) => normalizeCandidate(item, index))
    .filter((item): item is ExtractedCandidate => item !== null);

  const rejected = rejectedRaw
    .map(normalizeRejected)
    .filter((item): item is RejectedIdea => item !== null);

  return {
    candidates,
    rejected,
    summary: getString(record.summary) ?? "",
  };
}

function buildManualExtractionPrompt(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  material: string;
  direction: string | null;
}): string {
  const langName =
    args.lang === "ru" ? "Russian" : args.lang === "es" ? "Spanish" : "English";

  return `
You are the Scriptura AI editorial extractor.

All user-visible string values must be written in ${langName}.

Verse:
${args.reference}
"${args.verseText}"

Moderator material:
"""
${args.material}
"""

Moderator direction:
"""
${args.direction ?? "No special direction. Find the strongest card-worthy discoveries in the material."}
"""

Your job:
Find possible short insight cards hidden inside the moderator material.

A good Scriptura card has this structure:
specific textual support → unexpected observation → perceptual shift.

Do NOT merely summarize the material.
Do NOT create sermon points.
Do NOT create generic religious lessons.
Do NOT create a card unless it is specific to this verse or to the immediate biblical argument around it.

Important audience calibration:
The audience is mature Bible readers. They already know common moral lessons.
A card can be simple, but it must feel genuinely fresh to that audience.
Reject ideas that are “true but obvious.”

Candidate rules:
- Extract 1 to 5 candidates.
- Only include candidates that have a realistic chance to become useful cards.
- Prefer fewer strong candidates over many weak ones.
- Each candidate must be different from the others.
- If the material contains only one strong idea, return only one candidate.
- If nothing is strong, return an empty candidates array and explain in summary.

For each candidate:
- title: sharp discovery statement, not a topic.
- anchor: exact phrase / word / contextual hinge / verse detail that supports the card. If unavailable, null.
- teaser: 2–4 sentences. It must read like a card, not like notes.
- why_it_matters: one perceptual shift, not a moral lesson.
- estimated_score: your rough editorial estimate from 0 to 100.
- strength_reason: why this may work for mature Bible readers.
- risk: what may make it weak, obvious, speculative, or duplicate.
- source_excerpt: exact useful sentence or fragment from the material that inspired it.

Rejected ideas:
Also list 0–5 rejected ideas if the material contains weak/obvious candidates.
Give a short reason for each rejection.

Output JSON only. No markdown. No prose outside JSON.

Exact shape:
{
  "summary": "...",
  "candidates": [
    {
      "id": "manual_candidate_1",
      "title": "...",
      "anchor": "...",
      "teaser": "...",
      "why_it_matters": "...",
      "estimated_score": 84,
      "strength_reason": "...",
      "risk": "...",
      "source_excerpt": "..."
    }
  ],
  "rejected": [
    {
      "idea": "...",
      "reason": "..."
    }
  ]
}
`.trim();
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const reference = getString(body?.reference);
    const inputVerseText = getString(body?.verseText);
    const lang = isLang(body?.lang) ? body.lang : "ru";
    const material = getString(body?.material);
    const direction = getString(body?.direction);

    const provider: Provider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();

    if (!reference || !material) {
      return NextResponse.json(
        { error: "reference and material are required" },
        { status: 400 },
      );
    }

    const verseResult = inputVerseText
      ? { reference, text: inputVerseText }
      : await getVerseText(reference, lang, provider);

    const prompt = buildManualExtractionPrompt({
      reference,
      verseText: verseResult.text,
      lang,
      material,
      direction,
    });

    const raw = await runAI(provider, prompt, lang, true);
    const parsed = extractJsonObject(raw);
    const normalized = normalizeExtractResponse(parsed);

    return NextResponse.json({
      ok: true,
      reference,
      lang,
      provider,
      verseText: verseResult.text,
      verse_text_source: inputVerseText ? "request" : "getVerseText",
      ...normalized,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract cards from material",
      },
      { status: 500 },
    );
  }
}
