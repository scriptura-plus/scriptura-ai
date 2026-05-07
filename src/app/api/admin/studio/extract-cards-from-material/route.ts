import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { getAngleCards, type AngleCardRow } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";
type MaterialMode = "normal" | "deep_search_report" | "ready_cards_json";

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

function normalizeMaterialMode(value: unknown): MaterialMode {
  if (value === "normal" || value === "material") return "normal";

  if (value === "deep_search_report" || value === "deep_report") {
    return "deep_search_report";
  }

  if (value === "ready_cards_json" || value === "ready_json") {
    return "ready_cards_json";
  }

  return "normal";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[EXTRACT_CARDS_FROM_MATERIAL] ADMIN_SECRET is not configured");
    return false;
  }

  return req.headers.get("x-admin-secret") === expected;
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

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = getString(record[key]);
    if (value) return value;
  }

  return null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonCandidate(text: string): string {
  const stripped = stripCodeFence(text);

  try {
    JSON.parse(stripped);
    return stripped;
  } catch {
    // Continue to extraction attempts.
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return stripped.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return stripped.slice(arrayStart, arrayEnd + 1);
  }

  return stripped;
}

function extractJsonObjectStrict(text: string): unknown {
  const candidate = extractJsonCandidate(text);
  return JSON.parse(candidate);
}

async function repairJsonWithAI(args: {
  provider: Provider;
  lang: Lang;
  brokenJson: string;
  parseError: string;
}): Promise<unknown> {
  const repairPrompt = `
You are a JSON repair tool.

The following text was supposed to be valid JSON, but JSON.parse failed.

Parse error:
${args.parseError}

Broken JSON-like text:
"""
${args.brokenJson}
"""

Repair it into valid JSON.

Rules:
- Output valid JSON only.
- Do not add new ideas.
- Do not remove useful cards unless the syntax is impossible to repair.
- Preserve all Russian/English/Spanish user-visible text as much as possible.
- Escape quotation marks correctly.
- Remove markdown, LaTeX delimiters, trailing comments, and illegal control characters if needed.
- The final JSON must be either:
  {
    "summary": "...",
    "candidates": [...],
    "rejected": [...]
  }
  or
  {
    "cards": [...]
  }

Output JSON only.
`.trim();

  const repaired = await runAI(args.provider, repairPrompt, args.lang, true);
  const repairedCandidate = extractJsonCandidate(repaired);

  return JSON.parse(repairedCandidate);
}

async function extractJsonObjectWithRepair(args: {
  text: string;
  provider: Provider;
  lang: Lang;
}): Promise<{
  parsed: unknown;
  repaired: boolean;
  raw_for_debug: string;
}> {
  const candidate = extractJsonCandidate(args.text);

  try {
    return {
      parsed: JSON.parse(candidate),
      repaired: false,
      raw_for_debug: args.text,
    };
  } catch (error) {
    const parseError =
      error instanceof Error ? error.message : "Unknown JSON parse error";

    const parsed = await repairJsonWithAI({
      provider: args.provider,
      lang: args.lang,
      brokenJson: candidate,
      parseError,
    });

    return {
      parsed,
      repaired: true,
      raw_for_debug: args.text,
    };
  }
}

function cleanShortText(value: string | null, maxLength: number): string | null {
  if (!value) return null;

  const cleaned = value
    .replace(/\$\$/g, "")
    .replace(/```/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function normalizeScore(value: unknown): number | null {
  const rawScore = getNumber(value);
  if (rawScore === null) return null;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

function normalizeCandidate(
  value: unknown,
  index: number,
  prefix = "manual_candidate",
): ExtractedCandidate | null {
  if (!isRecord(value)) return null;

  const title = firstString(value, ["title", "заголовок", "heading"]);
  const teaser = firstString(value, [
    "teaser",
    "body",
    "summary",
    "description",
    "кратко",
    "текст",
  ]);

  if (!title || !teaser) return null;

  const estimatedScore = normalizeScore(
    value.estimated_score ??
      value.discovery_score ??
      value.score_total ??
      value.score,
  );

  const sourceBasis = firstString(value, [
    "source_basis",
    "sourceBasis",
    "evidence",
    "basis",
  ]);

  const riskNote = firstString(value, ["risk_note", "riskNote", "risk"]);

  return {
    id: firstString(value, ["id"]) ?? `${prefix}_${index + 1}`,
    title: cleanShortText(title, 120) ?? title,
    anchor: cleanShortText(
      firstString(value, [
        "anchor",
        "textual_anchor",
        "textualAnchor",
        "опора",
      ]),
      260,
    ),
    teaser: cleanShortText(teaser, 900) ?? teaser,
    why_it_matters: cleanShortText(
      firstString(value, [
        "why_it_matters",
        "whyItMatters",
        "why",
        "почему_важно",
      ]),
      420,
    ),
    estimated_score: estimatedScore,
    strength_reason: cleanShortText(
      firstString(value, ["strength_reason", "strengthReason"]) ?? sourceBasis,
      420,
    ),
    risk: cleanShortText(riskNote, 360),
    source_excerpt: cleanShortText(
      firstString(value, ["source_excerpt", "sourceExcerpt"]) ?? sourceBasis,
      260,
    ),
  };
}

function normalizeRejected(value: unknown): RejectedIdea | null {
  if (!isRecord(value)) return null;

  const idea = cleanShortText(getString(value.idea), 180);
  const reason = cleanShortText(getString(value.reason), 360);

  if (!idea || !reason) return null;

  return { idea, reason };
}

function normalizeExtractResponse(parsed: unknown): ExtractResponse {
  if (!isRecord(parsed)) {
    throw new Error("Extractor returned invalid JSON object");
  }

  const candidatesRaw = Array.isArray(parsed.candidates)
    ? parsed.candidates
    : Array.isArray(parsed.cards)
      ? parsed.cards
      : [];

  const rejectedRaw = Array.isArray(parsed.rejected) ? parsed.rejected : [];

  const candidates = candidatesRaw
    .map((item, index) => normalizeCandidate(item, index))
    .filter((item): item is ExtractedCandidate => item !== null);

  const rejected = rejectedRaw
    .map(normalizeRejected)
    .filter((item): item is RejectedIdea => item !== null);

  return {
    candidates,
    rejected,
    summary: cleanShortText(getString(parsed.summary), 700) ?? "",
  };
}

function normalizeReadyCardsJson(parsed: unknown): ExtractResponse {
  const rawCards = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.cards)
      ? parsed.cards
      : isRecord(parsed) && Array.isArray(parsed.candidates)
        ? parsed.candidates
        : [];

  const candidates = rawCards
    .map((item, index) => normalizeCandidate(item, index, "ready_card"))
    .filter((item): item is ExtractedCandidate => item !== null);

  return {
    candidates,
    rejected: [],
    summary: candidates.length
      ? `Готовые JSON-карточки распознаны: ${candidates.length}. Теперь их можно отправить в обычную проверку и сохранение.`
      : "Готовые JSON-карточки не найдены. Проверь, что вставлен объект с массивом cards или candidates.",
  };
}

function compactExistingCard(card: AngleCardRow) {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    angle_summary: card.angle_summary,
    status: card.status,
    score_total: card.score_total,
    coverage_type: card.coverage_type,
  };
}

function buildManualExtractionPrompt(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  material: string;
  direction: string | null;
  materialMode: MaterialMode;
  existingCards: AngleCardRow[];
}): string {
  const langName =
    args.lang === "ru" ? "Russian" : args.lang === "es" ? "Spanish" : "English";

  const isDeepSearch = args.materialMode === "deep_search_report";
  const maxCandidates = isDeepSearch ? 20 : 7;

  const modeInstruction = isDeepSearch
    ? `
This moderator material is an external Deep Search / research report.

Your job is to turn the strongest net-new discoveries in the report into polished candidate Scriptura cards.

Important:
- Do NOT summarize the report.
- Do NOT preserve weak ideas just because they appear in the report.
- Do NOT artificially limit good discoveries to 3 or 5.
- Extract as many genuinely card-worthy, non-duplicate candidates as the report supports, up to ${maxCandidates}.
- If the report contains 12 strong net-new angles, return 12.
- If it contains only 2 strong net-new angles, return 2.
- Filter only duplicates, weak paraphrases, unsupported claims, and overclaim.
`
    : `
This moderator material may be a short note, paragraph, article, or idea.

Your job:
Find possible short insight cards hidden inside the moderator material.

Candidate rules:
- Extract 1 to ${maxCandidates} candidates.
- Only include candidates that have a realistic chance to become useful cards.
- Prefer fewer strong candidates over many weak ones.
- If the material contains only one strong idea, return only one candidate.
`;

  return `
You are the Scriptura AI editorial extractor and card writer.

Primary model strategy:
Use Claude as a careful Scriptura card writer: discovery-first, elegant, precise, not preachy.

All user-visible string values must be written in ${langName}.

Verse:
${args.reference}
"${args.verseText}"

Existing Scriptura cards already stored for this verse:
${JSON.stringify(args.existingCards.map(compactExistingCard), null, 2)}

Moderator material:
"""
${args.material}
"""

Moderator direction:
"""
${args.direction ?? "No special direction. Find the strongest card-worthy discoveries in the material."}
"""

${modeInstruction}

A good Scriptura card has this structure:
specific textual support → unexpected observation → perceptual shift.

Do NOT merely summarize the material.
Do NOT create sermon points.
Do NOT create generic religious lessons.
Do NOT repeat existing cards in new words.
Do NOT create a card unless it is specific to this verse or to the immediate biblical argument around it.

Important audience calibration:
The audience is mature Bible readers. They already know common moral lessons.
A card can be simple, but it must feel genuinely fresh to that audience.
Reject ideas that are “true but obvious.”

Style requirements:
- Write like a premium Scriptura card, not like a classroom note.
- Use a hook, but do not overdramatize.
- Keep the claim careful and textually grounded.
- Prefer concrete textual mechanisms over broad religious conclusions.

JSON safety rules:
- Return valid JSON only.
- No markdown.
- No code fences.
- No LaTeX.
- No $$ delimiters.
- No multiline strings.
- Escape quotation marks correctly.
- source_excerpt must be plain text, one line, max 180 characters.
- Do not paste long formulas, tables, or raw citations into JSON fields.

For each candidate:
- title: sharp discovery statement, not a topic.
- anchor: exact phrase / word / contextual hinge / verse detail that supports the card. If unavailable, null.
- teaser: 2–5 sentences. It must read like a card, not like notes.
- why_it_matters: one perceptual shift, not a moral lesson.
- estimated_score: your rough editorial estimate from 0 to 100.
- strength_reason: why this may work for mature Bible readers.
- risk: what may make it weak, obvious, speculative, unsupported, or duplicate.
- source_excerpt: exact useful sentence or fragment from the material that inspired it, max 180 characters.

Ancient-version / commentary rule:
If a discovery depends on LXX, Targum, Rashi, Malbim, Vulgate, Peshitta, or a modern scholar, say so clearly in the card.
Do not say “the Hebrew means...” when the point comes from an ancient translation or later commentary.

Rejected ideas:
Also list 0–8 rejected ideas if the material contains weak/obvious/duplicate/risky candidates.
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

    const materialMode = normalizeMaterialMode(
      body?.material_mode ?? body?.mode,
    );

    const provider: Provider = isProvider(body?.provider)
      ? body.provider
      : "claude";

    if (!reference || !material) {
      return NextResponse.json(
        { error: "reference and material are required" },
        { status: 400 },
      );
    }

    const verseResult = inputVerseText
      ? { reference, text: inputVerseText }
      : await getVerseText(reference, lang, provider);

    if (materialMode === "ready_cards_json") {
      const parsed = extractJsonObjectStrict(material);
      const normalized = normalizeReadyCardsJson(parsed);

      return NextResponse.json({
        ok: true,
        reference,
        lang,
        provider,
        material_mode: materialMode,
        verseText: verseResult.text,
        verse_text_source: inputVerseText ? "request" : "getVerseText",
        json_repaired: false,
        ...normalized,
      });
    }

    const existing = await getAngleCards({
      reference,
      lang,
      statuses: ["featured", "reserve"],
      limit: 120,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { error: existing.error ?? "Failed to read existing angle cards" },
        { status: 500 },
      );
    }

    const prompt = buildManualExtractionPrompt({
      reference,
      verseText: verseResult.text,
      lang,
      material,
      direction,
      materialMode,
      existingCards: existing.cards,
    });

    const raw = await runAI(provider, prompt, lang, true);

    const parsedResult = await extractJsonObjectWithRepair({
      text: raw,
      provider,
      lang,
    });

    const normalized = normalizeExtractResponse(parsedResult.parsed);

    return NextResponse.json({
      ok: true,
      reference,
      lang,
      provider,
      material_mode: materialMode,
      verseText: verseResult.text,
      verse_text_source: inputVerseText ? "request" : "getVerseText",
      existing_cards_checked: existing.cards.length,
      json_repaired: parsedResult.repaired,
      ...normalized,
      raw,
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
