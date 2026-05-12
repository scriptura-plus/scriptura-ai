import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import {
  formatOriginalLanguagePacketForPrompt,
  getOriginalLanguagePacket,
} from "@/lib/bible/getOriginalLanguagePacket";
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
type LexiconClaimStatus =
  | "supported"
  | "unsupported"
  | "needs_human_check"
  | "not_applicable";

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
  lexicon_claim_status?: LexiconClaimStatus;
  lexicon_note?: string | null;
  public_original_language_ok?: boolean;
  public_original_language_note?: string | null;
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
  public_ready?: boolean;
  public_status?: string;
  public_blockers?: string[];
};

type RewrittenCard = DraftCard & {
  original_card_id: string;
  rewrite_note: string | null;
};

type LexiconCheck = {
  card_id: string;
  lexicon_claim_status: LexiconClaimStatus;
  lexicon_note: string | null;
  public_original_language_ok: boolean;
  public_original_language_note: string | null;
  corrected_title: string | null;
  corrected_anchor: string | null;
  corrected_teaser: string | null;
  corrected_why_it_matters: string | null;
};

const ORIGINAL_LANGUAGE_RE = /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]/;

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

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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

function hasOriginalLanguage(text: string | null | undefined): boolean {
  return ORIGINAL_LANGUAGE_RE.test(text ?? "");
}

function hasRussianGlossBridge(text: string | null | undefined): boolean {
  const value = (text ?? "").trim();

  if (!hasOriginalLanguage(value)) return true;

  const bridgePatterns = [
    /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff][^—–-]{0,80}[—–-]\s*[«"][^»"]{1,90}[»"]/, 
    /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff][^—–-]{0,80}[—–-]\s*[А-Яа-яЁё][^.;:!?]{1,90}/,
    /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff][^()]{0,80}\([^)]*[А-Яа-яЁё][^)]*\)/,
  ];

  return bridgePatterns.some((pattern) => pattern.test(value));
}

function detectOriginalLanguageDisplayBlockers(card: {
  title?: string | null;
  anchor?: string | null;
  teaser?: string | null;
  why_it_matters?: string | null;
}): string[] {
  const blockers: string[] = [];

  if (hasOriginalLanguage(card.title)) {
    blockers.push("original_language_in_title");
  }

  const fields = [
    ["anchor", card.anchor],
    ["teaser", card.teaser],
    ["why_it_matters", card.why_it_matters],
  ] as const;

  for (const [field, value] of fields) {
    if (hasOriginalLanguage(value) && !hasRussianGlossBridge(value)) {
      blockers.push(`original_language_without_russian_gloss:${field}`);
    }
  }

  return blockers;
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

function normalizeLexiconStatus(value: unknown): LexiconClaimStatus | undefined {
  const raw = getString(value);

  if (
    raw === "supported" ||
    raw === "unsupported" ||
    raw === "needs_human_check" ||
    raw === "not_applicable"
  ) {
    return raw;
  }

  return undefined;
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
    lexicon_claim_status: normalizeLexiconStatus(value.lexicon_claim_status),
    lexicon_note: getString(value.lexicon_note) || null,
    public_original_language_ok: getBoolean(value.public_original_language_ok) ?? undefined,
    public_original_language_note: getString(value.public_original_language_note) || null,
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

function normalizeLexiconCheck(value: unknown): LexiconCheck | null {
  if (!isRecord(value)) return null;

  const cardId = getString(value.card_id);
  if (!cardId) return null;

  return {
    card_id: cardId,
    lexicon_claim_status: normalizeLexiconStatus(value.lexicon_claim_status) ?? "needs_human_check",
    lexicon_note: getString(value.lexicon_note) || null,
    public_original_language_ok: getBoolean(value.public_original_language_ok) ?? false,
    public_original_language_note: getString(value.public_original_language_note) || null,
    corrected_title: getString(value.corrected_title) || null,
    corrected_anchor: getString(value.corrected_anchor) || null,
    corrected_teaser: getString(value.corrected_teaser) || null,
    corrected_why_it_matters: getString(value.corrected_why_it_matters) || null,
  };
}

function parseLexiconChecks(text: string): {
  checks: LexiconCheck[];
  parsed_json: unknown;
  error: string | null;
} {
  const parsed = extractFirstJson(text);

  if (!parsed) {
    return {
      checks: [],
      parsed_json: null,
      error: "No JSON parsed from lexicon checker.",
    };
  }

  const raw =
    isRecord(parsed) && Array.isArray(parsed.checks)
      ? parsed.checks
      : Array.isArray(parsed)
        ? parsed
        : [];

  return {
    checks: raw
      .map(normalizeLexiconCheck)
      .filter((item): item is LexiconCheck => item !== null),
    parsed_json: parsed,
    error: null,
  };
}

function mergeLexiconChecks(cards: DraftCard[], checks: LexiconCheck[]): DraftCard[] {
  return cards.map((card) => {
    const check = checks.find((item) => item.card_id === card.card_id);
    const deterministicBlockers = detectOriginalLanguageDisplayBlockers(card);

    if (!check) {
      return {
        ...card,
        lexicon_claim_status: card.lexicon_claim_status ?? "needs_human_check",
        lexicon_note:
          card.lexicon_note ??
          (deterministicBlockers.length > 0
            ? "Original-language display needs Russian gloss."
            : "Lexicon checker did not return a result for this card."),
        public_original_language_ok:
          card.public_original_language_ok ?? deterministicBlockers.length === 0,
        public_original_language_note:
          card.public_original_language_note ??
          (deterministicBlockers.length > 0 ? deterministicBlockers.join(", ") : null),
      };
    }

    const correctedCard = {
      ...card,
      title: check.corrected_title ?? card.title,
      anchor: check.corrected_anchor ?? card.anchor,
      teaser: check.corrected_teaser ?? card.teaser,
      why_it_matters: check.corrected_why_it_matters ?? card.why_it_matters,
      lexicon_claim_status: check.lexicon_claim_status,
      lexicon_note: check.lexicon_note,
      public_original_language_ok: check.public_original_language_ok,
      public_original_language_note: check.public_original_language_note,
    };

    const blockersAfterCorrection = detectOriginalLanguageDisplayBlockers(correctedCard);

    return {
      ...correctedCard,
      public_original_language_ok:
        check.public_original_language_ok && blockersAfterCorrection.length === 0,
      public_original_language_note:
        blockersAfterCorrection.length > 0
          ? [
              check.public_original_language_note,
              `Deterministic display check: ${blockersAfterCorrection.join(", ")}`,
            ]
              .filter(Boolean)
              .join(" | ")
          : check.public_original_language_note,
    };
  });
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

    for (const blocker of detectOriginalLanguageDisplayBlockers(card)) {
      if (!riskFlags.includes(blocker)) riskFlags.push(blocker);
    }

    if (card.lexicon_claim_status === "unsupported") riskFlags.push("lexicon_unsupported");
    if (card.lexicon_claim_status === "needs_human_check") riskFlags.push("lexicon_needs_human_check");
    if (card.public_original_language_ok === false) riskFlags.push("untranslated_original_language");

    return {
      ...card,
      score_total: getOptionalNumber(match.score_total),
      wow_score: getOptionalNumber(match.wow_score),
      textual_anchor_score: getOptionalNumber(match.textual_anchor_score),
      freshness_score: getOptionalNumber(match.freshness_score),
      safety_score: getOptionalNumber(match.safety_score),
      verdict: getString(match.verdict) || null,
      risk_flags: Array.from(new Set(riskFlags)),
      rewrite_instruction: getString(match.rewrite_instruction) || null,
      evaluator_note: getString(match.evaluator_note) || null,
    };
  });
}

function shouldRewriteCard(card: EvaluatedCard): boolean {
  const score = card.score_total ?? 0;
  const verdict = card.verdict ?? "";
  const hasRisk = card.risk_flags.length > 0;
  const hasDisplayProblem = detectOriginalLanguageDisplayBlockers(card).length > 0;
  const hasLexiconProblem =
    card.lexicon_claim_status === "unsupported" ||
    card.lexicon_claim_status === "needs_human_check" ||
    card.public_original_language_ok === false;

  if (score < 70) return false;
  if (verdict === "rewrite_needed" || verdict === "needs_evidence") return true;
  if (hasDisplayProblem && score >= 70) return true;
  if (hasLexiconProblem && score >= 74) return true;
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
    lexicon_claim_status: normalizeLexiconStatus(value.lexicon_claim_status),
    lexicon_note: getString(value.lexicon_note) || null,
    public_original_language_ok: getBoolean(value.public_original_language_ok) ?? undefined,
    public_original_language_note: getString(value.public_original_language_note) || null,
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

function originalLanguagePublicRules(): string {
  return [
    "PUBLIC ORIGINAL-LANGUAGE DISPLAY RULES:",
    "- Русский читатель не обязан понимать греческий/еврейский знак сам по себе.",
    "- В title НИКОГДА не ставь греческое/еврейское слово.",
    "- Anchor по умолчанию должен быть понятным на русском.",
    "- Если в anchor/teaser/why появляется греческое или еврейское слово, сразу дай русский мост:",
    "  γνοὺς — «узнав»",
    "  ἀσθένεια — «немощь / слабость»",
    "  דָּבָר — «слово / дело»",
    "- Нельзя оставлять голый anchor вроде: γνοὺς ὅτι πολὺν ἤδη χρόνον ἔχει.",
    "- Для длинных оригинальных фраз лучше anchor на русском, а оригинал вплести коротко в teaser:",
    "  В греческом это сжато в слове γνοὺς — «узнав».",
    "- Оригинальный язык нужен не как значок экспертности, а только когда он реально усиливает открытие.",
    "- В одном наборе допустима максимум одна сильная лексическая карточка, если она действительно лучшая; остальные карточки должны оставаться риторическими, структурными, контекстными или нарративными.",
  ].join("\n");
}

function buildLexiconCheckPrompt(args: {
  reference: string;
  verseTextRu: string;
  originalLanguagePrompt: string;
  cards: DraftCard[];
}): string {
  return [
    "Ты — Lexicon Gate для Scriptura AI.",
    "",
    "Твоя задача: проверить карточки по внутреннему лексикону/пакету оригинального языка и привести публичный вывод к понятному русскому формату.",
    "",
    "Важно:",
    "- Не превращай все карточки в словарные справки.",
    "- Не добавляй новые факты и новые углы.",
    "- Если карточка не делает языковой claim, ставь lexicon_claim_status='not_applicable'.",
    "- Если языковой claim прямо поддержан пакетом, ставь 'supported'.",
    "- Если claim противоречит пакету, ставь 'unsupported'.",
    "- Если пакета недостаточно, ставь 'needs_human_check'.",
    "- Если греческое/еврейское слово выводится публично, оно обязано иметь русский мост: γνοὺς — «узнав».",
    "- Если anchor содержит голую длинную греческую/еврейскую фразу, замени anchor на понятный русский или добавь русский мост.",
    "- Не пиши в corrected_* null, если поле не меняется.",
    "",
    originalLanguagePublicRules(),
    "",
    "СТИХ:",
    args.reference,
    "",
    "РУССКИЙ ТЕКСТ:",
    args.verseTextRu,
    "",
    "LEXICON / ORIGINAL-LANGUAGE PACKET:",
    args.originalLanguagePrompt || "Пакет оригинального языка недоступен. Не подтверждай языковые claims как supported.",
    "",
    "CARDS TO CHECK:",
    JSON.stringify(args.cards, null, 2),
    "",
    "JSON ONLY:",
    JSON.stringify(
      {
        checks: [
          {
            card_id: "card_1",
            lexicon_claim_status: "supported",
            lexicon_note:
              "Пакет подтверждает γνοὺς как форму от γινώσκω; публичный русский мост добавлен.",
            public_original_language_ok: true,
            public_original_language_note:
              "Greek term is immediately glossed for Russian readers.",
            corrected_title: null,
            corrected_anchor: "γνοὺς — «узнав»",
            corrected_teaser: null,
            corrected_why_it_matters: null,
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

function buildRewritePrompt(args: {
  reference: string;
  verseTextRu: string;
  rewriteCandidates: EvaluatedCard[];
  angles: HarvestedAngle[];
  originalLanguagePrompt: string;
}): string {
  return [
    "Ты — Scriptura AI Rewrite Editor.",
    "",
    "Тебе дали сильные карточки, которые evaluator отметил как рискованные или требующие смягчения.",
    "Задача: НЕ убить wow-effect. Переписать так, чтобы карточка осталась сильной, но стала осторожнее, точнее и понятнее русскому читателю.",
    "",
    originalLanguagePublicRules(),
    "",
    "Правила:",
    "- не превращай в сухую справку;",
    "- не добавляй новых фактов;",
    "- убери overclaim;",
    "- если была лексическая/переводческая проверка — не утверждай её как факт без опоры;",
    "- сохрани главный угол;",
    "- title короткий;",
    "- teaser один красивый абзац 4–7 предложений;",
    "- why_it_matters 1 предложение;",
    "- если используешь греческое/еврейское слово, сразу дай русский мост.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "LEXICON / ORIGINAL-LANGUAGE PACKET:",
    args.originalLanguagePrompt || "Пакет оригинального языка недоступен.",
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
            anchor: "short Russian anchor or γνοὺς — «узнав»",
            teaser: "one polished paragraph",
            why_it_matters: "one sentence",
            source_angle_ids: ["structure_1"],
            lexicon_claim_status: "supported",
            lexicon_note: "short verification note, or not_applicable",
            public_original_language_ok: true,
            public_original_language_note: "short display note",
            rewrite_note: "what was softened",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
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

  const evidenceFlags = new Set([
    "lexical_check",
    "translation_check",
    "syntax_check",
    "historical_check",
    "intertextual_check",
    "lexicon_needs_human_check",
  ]);

  const hardRiskFlags = new Set([
    "theological_overreach",
    "overclaim",
    "pretty_empty",
    "duplicate_risk",
    "lexicon_unsupported",
    "untranslated_original_language",
  ]);

  if (score < 82) blockers.push("score_below_82");
  if (verdict !== "strong_candidate") blockers.push(`verdict_${verdict || "unknown"}`);

  for (const flag of flags) {
    if (evidenceFlags.has(flag)) blockers.push(`needs_evidence:${flag}`);
    if (hardRiskFlags.has(flag)) blockers.push(`risk:${flag}`);
    if (flag.startsWith("original_language_without_russian_gloss")) {
      blockers.push(`needs_rewrite:${flag}`);
    }
    if (flag === "original_language_in_title") blockers.push(`needs_rewrite:${flag}`);
  }

  if (card.lexicon_claim_status === "unsupported") blockers.push("risk:lexicon_unsupported");
  if (card.lexicon_claim_status === "needs_human_check") {
    blockers.push("needs_evidence:lexicon_needs_human_check");
  }
  if (card.public_original_language_ok === false) {
    blockers.push("needs_rewrite:original_language_display");
  }
  for (const displayBlocker of detectOriginalLanguageDisplayBlockers(card)) {
    blockers.push(`needs_rewrite:${displayBlocker}`);
  }
  if (card.rewrite_instruction) blockers.push("rewrite_instruction_present");

  const uniqueBlockers = Array.from(new Set(blockers));

  if (uniqueBlockers.length === 0) {
    return { public_ready: true, public_status: "public_ready", public_blockers: [] };
  }

  const needsEvidence = uniqueBlockers.some((item) => item.startsWith("needs_evidence:"));
  const hasRisk = uniqueBlockers.some((item) => item.startsWith("risk:"));
  const needsRewrite =
    uniqueBlockers.some((item) => item.startsWith("needs_rewrite:")) ||
    uniqueBlockers.includes("rewrite_instruction_present");

  return {
    public_ready: false,
    public_status: needsEvidence
      ? "needs_evidence_before_public"
      : hasRisk || needsRewrite
        ? "needs_rewrite_or_moderator"
        : "not_public_ready",
    public_blockers: uniqueBlockers,
  };
}

function attachPublicReadiness(cards: EvaluatedCard[]): EvaluatedCard[] {
  return cards.map((card) => ({ ...card, ...getPublicReadiness(card) }));
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
    const originalDisplayBlockers = detectOriginalLanguageDisplayBlockers(original).length;
    const rewriteDisplayBlockers = detectOriginalLanguageDisplayBlockers(rewrite).length;

    if (
      rewriteScore >= originalScore - 8 &&
      rewriteSafety >= originalSafety &&
      rewriteDisplayBlockers <= originalDisplayBlockers
    ) {
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
  originalLanguagePrompt: string;
}): string {
  const includeOriginalLanguage =
    args.focus === "language" && args.originalLanguagePrompt.trim().length > 0;

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
    "- anchor короткая точная фраза из стиха;",
    "- не превращай все углы в лексические;",
    "- лексический угол предлагай только если он сильнее обычного риторического наблюдения.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    includeOriginalLanguage
      ? [
          "LEXICON / ORIGINAL-LANGUAGE PACKET:",
          args.originalLanguagePrompt,
          "",
          "Используй этот пакет только для поиска одного-двух действительно сильных языковых углов. Не делай справочник.",
        ].join("\n")
      : "LEXICON: не используй оригинальный язык в этом фокусе, если он не нужен.",
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
  originalLanguagePrompt: string;
}): string {
  return [
    "Ты — главный writer карточек «Жемчужины» для Scriptura AI.",
    "Тебе дали найденные углы. Напиши из них сильные карточки.",
    "",
    "Цель: читатель думает «Я читал стих, но не замечал этого».",
    "",
    "Пиши как сильный публицист и редактор: один цельный, красивый, цепляющий абзац, который хочется дочитать.",
    "Карточка должна быть приятной для чтения, а не сухой редакторской заметкой.",
    "Но красота не должна подменять точность.",
    "",
    "STYLE:",
    "- teaser — один абзац на 4–7 коротких предложений;",
    "- начни с крючка или с неожиданного наблюдения;",
    "- избегай канцелярита, богословского тумана и справочного тона;",
    "- не проповедуй;",
    "- не делай лексическую справку;",
    "- не повторяй existing cards;",
    "- не добавляй фактов сверх угла и пакета;",
    "- why_it_matters — одно ясное предложение, не пересказ teaser.",
    "",
    originalLanguagePublicRules(),
    "",
    "Если угол требует проверки — формулируй осторожно.",
    "Если лексикон помогает, используй его как внутреннюю проверку и точечное усиление, а не как стиль каждой карточки.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "LEXICON / ORIGINAL-LANGUAGE PACKET FOR VERIFICATION:",
    args.originalLanguagePrompt || "Пакет оригинального языка недоступен. Не делай claims об оригинале.",
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
            anchor: "short Russian phrase or γνοὺς — «узнав»",
            teaser: "one polished paragraph",
            why_it_matters: "one sentence",
            source_angle_ids: ["a1"],
          },
        ],
      },
      null,
      2,
    ),
    "",
    `Напиши до ${args.maxCards} лучших карточек. Отбирай по wow-effect и читательскому удовольствию.`,
  ].join("\n");
}

function buildEvaluatorPrompt(args: {
  reference: string;
  verseTextRu: string;
  cards: DraftCard[];
  angles: HarvestedAngle[];
  existingCards: ReturnType<typeof summarizeExistingCard>[];
  originalLanguagePrompt: string;
}): string {
  return [
    "Ты — evaluator Scriptura AI.",
    "Оцени готовые карточки по wow-effect, текстовой опоре, читабельности и безопасности.",
    "Не убивай сильную мысль: если она рискованная, дай rewrite_instruction.",
    "",
    "Шкала 1-100:",
    "wow_score, textual_anchor_score, freshness_score, safety_score, score_total.",
    "",
    "verdict:",
    "strong_candidate | usable_candidate | rewrite_needed | needs_evidence | duplicate_risk | weak_reject",
    "",
    "risk_flags:",
    "lexical_check | translation_check | syntax_check | historical_check | intertextual_check | theological_overreach | duplicate_risk | pretty_empty | overclaim | untranslated_original_language | lexicon_unsupported | lexicon_needs_human_check",
    "",
    "Особое правило:",
    "- Если карточка публично показывает греческое/еврейское слово без русского моста формата γνοὺς — «узнав», поставь risk_flag untranslated_original_language и verdict rewrite_needed.",
    "- Если title содержит греческое/еврейское слово, поставь untranslated_original_language.",
    "- Если anchor является длинной голой греческой/еврейской фразой, поставь untranslated_original_language.",
    "- Если лексический claim не подтверждён пакетом, поставь lexicon_unsupported или lexicon_needs_human_check.",
    "- Не требуй греческий язык от каждой карточки. Сильная риторическая карточка без греческого может быть public-ready.",
    "",
    "СТИХ:",
    args.reference,
    "",
    "ТЕКСТ:",
    args.verseTextRu,
    "",
    "LEXICON / ORIGINAL-LANGUAGE PACKET:",
    args.originalLanguagePrompt || "Пакет оригинального языка недоступен.",
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

async function loadOriginalLanguagePrompt(reference: string): Promise<{
  prompt: string;
  error: string | null;
}> {
  try {
    const packet = await Promise.resolve(getOriginalLanguagePacket(reference));
    const prompt = formatOriginalLanguagePacketForPrompt(packet);

    return {
      prompt: typeof prompt === "string" ? prompt : JSON.stringify(prompt, null, 2),
      error: null,
    };
  } catch (error) {
    return {
      prompt: "",
      error:
        error instanceof Error
          ? `Original-language packet failed: ${error.message}`
          : "Original-language packet failed.",
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = asRecord(await req.json().catch(() => ({})));
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

    const originalLanguage = await loadOriginalLanguagePrompt(reference);

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
          "Ищи переводческую поверхность, возможную лексическую зацепку, слова с риском проверки. Не больше 1–2 реально сильных лексических углов.",
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
          originalLanguagePrompt: originalLanguage.prompt,
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
          lexicon_checked_card_count: 0,
          strong_count: 0,
          usable_count: 0,
          errors: [
            originalLanguage.error,
            ...harvestRuns.map((run) => run.error),
          ].filter(Boolean),
        },
        result: {
          angles: [],
          draft_cards: [],
          evaluated_cards: [],
          existing_cards: existingCards,
        },
        raw: {
          original_language_prompt: originalLanguage.prompt,
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
      originalLanguagePrompt: originalLanguage.prompt,
    });

    const writerRawText = await runAI(writerProvider, writerPrompt, "ru", true);
    const parsedCards = parseCards(writerRawText);

    const lexiconPrompt = buildLexiconCheckPrompt({
      reference,
      verseTextRu,
      originalLanguagePrompt: originalLanguage.prompt,
      cards: parsedCards.cards,
    });

    const lexiconRawText =
      parsedCards.cards.length > 0
        ? await runAI(evaluatorProvider, lexiconPrompt, "ru", true)
        : "";

    const parsedLexiconChecks =
      parsedCards.cards.length > 0
        ? parseLexiconChecks(lexiconRawText)
        : { checks: [], parsed_json: null, error: null };

    const lexiconCheckedCards = mergeLexiconChecks(
      parsedCards.cards,
      parsedLexiconChecks.checks,
    );

    const evaluatorPrompt = buildEvaluatorPrompt({
      reference,
      verseTextRu,
      angles: allAngles,
      cards: lexiconCheckedCards,
      existingCards,
      originalLanguagePrompt: originalLanguage.prompt,
    });

    const evaluatorRawText = await runAI(evaluatorProvider, evaluatorPrompt, "ru", true);
    const parsedEvaluations = parseEvaluations(evaluatorRawText);
    const evaluatedCards = mergeEvaluations(
      lexiconCheckedCards,
      parsedEvaluations.evaluations,
    );

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
    let rewrittenLexiconPrompt: string | null = null;
    let rewrittenLexiconRawText: string | null = null;
    let parsedRewrittenLexiconChecks: ReturnType<typeof parseLexiconChecks> = {
      checks: [],
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
        originalLanguagePrompt: originalLanguage.prompt,
      });

      rewriteRawText = await runAI(writerProvider, rewritePrompt, "ru", true);
      parsedRewrites = parseRewrites(rewriteRawText);

      if (parsedRewrites.rewrites.length > 0) {
        rewrittenLexiconPrompt = buildLexiconCheckPrompt({
          reference,
          verseTextRu,
          originalLanguagePrompt: originalLanguage.prompt,
          cards: parsedRewrites.rewrites,
        });

        rewrittenLexiconRawText = await runAI(
          evaluatorProvider,
          rewrittenLexiconPrompt,
          "ru",
          true,
        );

        parsedRewrittenLexiconChecks = parseLexiconChecks(rewrittenLexiconRawText);

        const lexiconCheckedRewrites = mergeLexiconChecks(
          parsedRewrites.rewrites,
          parsedRewrittenLexiconChecks.checks,
        );

        const rewrittenEvaluatorPrompt = buildEvaluatorPrompt({
          reference,
          verseTextRu,
          angles: allAngles,
          cards: lexiconCheckedRewrites,
          existingCards,
          originalLanguagePrompt: originalLanguage.prompt,
        });

        rewrittenEvaluationsRawText = await runAI(
          evaluatorProvider,
          rewrittenEvaluatorPrompt,
          "ru",
          true,
        );

        parsedRewrittenEvaluations = parseEvaluations(rewrittenEvaluationsRawText);
        evaluatedRewrites = mergeEvaluations(
          lexiconCheckedRewrites,
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
        original_language_packet_available: Boolean(originalLanguage.prompt),
        original_language_packet_error: originalLanguage.error,
      },

      summary: {
        existing_card_count: existingCards.length,
        angle_count: allAngles.length,
        draft_card_count: parsedCards.cards.length,
        lexicon_checked_card_count: lexiconCheckedCards.length,
        evaluated_card_count: evaluatedCards.length,
        rewrite_candidate_count: rewriteCandidates.length,
        rewritten_card_count: evaluatedRewrites.length,
        recommended_card_count: recommendedCards.length,
        public_ready_count: recommendedCards.filter((card) => card.public_ready).length,
        needs_evidence_count: recommendedCards.filter(
          (card) => card.public_status === "needs_evidence_before_public",
        ).length,
        needs_rewrite_or_moderator_count: recommendedCards.filter(
          (card) => card.public_status === "needs_rewrite_or_moderator",
        ).length,
        lexicon_supported_count: recommendedCards.filter(
          (card) => card.lexicon_claim_status === "supported",
        ).length,
        lexicon_needs_check_count: recommendedCards.filter(
          (card) =>
            card.lexicon_claim_status === "needs_human_check" ||
            card.lexicon_claim_status === "unsupported",
        ).length,
        original_language_display_problem_count: recommendedCards.filter(
          (card) => detectOriginalLanguageDisplayBlockers(card).length > 0,
        ).length,
        strong_count: recommendedCards.filter((card) => (card.score_total ?? 0) >= 82).length,
        usable_count: recommendedCards.filter((card) => (card.score_total ?? 0) >= 74).length,
        errors: [
          originalLanguage.error,
          ...harvestRuns.map((run) => run.error).filter(Boolean),
          parsedCards.error,
          parsedLexiconChecks.error,
          parsedEvaluations.error,
          parsedRewrites.error,
          parsedRewrittenLexiconChecks.error,
          parsedRewrittenEvaluations.error,
        ].filter(Boolean),
      },

      result: {
        angles: allAngles,
        draft_cards: parsedCards.cards,
        lexicon_checked_cards: lexiconCheckedCards,
        evaluated_cards: sortedCards,
        rewrite_candidates: rewriteCandidates,
        rewritten_cards: sortedRewrites,
        recommended_cards: recommendedCards,
        existing_cards: existingCards,
      },

      raw: {
        original_language_prompt: originalLanguage.prompt,
        harvest_runs: harvestRuns,
        writer_prompt: writerPrompt,
        writer_raw_text: writerRawText,
        writer_parsed_json: parsedCards.parsed_json,
        lexicon_prompt: lexiconPrompt,
        lexicon_raw_text: lexiconRawText,
        lexicon_parsed_json: parsedLexiconChecks.parsed_json,
        evaluator_prompt: evaluatorPrompt,
        evaluator_raw_text: evaluatorRawText,
        evaluator_parsed_json: parsedEvaluations.parsed_json,
        rewrite_prompt: rewritePrompt,
        rewrite_raw_text: rewriteRawText,
        rewrite_parsed_json: parsedRewrites.parsed_json,
        rewritten_lexicon_prompt: rewrittenLexiconPrompt,
        rewritten_lexicon_raw_text: rewrittenLexiconRawText,
        rewritten_lexicon_parsed_json: parsedRewrittenLexiconChecks.parsed_json,
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
