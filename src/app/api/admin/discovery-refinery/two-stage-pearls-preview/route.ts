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
  maxAngles?: unknown;
  maxCards?: unknown;
};

type HarvestedAngle = {
  angle_id: string;
  title: string;
  anchor: string;
  discovery: string;
  why_surprising: string;
  angle_type: string;
  evidence_need: string;
  risk_note: string | null;
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
    // Continue.
  }

  const objectStart = stripped.indexOf("{");
  const objectEnd = stripped.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1));
    } catch {
      // Continue.
    }
  }

  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(stripped.slice(arrayStart, arrayEnd + 1));
    } catch {
      // Ignore.
    }
  }

  return null;
}

function normalizeAngle(value: unknown, index: number): HarvestedAngle | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const anchor = getString(value.anchor);
  const discovery = getString(value.discovery);
  const why = getString(value.why_surprising);

  if (!title || !anchor || !discovery) return null;

  return {
    angle_id: getString(value.angle_id, `angle_${index + 1}`),
    title,
    anchor,
    discovery,
    why_surprising: why,
    angle_type: getString(value.angle_type, "textual"),
    evidence_need: getString(value.evidence_need, "none"),
    risk_note: getString(value.risk_note) || null,
  };
}

function parseAngles(text: string): {
  angles: HarvestedAngle[];
  parsed_json: unknown;
  error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return { angles: [], parsed_json: null, error: "No JSON parsed from angle harvester." };
  }

  const rawAngles =
    isRecord(parsed) && Array.isArray(parsed.angles)
      ? parsed.angles
      : Array.isArray(parsed)
        ? parsed
        : [];

  return {
    angles: rawAngles
      .map(normalizeAngle)
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

function buildAngleHarvesterPrompt(args: {
  reference: string;
  verseTextRu: string;
  existingCards: ReturnType<typeof summarizeExistingCard>[];
  maxAngles: number;
}): string {
  return [
    "Ты — Angle Harvester для Scriptura AI.",
    "",
    "Твоя задача — НЕ писать карточки.",
    "Твоя задача — найти как можно больше сильных углов открытия по стиху.",
    "",
    "Что такое хороший угол:",
    "читатель должен подумать: «Я раньше этого не замечал».",
    "",
    "Ищи разные типы углов:",
    "- структура фразы;",
    "- порядок мыслей;",
    "- повтор;",
    "- контраст;",
    "- причинная связь;",
    "- вопрос-ответ;",
    "- неожиданная логика;",
    "- напряжение повествования;",
    "- видимое отсутствие;",
    "- переводческая поверхность;",
    "- возможная лексическая зацепка;",
    "- необычное движение мысли.",
    "",
    "НЕ пиши проповедь.",
    "НЕ объясняй стих целиком.",
    "НЕ делай готовые карточки.",
    "НЕ повторяй existing cards, если они уже закрывают этот же угол.",
    "",
    "Если угол требует проверки оригинала/лексики/переводов — всё равно сохрани его, но поставь evidence_need.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "EXISTING CARDS ДЛЯ ИЗБЕЖАНИЯ ДУБЛЕЙ:",
    JSON.stringify(args.existingCards, null, 2),
    "",
    "ВЕРНИ JSON ONLY:",
    JSON.stringify(
      {
        angles: [
          {
            angle_id: "angle_1",
            title: "short angle name",
            anchor: "short exact phrase from verse",
            discovery: "Я не замечал, что ...",
            why_surprising: "why this may create wow-effect",
            angle_type:
              "structural | narrative | rhetorical | translation | lexical | syntax | contextual | other",
            evidence_need:
              "none | light_caution | lexical_check | translation_check | syntax_check | moderator_check",
            risk_note: null,
          },
        ],
      },
      null,
      2,
    ),
    "",
    `Найди до ${args.maxAngles} углов. Лучше 12 хороших разных углов, чем 3 осторожных.`,
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
    "",
    "Старая ошибка: сразу просить AI придумать карточки.",
    "Новый подход: тебе уже дали найденные углы. Пиши сильные карточки из них.",
    "",
    "Цель карточки:",
    "серьёзный читатель должен почувствовать: «Я читал этот стих, но не замечал этого».",
    "",
    "Пиши свободно, сильно, красиво, но не выдумывай новые факты сверх угла.",
    "Если угол требует проверки — не убивай его, а формулируй осторожно на уровне наблюдения по тексту.",
    "Не пиши «в оригинале», если angle этого не доказывает.",
    "Не превращай карточку в лексический справочник.",
    "Не превращай карточку в проповедь.",
    "Не повторяй existing cards.",
    "",
    "Формат карточки:",
    "- title: 4–9 слов;",
    "- anchor: точная короткая опора из стиха;",
    "- teaser: 2–3 предложения, с настоящим открытием;",
    "- why_it_matters: 1 предложение, почему это меняет чтение;",
    "- source_angle_ids: какие углы использованы.",
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
    "EXISTING CARDS ДЛЯ ИЗБЕЖАНИЯ ДУБЛЕЙ:",
    JSON.stringify(args.existingCards, null, 2),
    "",
    "ВЕРНИ JSON ONLY:",
    JSON.stringify(
      {
        cards: [
          {
            card_id: "card_1",
            title: "short title",
            anchor: "short phrase",
            teaser: "2-3 sentences",
            why_it_matters: "one sentence",
            source_angle_ids: ["angle_1"],
          },
        ],
      },
      null,
      2,
    ),
    "",
    `Напиши до ${args.maxCards} лучших карточек. Отбирай по wow-effect, не по осторожности.`,
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
    "",
    "Оцени готовые карточки. Не убивай сильную мысль только потому, что её надо смягчить.",
    "Твоя задача — отделить сильные карточки от слабых, найти риски и дать rewrite instruction, если карточку можно спасти.",
    "",
    "Критерий качества:",
    "главное — wow-effect: «Я раньше этого не замечал».",
    "",
    "Оцени по шкале 1–100:",
    "- wow_score: сила открытия;",
    "- textual_anchor_score: насколько точно держится за текст;",
    "- freshness_score: насколько не банально;",
    "- safety_score: риск overclaim;",
    "- score_total: общий балл.",
    "",
    "verdict:",
    "strong_candidate | usable_candidate | rewrite_needed | needs_evidence | duplicate_risk | weak_reject",
    "",
    "risk_flags:",
    "lexical_check | translation_check | syntax_check | historical_check | theological_overreach | duplicate_risk | pretty_empty | overclaim",
    "",
    "Если карточка сильная, но рискованная, verdict = rewrite_needed или needs_evidence, не weak_reject.",
    "rewrite_instruction должен сохранять вау-эффект, а не превращать карточку в сухую справку.",
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
    "EXISTING CARDS ДЛЯ ДУБЛЕЙ:",
    JSON.stringify(args.existingCards, null, 2),
    "",
    "ВЕРНИ JSON ONLY:",
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

    const maxAngles = Math.min(Math.max(getNumber(body.maxAngles, 14), 6), 20);
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

    const harvesterPrompt = buildAngleHarvesterPrompt({
      reference,
      verseTextRu,
      existingCards,
      maxAngles,
    });

    const harvesterRawText = await runAI(harvesterProvider, harvesterPrompt, "ru", true);
    const parsedAngles = parseAngles(harvesterRawText);

    const writerPrompt = buildCardWriterPrompt({
      reference,
      verseTextRu,
      angles: parsedAngles.angles,
      existingCards,
      maxCards,
    });

    const writerRawText = await runAI(writerProvider, writerPrompt, "ru", true);
    const parsedCards = parseCards(writerRawText);

    const evaluatorPrompt = buildEvaluatorPrompt({
      reference,
      verseTextRu,
      angles: parsedAngles.angles,
      cards: parsedCards.cards,
      existingCards,
    });

    const evaluatorRawText = await runAI(evaluatorProvider, evaluatorPrompt, "ru", true);
    const parsedEvaluations = parseEvaluations(evaluatorRawText);
    const evaluatedCards = mergeEvaluations(parsedCards.cards, parsedEvaluations.evaluations);

    const sortedCards = [...evaluatedCards].sort(
      (a, b) => (b.score_total ?? 0) - (a.score_total ?? 0),
    );

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
        angle_count: parsedAngles.angles.length,
        draft_card_count: parsedCards.cards.length,
        evaluated_card_count: evaluatedCards.length,
        strong_count: evaluatedCards.filter(
          (card) => (card.score_total ?? 0) >= 82,
        ).length,
        usable_count: evaluatedCards.filter(
          (card) => (card.score_total ?? 0) >= 74,
        ).length,
        errors: [
          parsedAngles.error,
          parsedCards.error,
          parsedEvaluations.error,
        ].filter(Boolean),
      },

      result: {
        angles: parsedAngles.angles,
        draft_cards: parsedCards.cards,
        evaluated_cards: sortedCards,
        existing_cards: existingCards,
      },

      raw: {
        harvester_prompt: harvesterPrompt,
        harvester_raw_text: harvesterRawText,
        harvester_parsed_json: parsedAngles.parsed_json,
        writer_prompt: writerPrompt,
        writer_raw_text: writerRawText,
        writer_parsed_json: parsedCards.parsed_json,
        evaluator_prompt: evaluatorPrompt,
        evaluator_raw_text: evaluatorRawText,
        evaluator_parsed_json: parsedEvaluations.parsed_json,
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
