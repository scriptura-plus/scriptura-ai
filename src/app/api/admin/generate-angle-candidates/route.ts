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

type GeneratedCandidate = {
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
    console.error("[GENERATE_ANGLE_CANDIDATES] ADMIN_SECRET is not configured");
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
    const arrayStart = stripped.indexOf("[");
    const arrayEnd = stripped.lastIndexOf("]");

    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    }

    const objectStart = stripped.indexOf("{");
    const objectEnd = stripped.lastIndexOf("}");

    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    }

    throw new Error("AI returned non-JSON response");
  }
}

function normalizeCandidate(
  value: unknown,
  index: number,
): GeneratedCandidate | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) return null;

  return {
    id: getString(value.id) ?? `generated_candidate_${index + 1}`,
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters:
      getString(value.why_it_matters) ?? getString(value.whyItMatters),
  };
}

function normalizeCandidates(value: unknown): GeneratedCandidate[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is GeneratedCandidate => Boolean(item));
  }

  if (isRecord(value) && Array.isArray(value.candidates)) {
    return value.candidates
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is GeneratedCandidate => Boolean(item));
  }

  if (isRecord(value) && Array.isArray(value.cards)) {
    return value.cards
      .map((item, index) => normalizeCandidate(item, index))
      .filter((item): item is GeneratedCandidate => Boolean(item));
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

function buildGenerationPrompt(args: {
  reference: string;
  verseText: string;
  lang: Lang;
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
You are Scriptura AI's senior angle-candidate generator.

Task:
Generate ${args.count} NEW candidate insight cards for the Bible verse below.

Verse reference:
${args.reference}

Verse text:
${args.verseText}

Language:
${args.lang}
${languageInstruction}

Existing cards already stored for this verse:
${JSON.stringify(existing, null, 2)}

Main goal:
Find genuinely NEW angles that are NOT already represented by the existing cards.

Already represented angles — DO NOT repeat:
1. "compassion" as inner organs / inward bodily reaction / εὔσπλαγχνοι.
2. forgiveness "in Christ" / through Christ as sphere / ἐν Χριστῷ.
3. pronoun shift around "one another" / ἀλλήλους vs ἑαυτοῖς.
4. forgiveness as gift / χαρίζομαι / charis-root word.
5. sequence: kindness → compassion → forgiveness.
6. Ephesians 4:31 replaced by kindness / bitterness removed and replaced.
7. "be" as "become" / γίνεσθε / process of becoming.
8. forgiveness grammatically built into "be kind" / forgiving as how kindness acts.

Before writing candidates, mentally select ONLY from still-underrepresented categories.

Preferred underrepresented categories:
A. imitation logic: the force of "as God..." / pattern, not payment.
B. received-before-given logic: God forgave first; human forgiveness responds.
C. plural/community layer: "you", "one another", "you" as community culture, but do NOT repeat the pronoun-shift card.
D. relation to Ephesians 4:30: grieving the holy spirit and community speech.
E. rhetorical hinge: "And/but you" as identity contrast, but do NOT repeat the verse 31 replacement card.
F. moral logic of reciprocity: forgiven people become forgiving people.
G. relation to "new personality/new self" context in Ephesians 4:24.
H. passive/active contrast in the verse: God acted toward you; you act toward one another.
I. sentence-level grounding: why the final clause is the foundation of the whole command.
J. lexical or contextual detail not already covered.

Critical rules:
1. Do NOT repeat the same angles already represented in existing cards.
2. Do NOT merely repackage a covered card with a different title.
3. Each candidate must name a clear angle category in its own thinking, but do not output the category separately.
4. Each card must be text-anchored: it must point to a specific word, phrase, syntax, structure, contrast, or immediate context.
5. Avoid generic moral comments.
6. Avoid invented facts.
7. Prefer "I never noticed that" discoveries.
8. If an idea is uncertain, phrase it carefully.
9. Do NOT overstate Greek grammar.
10. Do NOT make theological claims that are not anchored in the verse/context.

Output ONLY valid JSON.

Return this exact shape:
{
  "candidates": [
    {
      "id": "generated_candidate_1",
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
    const provider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();

    const requestedCount = getNumber(body?.count) ?? 6;
    const count = Math.max(1, Math.min(10, requestedCount));

    const requestedProcessLimit = getNumber(body?.processLimit) ?? 3;
    const processLimit = Math.max(1, Math.min(3, requestedProcessLimit));

    if (!reference || !verseText || !lang) {
      return NextResponse.json(
        { error: "reference, verseText, and lang are required" },
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

    const prompt = buildGenerationPrompt({
      reference,
      verseText,
      lang,
      existingCards: existing.cards,
      count,
    });

    const raw = await runAI(provider, prompt, lang, true);
    const parsed = extractJson(raw);
    const candidates = normalizeCandidates(parsed);
    const selectedCandidates = candidates.slice(0, processLimit);

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
          source_provider: provider,
          source_model: "generated_candidates_v2",
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
      generation_prompt_version: "generated_candidates_v2",
      existing_cards_checked: existing.cards.length,
      generated_count: candidates.length,
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
        : "Generate angle candidates failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
