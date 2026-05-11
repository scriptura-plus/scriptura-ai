import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import {
  getAllStudioCardsForVerse,
  type AngleCardRow,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Lang = "ru";
type JsonRecord = Record<string, unknown>;

type RequestBody = {
  reference?: unknown;
  lang?: unknown;
  harvesterProvider?: unknown;
  harvester_provider?: unknown;
  writerProvider?: unknown;
  writer_provider?: unknown;
  evaluatorProvider?: unknown;
  evaluator_provider?: unknown;
  maxCards?: unknown;
};

type HarvestedAngle = {
  angle_id: string;
  title: string;
  anchor: string;
  discovery: string;
  angle_type: string;
  evidence_need: string;
  risk_note: string | null;
  focus: string;
};

type DraftCard = {
  card_id: string;
  title: string;
  anchor: string;
  teaser: string;
  why_it_matters: string;
  source_angle_ids: string[];
};

type EvaluatedCard = DraftCard & {
  score_total: number | null;
  wow_score: number | null;
  textual_anchor_score: number | null;
  freshness_score: number | null;
  safety_score: number | null;
  verdict: string | null;
  risk_flags: string[];
  rewrite_instruction: string | null;
  evaluator_note: string | null;
};

type RewrittenCard = DraftCard & {
  original_card_id: string;
  rewrite_note: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[PEARLS_V2_LAB] ADMIN_SECRET is not configured");
    return false;
  }

  return req.headers.get("x-admin-secret") === expected;
}

function chooseProvider(
  value: unknown,
  envName: string,
  fallback: Provider,
): Provider {
  if (isProvider(value)) return value;

  const envProvider = process.env[envName];
  if (isProvider(envProvider)) return envProvider;

  return fallback;
}

function buildPassageId(canonicalRef: string): string {
  return canonicalRef
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJson(text: string): unknown | null {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    // continue
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    } catch {
      // continue
    }
  }

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    } catch {
      // ignore
    }
  }

  return null;
}

function normalizeAngle(value: unknown, index: number, focus: string): HarvestedAngle | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const anchor = getString(value.anchor);
  const discovery = getString(value.discovery);

  if (!title || !anchor || !discovery) return null;

  return {
    angle_id: getString(value.angle_id, `${focus}_${index + 1}`),
    title,
    anchor,
    discovery,
    angle_type: getString(value.angle_type, focus),
    evidence_need: getString(value.evidence_need, "none"),
    risk_note: getString(value.risk_note) || null,
    focus,
  };
}

function parseAngles(text: string, focus: string): {
  angles: HarvestedAngle[];
  parsed_json: unknown;
  error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return { angles: [], parsed_json: null, error: `No JSON parsed from ${focus}.` };
  }

  const rawAngles =
    isRecord(parsed) && Array.isArray(parsed.angles)
      ? parsed.angles
      : Array.isArray(parsed)
        ? parsed
        : [];

  return {
    angles: rawAngles
      .map((item, index) => normalizeAngle(item, index, focus))
      .filter((item): item is HarvestedAngle => item !== null),
    parsed_json: parsed,
    error: null,
  };
}

function normalizeCard(value: unknown, index: number): DraftCard | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const anchor = getString(value.anchor);
  const teaser = getString(value.teaser);
  const why = getString(value.why_it_matters);

  if (!title || !anchor || !teaser) return null;

  const sourceAngleIds = Array.isArray(value.source_angle_ids)
    ? value.source_angle_ids
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    card_id: getString(value.card_id, `card_${index + 1}`),
    title,
    anchor,
    teaser,
    why_it_matters: why,
    source_angle_ids: sourceAngleIds,
  };
}

function parseCards(text: string): {
  cards: DraftCard[];
  parsed_json: unknown;
  error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return { cards: [], parsed_json: null, error: "No JSON parsed from card writer." };
  }

  const rawCards =
    isRecord(parsed) && Array.isArray(parsed.cards)
      ? parsed.cards
      : Array.isArray(parsed)
        ? parsed
        : [];

  return {
    cards: rawCards
      .map(normalizeCard)
      .filter((item): item is DraftCard => item !== null),
    parsed_json: parsed,
    error: null,
  };
}

function parseEvaluations(text: string): {
  evaluations: JsonRecord[];
  parsed_json: unknown;
  error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return {
      evaluations: [],
      parsed_json: null,
      error: "No JSON parsed from evaluator.",
    };
  }

  const raw =
    isRecord(parsed) && Array.isArray(parsed.evaluations)
      ? parsed.evaluations
      : Array.isArray(parsed)
        ? parsed
        : [];

  return {
    evaluations: raw.filter(isRecord),
    parsed_json: parsed,
    error: null,
  };
}

function mergeEvaluations(cards: DraftCard[], evaluations: JsonRecord[]): EvaluatedCard[] {
  return cards.map((card, index) => {
    const match =
      evaluations.find((item) => getString(item.card_id) === card.card_id) ??
      evaluations.find((item) => getNumber(item.card_index, -1) === index + 1) ??
      {};

    const riskFlags = Array.isArray(match.risk_flags)
      ? match.risk_flags
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

    return {
      ...card,
      score_total: getOptionalNumber(match.score_total),
      wow_score: getOptionalNumber(match.wow_score),
      textual_anchor_score: getOptionalNumber(match.textual_anchor_score),
      freshness_score: getOptionalNumber(match.freshness_score),
      safety_score: getOptionalNumber(match.safety_score),
      verdict: getString(match.verdict) || null,
      risk_flags: riskFlags,
      rewrite_instruction: getString(match.rewrite_instruction) || null,
      evaluator_note: getString(match.evaluator_note) || null,
    };
  });
}

function shouldRewriteCard(card: EvaluatedCard): boolean {
  const score = card.score_total ?? 0;
  const verdict = card.verdict ?? "";
  const hasRisk = card.risk_flags.length > 0;

  if (score < 70) return false;
  if (verdict === "rewrite_needed" || verdict === "needs_evidence") return true;
  if (hasRisk && score >= 74) return true;

  return false;
}

function normalizeRewrittenCard(value: unknown, index: number): RewrittenCard | null {
  if (!isRecord(value)) return null;

  const originalCardId = getString(value.original_card_id);
  const title = getString(value.title);
  const anchor = getString(value.anchor);
  const teaser = getString(value.teaser);
  const why = getString(value.why_it_matters);

  if (!originalCardId || !title || !anchor || !teaser) return null;

  const sourceAngleIds = Array.isArray(value.source_angle_ids)
    ? value.source_angle_ids
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    original_card_id: originalCardId,
    card_id: getString(value.card_id, `rewrite_${index + 1}`),
    title,
    anchor,
    teaser,
    why_it_matters: why,
    source_angle_ids: sourceAngleIds,
    rewrite_note: getString(value.rewrite_note) || null,
  };
}

function parseRewrites(text: string): {
  rewrites: RewrittenCard[];
  parsed_json: unknown;
  error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return { rewrites: [], parsed_json: null, error: "No JSON parsed from rewriter." };
  }

  const raw =
    isRecord(parsed) && Array.isArray(parsed.rewrites)
      ? parsed.rewrites
      : Array.isArray(parsed)
        ? parsed
        : [];

  return {
    rewrites: raw
      .map(normalizeRewrittenCard)
      .filter((item): item is RewrittenCard => item !== null),
    parsed_json: parsed,
    error: null,
  };
}

function buildRewritePrompt(args: {
  reference: string;
  verseTextRu: string;
  rewriteCandidates: EvaluatedCard[];
  angles: HarvestedAngle[];
}): string {
  return [
    "Ты — Scriptura AI Rewrite Editor.",
    "",
    "Тебе дали сильные карточки, которые evaluator отметил как рискованные или требующие смягчения.",
    "Задача: НЕ убить wow-effect. Переписать так, чтобы карточка осталась сильной, но стала осторожнее и точнее.",
    "",
    "Правила:",
    "- не превращай в сухую справку;",
    "- не добавляй новых фактов;",
    "- убери overclaim;",
    "- если была лексическая/переводческая проверка — не утверждай её как факт без источника;",
    "- сохрани главный угол;",
    "- title короткий;",
    "- teaser 2–3 предложения;",
    "- why_it_matters 1 предложение.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "ANGLE POOL:",
    JSON.stringify(args.angles, null, 2),
    "",
    "CARDS TO REWRITE:",
    JSON.stringify(args.rewriteCandidates, null, 2),
    "",
    "JSON ONLY:",
    JSON.stringify(
      {
        rewrites: [
          {
            original_card_id: "card_1",
            card_id: "rewrite_card_1",
            title: "short title",
            anchor: "short anchor",
            teaser: "2-3 sentences",
            why_it_matters: "one sentence",
            source_angle_ids: ["structure_1"],
            rewrite_note: "what was softened",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

function buildRecommendedCards(args: {
  originalCards: EvaluatedCard[];
  rewrittenCards: EvaluatedCard[];
}): EvaluatedCard[] {
  const rewritesByOriginal = new Map<string, EvaluatedCard>();

  for (const rewritten of args.rewrittenCards) {
    const originalId = getString((rewritten as unknown as JsonRecord).original_card_id);
    if (!originalId) continue;
    rewritesByOriginal.set(originalId, rewritten);
  }

  const merged = args.originalCards.map((original) => {
    const rewrite = rewritesByOriginal.get(original.card_id);
    if (!rewrite) return original;

    const originalScore = original.score_total ?? 0;
    const rewriteScore = rewrite.score_total ?? 0;
    const originalSafety = original.safety_score ?? 0;
    const rewriteSafety = rewrite.safety_score ?? 0;

    if (rewriteScore >= originalScore - 8 && rewriteSafety >= originalSafety) {
      return rewrite;
    }

    return original;
  });

  return merged.sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0));
}

function summarizeExistingCard(card: AngleCardRow) {
  return {
    id: card.id,
    status: card.status,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    score_total: card.score_total,
    coverage_type: card.coverage_type,
    source_type: card.source_type,
  };
}

function dedupeAngles(angles: HarvestedAngle[]): HarvestedAngle[] {
  const seen = new Set<string>();
  const out: HarvestedAngle[] = [];

  for (const angle of angles) {
    const key = `${angle.anchor.toLowerCase()}|${angle.discovery.toLowerCase().slice(0, 90)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(angle);
  }

  return out;
}

function buildAngleHarvesterPrompt(args: {
  reference: string;
  verseTextRu: string;
  existingCards: ReturnType<typeof summarizeExistingCard>[];
  focus: string;
  focusInstruction: string;
}): string {
  return [
    "Ты — Angle Harvester для Scriptura AI.",
    "НЕ пиши карточки. Найди только углы открытия.",
    "Каждый угол должен давать чувство: «Я раньше этого не замечал».",
    "Пиши КОРОТКО. JSON должен быть компактным.",
    "",
    `ФОКУС: ${args.focus}`,
    args.focusInstruction,
    "",
    "Правила:",
    "- не проповедуй;",
    "- не объясняй весь стих;",
    "- не повторяй existing cards;",
    "- если нужна проверка, всё равно сохрани угол и поставь evidence_need;",
    "- discovery максимум 170 символов;",
    "- title максимум 8 слов;",
    "- anchor короткая точная фраза из стиха.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "EXISTING CARDS:",
    JSON.stringify(args.existingCards.slice(0, 8)),
    "",
    "JSON ONLY:",
    '{"angles":[{"angle_id":"a1","title":"...","anchor":"...","discovery":"Я не замечал, что ...","angle_type":"structural","evidence_need":"none","risk_note":null}]}',
    "",
    "Верни ровно 4 лучших угла.",
  ].join("\n");
}

function buildCardWriterPrompt(args: {
  reference: string;
  verseTextRu: string;
  angles: HarvestedAngle[];
  existingCards: ReturnType<typeof summarizeExistingCard>[];
  maxCards: number;
}): string {
  return [
    "Ты — главный writer карточек «Жемчужины» для Scriptura AI.",
    "Тебе дали найденные углы. Напиши из них сильные карточки.",
    "",
    "Цель: читатель думает «Я читал стих, но не замечал этого».",
    "",
    "Пиши свободно и сильно.",
    "Не добавляй фактов сверх угла.",
    "Если угол требует проверки — формулируй как наблюдение по тексту, без фразы «в оригинале».",
    "Не проповедуй. Не делай лексическую справку. Не повторяй existing cards.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "ANGLE POOL:",
    JSON.stringify(args.angles, null, 2),
    "",
    "EXISTING CARDS:",
    JSON.stringify(args.existingCards.slice(0, 10), null, 2),
    "",
    "JSON ONLY:",
    JSON.stringify(
      {
        cards: [
          {
            card_id: "card_1",
            title: "short title",
            anchor: "short phrase",
            teaser: "2-3 sentences",
            why_it_matters: "one sentence",
            source_angle_ids: ["a1"],
          },
        ],
      },
      null,
      2,
    ),
    "",
    `Напиши до ${args.maxCards} лучших карточек. Отбирай по wow-effect.`,
  ].join("\n");
}

function buildEvaluatorPrompt(args: {
  reference: string;
  verseTextRu: string;
  cards: DraftCard[];
  angles: HarvestedAngle[];
  existingCards: ReturnType<typeof summarizeExistingCard>[];
}): string {
  return [
    "Ты — evaluator Scriptura AI.",
    "Оцени готовые карточки по wow-effect и текстовой опоре.",
    "Не убивай сильную мысль: если она рискованная, дай rewrite_instruction.",
    "",
    "Шкала 1-100:",
    "wow_score, textual_anchor_score, freshness_score, safety_score, score_total.",
    "",
    "verdict:",
    "strong_candidate | usable_candidate | rewrite_needed | needs_evidence | duplicate_risk | weak_reject",
    "",
    "risk_flags:",
    "lexical_check | translation_check | syntax_check | historical_check | theological_overreach | duplicate_risk | pretty_empty | overclaim",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "ANGLE POOL:",
    JSON.stringify(args.angles, null, 2),
    "",
    "DRAFT CARDS:",
    JSON.stringify(args.cards, null, 2),
    "",
    "EXISTING CARDS:",
    JSON.stringify(args.existingCards.slice(0, 12), null, 2),
    "",
    "JSON ONLY:",
    JSON.stringify(
      {
        evaluations: [
          {
            card_id: "card_1",
            card_index: 1,
            score_total: 88,
            wow_score: 90,
            textual_anchor_score: 85,
            freshness_score: 88,
            safety_score: 86,
            verdict: "strong_candidate",
            risk_flags: [],
            rewrite_instruction: null,
            evaluator_note: "short note",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = asRecord((await req.json().catch(() => ({}))) as RequestBody);
    const reference = getString(body.reference);
    const lang: Lang = "ru";

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "reference is required." },
        { status: 400 },
      );
    }

    if (body.lang && body.lang !== "ru") {
      return NextResponse.json(
        { ok: false, error: "Only lang=ru is supported now." },
        { status: 400 },
      );
    }

    const harvesterProvider = chooseProvider(
      body.harvesterProvider ?? body.harvester_provider,
      "DISCOVERY_HARVESTER_PROVIDER",
      "claude",
    );
    const writerProvider = chooseProvider(
      body.writerProvider ?? body.writer_provider,
      "DISCOVERY_WRITER_PROVIDER",
      "claude",
    );
    const evaluatorProvider = chooseProvider(
      body.evaluatorProvider ?? body.evaluator_provider,
      "DISCOVERY_EVALUATOR_PROVIDER",
      "openai",
    );

    const maxCards = Math.min(Math.max(getNumber(body.maxCards, 8), 3), 12);

    const normalized = normalizeReference(reference);
    const canonicalRef = normalized.canonical_ref || reference;
    const passageId = buildPassageId(canonicalRef);

    const verseResult = await getVerseText(reference, lang, harvesterProvider);
    const verseTextRu = verseResult.text.trim();

    if (!verseTextRu) {
      return NextResponse.json(
        { ok: false, error: "Could not load Russian verse text.", reference },
        { status: 500 },
      );
    }

    const cardsResult = await getAllStudioCardsForVerse({
      reference,
      canonical_ref: canonicalRef,
      lang,
      limit: 80,
    });

    if (!cardsResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: cardsResult.error ?? "Failed to load existing cards.",
        },
        { status: 500 },
      );
    }

    const existingCards = cardsResult.cards.map(summarizeExistingCard);

    const focusSpecs = [
      {
        focus: "structure",
        focusInstruction:
          "Ищи структуру, порядок слов, повтор, контраст, причинную связь, движение мысли.",
      },
      {
        focus: "surprise",
        focusInstruction:
          "Ищи неожиданный поворот, скрытую логику, странность фразы, вопрос к тексту.",
      },
      {
        focus: "language",
        focusInstruction:
          "Ищи переводческую поверхность, возможную лексическую зацепку, слова с риском проверки.",
      },
    ];

    const harvestRuns = await Promise.all(
      focusSpecs.map(async (spec) => {
        const prompt = buildAngleHarvesterPrompt({
          reference,
          verseTextRu,
          existingCards,
          focus: spec.focus,
          focusInstruction: spec.focusInstruction,
        });

        const rawText = await runAI(harvesterProvider, prompt, "ru", true);
        const parsed = parseAngles(rawText, spec.focus);

        return {
          focus: spec.focus,
          prompt,
          raw_text: rawText,
          parsed_json: parsed.parsed_json,
          error: parsed.error,
          angles: parsed.angles.map((angle, index) => ({
            ...angle,
            angle_id: `${spec.focus}_${index + 1}`,
          })),
        };
      }),
    );

    const allAngles = dedupeAngles(harvestRuns.flatMap((run) => run.angles));

    if (allAngles.length === 0) {
      return NextResponse.json({
        ok: false,
        mode: "pearls_v2_lab",
        changed_database: false,
        reference,
        canonical_ref: canonicalRef,
        passage_id: passageId,
        summary: {
          existing_card_count: existingCards.length,
          angle_count: 0,
          draft_card_count: 0,
          evaluated_card_count: 0,
          strong_count: 0,
          usable_count: 0,
          errors: harvestRuns.map((run) => run.error).filter(Boolean),
        },
        result: {
          angles: [],
          draft_cards: [],
          evaluated_cards: [],
          existing_cards: existingCards,
        },
        raw: {
          harvest_runs: harvestRuns,
        },
        error: "No angles harvested.",
      });
    }

    const writerPrompt = buildCardWriterPrompt({
      reference,
      verseTextRu,
      angles: allAngles,
      existingCards,
      maxCards,
    });

    const writerRawText = await runAI(writerProvider, writerPrompt, "ru", true);
    const parsedCards = parseCards(writerRawText);

    const evaluatorPrompt = buildEvaluatorPrompt({
      reference,
      verseTextRu,
      angles: allAngles,
      cards: parsedCards.cards,
      existingCards,
    });

    const evaluatorRawText = await runAI(evaluatorProvider, evaluatorPrompt, "ru", true);
    const parsedEvaluations = parseEvaluations(evaluatorRawText);
    const evaluatedCards = mergeEvaluations(parsedCards.cards, parsedEvaluations.evaluations);

    const sortedCards = [...evaluatedCards].sort(
      (a, b) => (b.score_total ?? 0) - (a.score_total ?? 0),
    );

    const rewriteCandidates = sortedCards.filter(shouldRewriteCard).slice(0, 4);

    let rewritePrompt: string | null = null;
    let rewriteRawText: string | null = null;
    let parsedRewrites: ReturnType<typeof parseRewrites> = {
      rewrites: [],
      parsed_json: null,
      error: null,
    };
    let rewrittenEvaluationsRawText: string | null = null;
    let parsedRewrittenEvaluations: ReturnType<typeof parseEvaluations> = {
      evaluations: [],
      parsed_json: null,
      error: null,
    };
    let evaluatedRewrites: EvaluatedCard[] = [];

    if (rewriteCandidates.length > 0) {
      rewritePrompt = buildRewritePrompt({
        reference,
        verseTextRu,
        rewriteCandidates,
        angles: allAngles,
      });

      rewriteRawText = await runAI(writerProvider, rewritePrompt, "ru", true);
      parsedRewrites = parseRewrites(rewriteRawText);

      if (parsedRewrites.rewrites.length > 0) {
        const rewrittenEvaluatorPrompt = buildEvaluatorPrompt({
          reference,
          verseTextRu,
          angles: allAngles,
          cards: parsedRewrites.rewrites,
          existingCards,
        });

        rewrittenEvaluationsRawText = await runAI(
          evaluatorProvider,
          rewrittenEvaluatorPrompt,
          "ru",
          true,
        );

        parsedRewrittenEvaluations = parseEvaluations(rewrittenEvaluationsRawText);
        evaluatedRewrites = mergeEvaluations(
          parsedRewrites.rewrites,
          parsedRewrittenEvaluations.evaluations,
        );
      }
    }

    const sortedRewrites = [...evaluatedRewrites].sort(
      (a, b) => (b.score_total ?? 0) - (a.score_total ?? 0),
    );

    const recommendedCards = buildRecommendedCards({
      originalCards: sortedCards,
      rewrittenCards: sortedRewrites,
    });

    return NextResponse.json({
      ok: true,
      mode: "pearls_v2_lab",
      changed_database: false,

      reference,
      canonical_ref: canonicalRef,
      passage_id: passageId,
      book_key: normalized.book_key ?? null,
      lang,

      providers: {
        harvester: harvesterProvider,
        writer: writerProvider,
        evaluator: evaluatorProvider,
      },

      source: {
        verse_text_source: "getVerseText ru local-first",
        verse_reference_returned: verseResult.reference,
        surface_translation: "rstj_yahweh",
      },

      summary: {
        existing_card_count: existingCards.length,
        angle_count: allAngles.length,
        draft_card_count: parsedCards.cards.length,
        evaluated_card_count: evaluatedCards.length,
        rewrite_candidate_count: rewriteCandidates.length,
        rewritten_card_count: evaluatedRewrites.length,
        recommended_card_count: recommendedCards.length,
        strong_count: recommendedCards.filter(
          (card) => (card.score_total ?? 0) >= 82,
        ).length,
        usable_count: recommendedCards.filter(
          (card) => (card.score_total ?? 0) >= 74,
        ).length,
        errors: [
          ...harvestRuns.map((run) => run.error).filter(Boolean),
          parsedCards.error,
          parsedEvaluations.error,
          parsedRewrites.error,
          parsedRewrittenEvaluations.error,
        ].filter(Boolean),
      },

      result: {
        angles: allAngles,
        draft_cards: parsedCards.cards,
        evaluated_cards: sortedCards,
        rewrite_candidates: rewriteCandidates,
        rewritten_cards: sortedRewrites,
        recommended_cards: recommendedCards,
        existing_cards: existingCards,
      },

      raw: {
        harvest_runs: harvestRuns,
        writer_prompt: writerPrompt,
        writer_raw_text: writerRawText,
        writer_parsed_json: parsedCards.parsed_json,
        evaluator_prompt: evaluatorPrompt,
        evaluator_raw_text: evaluatorRawText,
        evaluator_parsed_json: parsedEvaluations.parsed_json,
        rewrite_prompt: rewritePrompt,
        rewrite_raw_text: rewriteRawText,
        rewrite_parsed_json: parsedRewrites.parsed_json,
        rewritten_evaluator_raw_text: rewrittenEvaluationsRawText,
        rewritten_evaluator_parsed_json: parsedRewrittenEvaluations.parsed_json,
      },
    });
  } catch (error) {
    console.error("[PEARLS_V2_LAB] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to run Pearls v2 Lab.",
      },
      { status: 500 },
    );
  }
}
