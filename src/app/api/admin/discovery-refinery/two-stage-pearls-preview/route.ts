import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import {
  formatOriginalLanguagePacketForPrompt,
  getOriginalLanguagePacket,
} from "@/lib/bible/getOriginalLanguagePacket";
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
  claim_type?: string | null;
  lexicon_claim_status?: string | null;
  lexicon_note?: string | null;
  lexicon_refs?: string[];
  public_ready?: boolean;
  public_status?: string;
  public_blockers?: string[];
};

type RewrittenCard = DraftCard & {
  original_card_id: string;
  rewrite_note: string | null;
};

type OriginalLanguagePromptPacket = {
  text: string;
  available: boolean;
  error: string | null;
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

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
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

function getOriginalLanguagePromptPacket(reference: string): OriginalLanguagePromptPacket {
  try {
    const packet = getOriginalLanguagePacket(reference);
    const formatted = formatOriginalLanguagePacketForPrompt(packet).trim();

    return {
      text: formatted,
      available: Boolean(formatted),
      error: null,
    };
  } catch (error) {
    return {
      text: "",
      available: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not build original-language packet.",
    };
  }
}

function buildLexiconPromptSection(packet: OriginalLanguagePromptPacket): string {
  if (!packet.available) {
    return [
      "ВНУТРЕННИЙ ЛЕКСИКОН / ORIGINAL-LANGUAGE PACKET:",
      "Недоступен для этого стиха. Не делай утверждений о греческом/еврейском/арамейском тексте, порядке слов, грамматике или значении слов как о проверенных фактах.",
    ].join("\n");
  }

  return [
    "ВНУТРЕННИЙ ЛЕКСИКОН / ORIGINAL-LANGUAGE PACKET:",
    packet.text,
  ].join("\n");
}

function buildLexiconUseRules(): string {
  return [
    "ПРАВИЛА РАБОТЫ С ЛЕКСИКОНОМ:",
    "- Лексикон — не тема карточек, а скрытая экспертная проверка и усилитель.",
    "- Не превращай «Жемчужины» в линзу «Лексика»: максимум одна явно лексическая карточка среди лучших, только если она действительно сильнее остальных.",
    "- Простое совпадение gloss не является открытием: ἄνθρωπος = человек или ἐν = в/на/среди само по себе не делает карточку сильной.",
    "- Сильная лексическая карточка допустима только когда значение слова меняет чтение стиха: например, слово оказывается шире/уже/страннее, чем ожидает читатель.",
    "- Лексикон может подтвердить значение слова, но не доказывает сам по себе риторический вывод. Интерпретацию формулируй осторожно: «создаёт эффект», «читается как», «похоже на». Не пиши как абсолютный факт, если это вывод.",
    "- Любое утверждение о порядке слов, грамматике, форме глагола, времени, падеже или конструкции должно быть прямо поддержано пакетом. Если пакет этого не поддерживает — не используй claim или честно назови его эффектом русского перевода.",
    "- Если карточка строится только на русском порядке слов, не выдавай это за греческий/еврейский оригинал.",
    "- Не добавляй длинные словарные справки. Одна короткая вставка вроде «греческое слово ἀσθένεια — общая немощь, а не диагноз» допустима, если она усиливает вау-эффект.",
    "- Никогда не используй фразу «лексикон говорит» в публичной карточке. Публичный текст должен звучать как дорогая публицистика, а не как справочник.",
  ].join("\n");
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

  return {
    card_id: getString(value.card_id, `card_${index + 1}`),
    title,
    anchor,
    teaser,
    why_it_matters: why,
    source_angle_ids: getStringArray(value.source_angle_ids),
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

    return {
      ...card,
      score_total: getOptionalNumber(match.score_total),
      wow_score: getOptionalNumber(match.wow_score),
      textual_anchor_score: getOptionalNumber(match.textual_anchor_score),
      freshness_score: getOptionalNumber(match.freshness_score),
      safety_score: getOptionalNumber(match.safety_score),
      verdict: getString(match.verdict) || null,
      risk_flags: getStringArray(match.risk_flags),
      rewrite_instruction: getString(match.rewrite_instruction) || null,
      evaluator_note: getString(match.evaluator_note) || null,
      claim_type: getString(match.claim_type) || null,
      lexicon_claim_status: getString(match.lexicon_claim_status) || null,
      lexicon_note: getString(match.lexicon_note) || null,
      lexicon_refs: getStringArray(match.lexicon_refs),
    };
  });
}

function shouldRewriteCard(card: EvaluatedCard): boolean {
  const score = card.score_total ?? 0;
  const verdict = card.verdict ?? "";
  const hasRisk = card.risk_flags.length > 0;
  const lexiconStatus = card.lexicon_claim_status ?? "";

  if (score < 70) return false;
  if (verdict === "rewrite_needed" || verdict === "needs_evidence") return true;
  if (lexiconStatus === "partial" || lexiconStatus === "unsupported") return true;
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

  return {
    original_card_id: originalCardId,
    card_id: getString(value.card_id, `rewrite_${index + 1}`),
    title,
    anchor,
    teaser,
    why_it_matters: why,
    source_angle_ids: getStringArray(value.source_angle_ids),
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
  lexiconSection: string;
}): string {
  return [
    "Ты — Scriptura AI Rewrite Editor.",
    "",
    "Тебе дали сильные карточки, которые evaluator отметил как рискованные или требующие смягчения.",
    "Задача: НЕ убить wow-effect. Переписать так, чтобы карточка осталась сильной, но стала осторожнее и точнее.",
    "",
    buildLexiconUseRules(),
    "",
    "Правила:",
    "- не превращай в сухую справку;",
    "- не добавляй новых фактов;",
    "- убери overclaim;",
    "- если была лексическая/переводческая проверка — не утверждай её как факт без опоры в лексиконе;",
    "- если claim держится только на русском переводе — прямо смягчи: «в русском чтении», «перевод создаёт эффект»;",
    "- сохрани главный угол;",
    "- title короткий;",
    "- teaser один плотный красивый абзац из 3–6 предложений;",
    "- why_it_matters 1 предложение.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    args.lexiconSection,
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
            teaser: "one beautiful paragraph, 3-6 sentences",
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

function isLexiconSensitiveClaim(card: EvaluatedCard): boolean {
  const claimType = (card.claim_type ?? "").toLowerCase();
  if (["lexical", "grammar", "syntax", "translation_surface"].includes(claimType)) {
    return true;
  }

  const text = [
    card.title,
    card.anchor,
    card.teaser,
    card.why_it_matters,
    card.evaluator_note,
    card.lexicon_note,
    ...(card.risk_flags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "греческ",
    "еврейск",
    "арамейск",
    "оригинал",
    "лексик",
    "слово",
    "глагол",
    "форма",
    "порядок слов",
    "синтаксис",
    "граммат",
    "перевод",
    "ἀ",
    "ἐ",
    "ὁ",
    "ἦ",
    "ב",
  ].some((marker) => text.includes(marker));
}

function getPublicReadiness(card: EvaluatedCard): {
  public_ready: boolean;
  public_status: string;
  public_blockers: string[];
} {
  const score = card.score_total ?? 0;
  const verdict = card.verdict ?? "";
  const flags = card.risk_flags ?? [];
  const blockers: string[] = [];
  const lexiconStatus = card.lexicon_claim_status ?? "not_applicable";

  const evidenceFlags = new Set([
    "lexical_check",
    "translation_check",
    "syntax_check",
    "historical_check",
    "intertextual_check",
  ]);

  const hardRiskFlags = new Set([
    "theological_overreach",
    "overclaim",
    "pretty_empty",
    "duplicate_risk",
  ]);

  if (score < 82) blockers.push("score_below_82");
  if (verdict !== "strong_candidate") blockers.push(`verdict_${verdict || "unknown"}`);

  for (const flag of flags) {
    if (evidenceFlags.has(flag)) blockers.push(`needs_evidence:${flag}`);
    if (hardRiskFlags.has(flag)) blockers.push(`risk:${flag}`);
  }

  if (card.rewrite_instruction) blockers.push("rewrite_instruction_present");

  if (isLexiconSensitiveClaim(card)) {
    if (lexiconStatus === "unsupported") blockers.push("risk:lexicon_unsupported");
    if (lexiconStatus === "partial") blockers.push("needs_evidence:lexicon_partial");
    if (!lexiconStatus || lexiconStatus === "unknown") {
      blockers.push("needs_evidence:lexicon_not_checked");
    }
  }

  if (blockers.length === 0) {
    return {
      public_ready: true,
      public_status: "public_ready",
      public_blockers: [],
    };
  }

  const needsEvidence = blockers.some((item) => item.startsWith("needs_evidence:"));
  const hasRisk = blockers.some((item) => item.startsWith("risk:"));
  const needsRewrite = blockers.includes("rewrite_instruction_present");

  return {
    public_ready: false,
    public_status: needsEvidence
      ? "needs_evidence_before_public"
      : hasRisk || needsRewrite
        ? "needs_rewrite_or_moderator"
        : "not_public_ready",
    public_blockers: blockers,
  };
}

function attachPublicReadiness(cards: EvaluatedCard[]): EvaluatedCard[] {
  return cards.map((card) => ({
    ...card,
    ...getPublicReadiness(card),
  }));
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

  return attachPublicReadiness(
    merged.sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0)),
  );
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
  lexiconSection: string;
}): string {
  return [
    "Ты — Angle Harvester для Scriptura AI.",
    "НЕ пиши карточки. Найди только углы открытия.",
    "Каждый угол должен давать чувство: «Я раньше этого не замечал».",
    "Пиши КОРОТКО. JSON должен быть компактным.",
    "",
    buildLexiconUseRules(),
    "",
    `ФОКУС: ${args.focus}`,
    args.focusInstruction,
    "",
    "Правила:",
    "- не проповедуй;",
    "- не объясняй весь стих;",
    "- не повторяй existing cards;",
    "- если нужна проверка, всё равно сохрани угол и поставь evidence_need;",
    "- если угол основан на лексиконе, evidence_need должен быть lexicon_supported / lexicon_partial / lexicon_unsupported;",
    "- если угол основан только на русском переводе, angle_type должен быть translation_surface, а не lexical/grammar;",
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
    args.lexiconSection,
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
  lexiconSection: string;
}): string {
  return [
    "Ты — главный writer карточек «Жемчужины» для Scriptura AI.",
    "Тебе дали найденные углы. Напиши из них сильные карточки.",
    "",
    "Уровень письма: сильный публицист уровня дорогого журнала, Бок / Arzamas / New Yorker, но без снобизма.",
    "Каждая карточка должна читаться как маленькое открытие, а не как редакционная заметка.",
    "",
    "Цель: читатель думает «Я читал стих, но не замечал этого». Эффект создаёт не только угол, но и то, КАК он написан.",
    "",
    buildLexiconUseRules(),
    "",
    "Стиль карточки:",
    "- title короткий и цепкий;",
    "- anchor короткий, точный, из стиха;",
    "- teaser — ОДИН красивый плотный абзац из 3–6 предложений;",
    "- teaser должен иметь крючок, поворот, внутренний ритм и ясный смысловой удар;",
    "- why_it_matters — 1 предложение, не мораль, а сдвиг восприятия стиха;",
    "- не делай сухую справку;",
    "- не пиши длинное объяснение «что это значит»;",
    "- не добавляй фактов сверх угла и лексикона;",
    "- если угол требует проверки — формулируй осторожно и без фразы «в оригинале», если пакет этого не подтверждает;",
    "- не повторяй existing cards.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    args.lexiconSection,
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
            teaser: "one beautiful paragraph, 3-6 sentences",
            why_it_matters: "one sentence",
            source_angle_ids: ["a1"],
          },
        ],
      },
      null,
      2,
    ),
    "",
    `Напиши до ${args.maxCards} лучших карточек. Отбирай по wow-effect, а не по равномерному покрытию.`,
  ].join("\n");
}

function buildEvaluatorPrompt(args: {
  reference: string;
  verseTextRu: string;
  cards: DraftCard[];
  angles: HarvestedAngle[];
  existingCards: ReturnType<typeof summarizeExistingCard>[];
  lexiconSection: string;
}): string {
  return [
    "Ты — evaluator Scriptura AI.",
    "Оцени готовые карточки по wow-effect, текстовой опоре, красоте письма и безопасности.",
    "Не убивай сильную мысль: если она рискованная, дай rewrite_instruction.",
    "Но если карточка делает языковой claim, который лексикон НЕ поддерживает, это серьёзный минус.",
    "",
    buildLexiconUseRules(),
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
    "claim_type:",
    "text_structure | rhetorical | lexical | grammar | syntax | translation_surface | contextual | theological | other",
    "",
    "lexicon_claim_status:",
    "supported | partial | unsupported | not_applicable",
    "",
    "Как ставить lexicon_claim_status:",
    "- supported: языковой claim прямо поддержан лексиконом/пакетом;",
    "- partial: направление возможно, но формулировку надо смягчить или нужна внешняя проверка;",
    "- unsupported: claim противоречит пакету или не подтверждён;",
    "- not_applicable: карточка не делает claim о значении слова, грамматике, оригинале или порядке слов.",
    "",
    "Жёсткие проверки:",
    "- Если карточка говорит о греческом/еврейском слове, но этого слова/значения нет в пакете — ставь unsupported или partial и снижай safety/textual_anchor.",
    "- Если карточка строится на русском порядке слов, но выдаёт это за оригинал — ставь translation_check или overclaim.",
    "- Если карточка красиво написана, но доказательство слабое — не завышай score_total только за стиль.",
    "- Если карточка хорошо написана и лексикон подтверждает ключевую деталь — не занижай её из-за того, что она лексическая. Просто не надо делать весь набор лексическим.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    args.lexiconSection,
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
            claim_type: "text_structure",
            lexicon_claim_status: "not_applicable",
            lexicon_note: "short explanation of how lexicon supports / does not apply",
            lexicon_refs: [],
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

    const originalLanguagePacket = getOriginalLanguagePromptPacket(reference);
    const lexiconSection = buildLexiconPromptSection(originalLanguagePacket);

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
          "Ищи структуру, порядок слов, повтор, контраст, причинную связь, движение мысли. Проверяй по лексикону только если делаешь claim о языке.",
      },
      {
        focus: "surprise",
        focusInstruction:
          "Ищи неожиданный поворот, скрытую логику, странность фразы, вопрос к тексту. Не превращай странность в спекуляцию.",
      },
      {
        focus: "language",
        focusInstruction:
          "Ищи одну-две возможные лексические/грамматические зацепки, но только если лексикон реально даёт сильный wow-угол. Простые gloss не считать открытием.",
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
          lexiconSection,
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
        source: {
          original_language_packet_available: originalLanguagePacket.available,
          original_language_packet_error: originalLanguagePacket.error,
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
      lexiconSection,
    });

    const writerRawText = await runAI(writerProvider, writerPrompt, "ru", true);
    const parsedCards = parseCards(writerRawText);

    const evaluatorPrompt = buildEvaluatorPrompt({
      reference,
      verseTextRu,
      angles: allAngles,
      cards: parsedCards.cards,
      existingCards,
      lexiconSection,
    });

    const evaluatorRawText = await runAI(evaluatorProvider, evaluatorPrompt, "ru", true);
    const parsedEvaluations = parseEvaluations(evaluatorRawText);
    const evaluatedCards = mergeEvaluations(parsedCards.cards, parsedEvaluations.evaluations);

    const sortedCards = attachPublicReadiness(
      [...evaluatedCards].sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0)),
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
        lexiconSection,
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
          lexiconSection,
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

    const sortedRewrites = attachPublicReadiness(
      [...evaluatedRewrites].sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0)),
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
        original_language_packet_available: originalLanguagePacket.available,
        original_language_packet_error: originalLanguagePacket.error,
      },

      summary: {
        existing_card_count: existingCards.length,
        angle_count: allAngles.length,
        draft_card_count: parsedCards.cards.length,
        evaluated_card_count: evaluatedCards.length,
        rewrite_candidate_count: rewriteCandidates.length,
        rewritten_card_count: evaluatedRewrites.length,
        recommended_card_count: recommendedCards.length,
        public_ready_count: recommendedCards.filter((card) => card.public_ready).length,
        needs_evidence_count: recommendedCards.filter(
          (card) => card.public_status === "needs_evidence_before_public",
        ).length,
        strong_count: recommendedCards.filter(
          (card) => (card.score_total ?? 0) >= 82,
        ).length,
        usable_count: recommendedCards.filter(
          (card) => (card.score_total ?? 0) >= 74,
        ).length,
        lexicon_supported_count: recommendedCards.filter(
          (card) => card.lexicon_claim_status === "supported",
        ).length,
        lexicon_partial_count: recommendedCards.filter(
          (card) => card.lexicon_claim_status === "partial",
        ).length,
        lexicon_unsupported_count: recommendedCards.filter(
          (card) => card.lexicon_claim_status === "unsupported",
        ).length,
        errors: [
          originalLanguagePacket.error,
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
        original_language_packet: originalLanguagePacket.text,
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
