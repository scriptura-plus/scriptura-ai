import { requireProductAccess } from "@/lib/auth/productAccess";
import { after, NextResponse } from "next/server";
import { createHash } from "crypto";
import { runAI, resolveAIModel } from "@/lib/ai/runAI";
import { isProvider, defaultProvider, type Provider } from "@/lib/ai/providers";
import {
  resolveAnalyzeProviderTask,
  resolveProviderPolicy,
} from "@/lib/ai/providerPolicy";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { getChapterText } from "@/lib/bible/getVerseText";
import {
  buildLensPrompt,
  type LensId,
  LENS_ORDER,
} from "@/lib/prompts/buildLensPrompt";
import {
  buildExtraPrompt,
  type ExtraId,
  EXTRA_ORDER,
} from "@/lib/prompts/buildExtraPrompt";
import { buildExpandPrompt } from "@/lib/prompts/buildExpandPrompt";
import { runPearlV3 } from "@/lib/pearl-v3/runPearlV3";
import { getCachedResult, saveCachedResult } from "@/lib/cache/cachedResults";
import {
  getAngleCards,
  getAngleCardsByCanonicalRef,
} from "@/lib/cache/angleCards";
import {
  getPublishedLensSet,
  mapPearlV3ResultToPublishedCards,
  publishedCardsToAngleCardsJson,
  savePublishedLensSet,
} from "@/lib/cache/publishedLensSets";
import {
  getResearchArticle,
  saveResearchArticle,
  updateResearchArticleExtractionStatus,
} from "@/lib/cache/researchArticles";
import {
  getActiveLensDiscoveryCards,
  normalizeLensDiscoveryOutput,
  saveLensDiscoveryCards,
} from "@/lib/cache/lensDiscoveryCards";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

type Lang = "en" | "ru" | "es";

const TARGET_ANGLE_COUNT = 12;
const INITIAL_ANGLE_PROCESS_LIMIT = 4;
const WORD_LENS_ARTICLE_TYPE = "word_lens_generation";
const WORD_LENS_PROMPT_VERSION = "word_lens_v2_original_packet";

const isLang = (v: unknown): v is Lang =>
  v === "en" || v === "ru" || v === "es";

const isLensId = (v: unknown): v is LensId =>
  typeof v === "string" && (LENS_ORDER as string[]).includes(v);

const isExtraId = (v: unknown): v is ExtraId =>
  typeof v === "string" && (EXTRA_ORDER as string[]).includes(v);

type AngleCardLike = {
  id?: string;
  title: string;
  anchor?: string | null;
  teaser?: string | null;
  why_it_matters?: string | null;
  body?: string | null;
  score_total?: number | null;
  status?: string | null;
  coverage_type?: string | null;
  source?: string | null;
};

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyCachedRawJson(rawJson: unknown): string {
  if (typeof rawJson === "string") return rawJson;
  return JSON.stringify(rawJson);
}

function parseReference(reference: string): {
  book: string;
  chapter: number;
  verse: number;
} {
  const normalized = normalizeReference(reference);
  const normalizedChapter = normalized.chapter;
  const normalizedVerse = normalized.verse;

  if (
    normalized.book &&
    typeof normalizedChapter === "number" &&
    Number.isFinite(normalizedChapter) &&
    normalizedChapter > 0 &&
    typeof normalizedVerse === "number" &&
    Number.isFinite(normalizedVerse) &&
    normalizedVerse > 0
  ) {
    return {
      book: normalized.book,
      chapter: normalizedChapter,
      verse: normalizedVerse,
    };
  }

  const match = reference.trim().match(/^(.+?)\s+(\d+):(\d+)$/);

  if (!match) {
    console.warn("[CACHE] could not parse reference, using fallback", {
      reference,
    });

    return {
      book: reference,
      chapter: 0,
      verse: 0,
    };
  }

  const book = match[1]?.trim() || reference;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);

  return {
    book,
    chapter: Number.isFinite(chapter) ? chapter : 0,
    verse: Number.isFinite(verse) ? verse : 0,
  };
}

function getModelName(provider: string): string {
  if (isProvider(provider)) {
    return resolveAIModel(provider);
  }

  return provider;
}

function getExtraArticleTitle(id: ExtraId, lang: Lang): string {
  const labels: Record<Lang, Record<ExtraId, string>> = {
    en: {
      text_findings: "Textual Discoveries",
      historical_scene: "Historical Scene",
      scripture_links: "Scripture Links",
    },
    ru: {
      text_findings: "ÃÂ¢ÃÂµÃÂºÃ‘ÂÃ‘â€šÃÂ¾ÃÂ²Ã‘â€¹ÃÂµ ÃÂ½ÃÂ°Ã‘â€¦ÃÂ¾ÃÂ´ÃÂºÃÂ¸",
      historical_scene: "ÃËœÃ‘ÂÃ‘â€šÃÂ¾Ã‘â‚¬ÃÂ¸Ã‘â€¡ÃÂµÃ‘ÂÃÂºÃÂ°Ã‘Â Ã‘ÂÃ‘â€ ÃÂµÃÂ½ÃÂ°",
      scripture_links: "ÃÂ¡ÃÂ²Ã‘ÂÃÂ·ÃÂ¸ Ã‘Â ÃÂ´Ã‘â‚¬Ã‘Æ’ÃÂ³ÃÂ¸ÃÂ¼ÃÂ¸ Ã‘ÂÃ‘â€šÃÂ¸Ã‘â€¦ÃÂ°ÃÂ¼ÃÂ¸",
    },
    es: {
      text_findings: "Hallazgos textuales",
      historical_scene: "Escena histÃƒÂ³rica",
      scripture_links: "Conexiones bÃƒÂ­blicas",
    },
  };

  return labels[lang][id] ?? String(id);
}

function getWordLensArticleTitle(lang: Lang): string {
  if (lang === "ru") return "Word Lens / Ãâ€ºÃÂµÃÂºÃ‘ÂÃÂ¸ÃÂºÃÂ°";
  if (lang === "es") return "Word Lens / LÃƒÂ©xico";
  return "Word Lens / Lexicon";
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

function parseCacheableJson(text: string): unknown | null {
  const jsonText = extractFirstJsonBlock(text);

  if (!jsonText) {
    console.warn("[CACHE] no JSON block found", {
      preview: text.slice(0, 500),
    });
    return null;
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("[CACHE] JSON parse failed", {
      message: error instanceof Error ? error.message : String(error),
      preview: jsonText.slice(0, 1000),
    });
    return null;
  }
}

function normalizeCachedCards(rawJson: unknown): AngleCardLike[] {
  const value =
    typeof rawJson === "string" ? parseCacheableJson(rawJson) : rawJson;

  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => {
        return typeof item === "object" && item !== null && !Array.isArray(item);
      })
      .map((item) => ({
        title: typeof item.title === "string" ? item.title : "",
        anchor:
          typeof item.anchor === "string"
            ? item.anchor
            : typeof item.support === "string"
              ? item.support
              : null,
        teaser:
          typeof item.teaser === "string"
            ? item.teaser
            : typeof item.text === "string"
              ? item.text
              : typeof item.body === "string"
                ? item.body
                : "",
        why_it_matters:
          typeof item.why_it_matters === "string"
            ? item.why_it_matters
            : typeof item.whyItMatters === "string"
              ? item.whyItMatters
              : null,
        body: typeof item.body === "string" ? item.body : null,
        source: "cached_results",
      }))
      .filter((item) => item.title && item.teaser);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "cards" in value
  ) {
    const cards = (value as { cards?: unknown }).cards;
    return normalizeCachedCards(cards);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "angles" in value
  ) {
    const angles = (value as { angles?: unknown }).angles;
    return normalizeCachedCards(angles);
  }

  return [];
}

function toCandidate(card: AngleCardLike, index: number) {
  return {
    id: card.id ?? `initial_angle_${index + 1}`,
    title: card.title,
    anchor: card.anchor ?? null,
    teaser: card.teaser ?? card.body ?? "",
    why_it_matters: card.why_it_matters ?? null,
    body: card.body ?? null,
  };
}

function computeContentHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function getRecordString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = getString(record[key]);
    if (value) return value;
  }

  return null;
}

function getWordLensCardArray(parsedJson: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsedJson)) {
    return parsedJson.filter(isRecord);
  }

  if (!isRecord(parsedJson)) return [];

  const possibleArrays = [
    parsedJson.cards,
    parsedJson.word_cards,
    parsedJson.observations,
    parsedJson.items,
    parsedJson.findings,
    parsedJson.results,
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

function buildWordLensContentText(args: {
  reference: string;
  lang: Lang;
  parsedJson: unknown;
  rawText: string;
}): string {
  const cards = getWordLensCardArray(args.parsedJson);

  if (cards.length === 0) {
    return stripCodeFence(args.rawText);
  }

  const chunks = cards.map((card, index) => {
    const title =
      getRecordString(card, ["title", "heading", "word", "term"]) ??
      `Word observation ${index + 1}`;

    const original =
      getRecordString(card, [
        "original",
        "original_word",
        "hebrew",
        "greek",
        "aramaic",
        "form",
        "word_form",
        "lemma",
      ]) ?? "";

    const anchor =
      getRecordString(card, [
        "anchor",
        "support",
        "phrase",
        "text_anchor",
        "verse_phrase",
      ]) ?? "";

    const gap =
      getRecordString(card, [
        "gap",
        "translation_gap",
        "translation_shift",
        "semantic_range",
        "word_choice",
        "observation",
      ]) ?? "";

    const teaser =
      getRecordString(card, [
        "teaser",
        "body",
        "text",
        "explanation",
        "discovery",
        "insight",
      ]) ?? "";

    const why =
      getRecordString(card, [
        "why_it_matters",
        "whyItMatters",
        "why",
        "significance",
        "meaning_shift",
      ]) ?? "";

    return [
      `## ${index + 1}. ${title}`,
      original ? `Original/form: ${original}` : null,
      anchor ? `Anchor: ${anchor}` : null,
      gap ? `Translation/semantic gap: ${gap}` : null,
      teaser ? `Observation: ${teaser}` : null,
      why ? `Why it matters: ${why}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `# Word Lens / Lexicon Ã¢â‚¬â€ ${args.reference}`,
    "",
    "This is a set of word-card observations produced by the Word Lens. Extract only public-worthy pearl candidates where a word, form, particle, preposition, semantic range, or translation gap changes how the verse is read. Do not extract a candidate if it is merely Ã¢â‚¬Å“the word means X.Ã¢â‚¬Â",
    "",
    ...chunks,
  ].join("\n");
}

function getContentHashFromSavedRawJson(rawJson: unknown): string | null {
  const value =
    typeof rawJson === "string" ? parseCacheableJson(rawJson) : rawJson;

  if (!isRecord(value)) return null;

  const direct = getString(value.content_hash);
  if (direct) return direct;

  if (isRecord(value.metadata)) {
    return getString(value.metadata.content_hash);
  }

  return null;
}

function wordLensUsedOriginalLanguagePacket(prompt: string): boolean {
  return /\b(STEPBible|Greek|Hebrew|Aramaic|original-language|original language|lemma|morphology)\b/i.test(
    prompt,
  );
}

async function buildAnglesResponseFromCards(args: {
  reference: string;
  lang: Lang;
  canonical_ref?: string | null;
}): Promise<string | null> {
  const result = args.canonical_ref
    ? await getAngleCardsByCanonicalRef({
        canonical_ref: args.canonical_ref,
        lang: args.lang,
        statuses: ["featured", "reserve"],
        limit: TARGET_ANGLE_COUNT,
      })
    : await getAngleCards({
        reference: args.reference,
        lang: args.lang,
        statuses: ["featured", "reserve"],
        limit: TARGET_ANGLE_COUNT,
      });

  if (!result.ok || result.cards.length === 0) {
    return null;
  }

  const savedCards: AngleCardLike[] = result.cards.map((card) => ({
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    score_total: card.score_total,
    status: card.status,
    coverage_type: card.coverage_type,
    source: "angle_cards",
  }));

  if (savedCards.length >= TARGET_ANGLE_COUNT) {
    return JSON.stringify(savedCards.slice(0, TARGET_ANGLE_COUNT));
  }

  const cached = await getCachedResult(args.reference, "angles", args.lang);
  const cachedCards = cached?.raw_json
    ? normalizeCachedCards(cached.raw_json)
    : [];

  const seenTitles = new Set(
    savedCards.map((card) => card.title.trim().toLowerCase()),
  );

  const fallbackCards = cachedCards.filter((card) => {
    const titleKey = card.title.trim().toLowerCase();
    if (!titleKey || seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });

  const merged = [...savedCards, ...fallbackCards].slice(
    0,
    TARGET_ANGLE_COUNT,
  );

  return JSON.stringify(merged);
}

async function autoIntakeArticle(args: {
  req: Request;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: string;
  sourceTitle: string;
  sourceType: string;
  sourceLens: string;
  sourceArticle: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    const error = "ADMIN_SECRET is not configured";
    console.warn("[AUTO_INTAKE] skipped", {
      reference: args.reference,
      sourceType: args.sourceType,
      sourceLens: args.sourceLens,
      error,
    });
    return { ok: false, error };
  }

  if (!args.sourceArticle.trim()) {
    const error = "empty sourceArticle";
    console.warn("[AUTO_INTAKE] skipped", {
      reference: args.reference,
      sourceType: args.sourceType,
      sourceLens: args.sourceLens,
      error,
    });
    return { ok: false, error };
  }

  try {
    const origin = new URL(args.req.url).origin;

    const response = await fetch(
      `${origin}/api/admin/extract-angle-candidates-from-article`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: args.reference,
          verseText: args.verseText,
          lang: args.lang,
          provider: args.provider,
          sourceTitle: args.sourceTitle,
          sourceType: args.sourceType,
          sourceLens: args.sourceLens,
          sourceArticle: args.sourceArticle,
          count: 3,
          processLimit: 3,
        }),
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = `Extractor failed with status ${response.status}`;
      console.warn("[AUTO_INTAKE] extractor failed", {
        reference: args.reference,
        sourceType: args.sourceType,
        sourceLens: args.sourceLens,
        status: response.status,
        data,
      });
      return { ok: false, error };
    }

    console.log("[AUTO_INTAKE] extractor finished", {
      reference: args.reference,
      sourceType: args.sourceType,
      sourceLens: args.sourceLens,
      data,
    });

    return { ok: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[AUTO_INTAKE] extractor request crashed", {
      reference: args.reference,
      sourceType: args.sourceType,
      sourceLens: args.sourceLens,
      error: message,
    });
    return { ok: false, error: message };
  }
}

async function runArticleExtractorAndTrack(args: {
  articleId: string | null;
  req: Request;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: string;
  sourceTitle: string;
  sourceType: string;
  sourceLens: string;
  sourceArticle: string;
}) {
  if (args.articleId) {
    await updateResearchArticleExtractionStatus({
      articleId: args.articleId,
      status: "processing",
      error: null,
    });
  }

  const result = await autoIntakeArticle({
    req: args.req,
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    provider: args.provider,
    sourceTitle: args.sourceTitle,
    sourceType: args.sourceType,
    sourceLens: args.sourceLens,
    sourceArticle: args.sourceArticle,
  });

  if (args.articleId) {
    await updateResearchArticleExtractionStatus({
      articleId: args.articleId,
      status: result.ok ? "extracted" : "failed",
      error: result.error,
    });
  }
}

async function saveWordLensToResearchLake(args: {
  req: Request;
  reference: string;
  canonicalRef: string | null;
  verseText: string;
  lang: Lang;
  provider: Provider;
  prompt: string;
  rawOutput: string;
}): Promise<{
  articleId: string | null;
  extractionStatus: string | null;
  duplicate: boolean;
  contentHash: string | null;
}> {
  const parsedReference = parseReference(args.reference);
  const parsedJson = parseCacheableJson(args.rawOutput);
  const model = getModelName(args.provider);
  const contentText = buildWordLensContentText({
    reference: args.reference,
    lang: args.lang,
    parsedJson,
    rawText: args.rawOutput,
  });

  const usedOriginalLanguagePacket = wordLensUsedOriginalLanguagePacket(args.prompt);
  const contentHash = computeContentHash({
    canonical_ref: args.canonicalRef ?? args.reference,
    lang: args.lang,
    provider: args.provider,
    model,
    prompt_version: WORD_LENS_PROMPT_VERSION,
    content_text: contentText,
  });

  const existingArticle = await getResearchArticle({
    reference: args.reference,
    lang: args.lang,
    provider: args.provider,
    articleType: WORD_LENS_ARTICLE_TYPE,
  });

  const existingHash = existingArticle?.raw_json
    ? getContentHashFromSavedRawJson(existingArticle.raw_json)
    : null;

  const isDuplicate = Boolean(
    existingArticle?.id && existingHash && existingHash === contentHash,
  );

  if (isDuplicate) {
    console.log("[WORD_LENS_RESEARCH_LAKE] duplicate skipped", {
      reference: args.reference,
      canonical_ref: args.canonicalRef,
      lang: args.lang,
      provider: args.provider,
      model,
      contentHash,
      articleId: existingArticle?.id,
    });

    if (
      existingArticle?.id &&
      (existingArticle.extraction_status === "pending" ||
        existingArticle.extraction_status === "failed")
    ) {
      after(() =>
        runArticleExtractorAndTrack({
          articleId: existingArticle.id,
          req: args.req,
          reference: args.reference,
          verseText: args.verseText,
          lang: args.lang,
          provider: args.provider,
          sourceTitle: getWordLensArticleTitle(args.lang),
          sourceType: WORD_LENS_ARTICLE_TYPE,
          sourceLens: "word",
          sourceArticle: contentText,
        }),
      );
    }

    return {
      articleId: existingArticle?.id ?? null,
      extractionStatus: existingArticle?.extraction_status ?? null,
      duplicate: true,
      contentHash,
    };
  }

  const savedArticle = await saveResearchArticle({
    reference: args.reference,
    canonicalRef: args.canonicalRef,
    book: parsedReference.book,
    chapter: parsedReference.chapter,
    verse: parsedReference.verse,
    lang: args.lang,
    provider: args.provider,
    model,
    articleType: WORD_LENS_ARTICLE_TYPE,
    title: getWordLensArticleTitle(args.lang),
    rawText: contentText,
    rawJson: {
      source_type: WORD_LENS_ARTICLE_TYPE,
      source_lens: "word",
      lens_id: "word",
      prompt_version: WORD_LENS_PROMPT_VERSION,
      provider: args.provider,
      model,
      lang: args.lang,
      canonical_ref: args.canonicalRef,
      reference_display: args.reference,
      raw_output: args.rawOutput,
      parsed_json: parsedJson,
      content_text: contentText,
      used_original_language_packet: usedOriginalLanguagePacket,
      content_hash: contentHash,
      metadata: {
        source_title: getWordLensArticleTitle(args.lang),
        source_type: WORD_LENS_ARTICLE_TYPE,
        source_lens: "word",
        prompt_version: WORD_LENS_PROMPT_VERSION,
        used_original_language_packet: usedOriginalLanguagePacket,
        content_hash: contentHash,
      },
    },
  });

  console.log("[WORD_LENS_RESEARCH_LAKE] saved", {
    reference: args.reference,
    canonical_ref: args.canonicalRef,
    lang: args.lang,
    provider: args.provider,
    model,
    articleId: savedArticle?.id ?? null,
    contentHash,
    contentLength: contentText.length,
    usedOriginalLanguagePacket,
  });

  if (savedArticle?.id) {
    after(() =>
      runArticleExtractorAndTrack({
        articleId: savedArticle.id,
        req: args.req,
        reference: args.reference,
        verseText: args.verseText,
        lang: args.lang,
        provider: args.provider,
        sourceTitle: getWordLensArticleTitle(args.lang),
        sourceType: WORD_LENS_ARTICLE_TYPE,
        sourceLens: "word",
        sourceArticle: contentText,
      }),
    );
  }

  return {
    articleId: savedArticle?.id ?? null,
    extractionStatus: savedArticle?.extraction_status ?? null,
    duplicate: false,
    contentHash,
  };
}

async function autoProcessInitialAngles(args: {
  req: Request;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: string;
  rawJson: unknown;
  sourceLabel: string;
}) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    console.warn("[INITIAL_ANGLES] skipped: ADMIN_SECRET is not configured", {
      reference: args.reference,
      lang: args.lang,
    });
    return;
  }

  const cards = normalizeCachedCards(args.rawJson).slice(
    0,
    INITIAL_ANGLE_PROCESS_LIMIT,
  );

  if (cards.length === 0) {
    console.warn("[INITIAL_ANGLES] skipped: no cards found", {
      reference: args.reference,
      lang: args.lang,
    });
    return;
  }

  try {
    const origin = new URL(args.req.url).origin;

    console.log("[INITIAL_ANGLES] background processing start", {
      reference: args.reference,
      lang: args.lang,
      count: cards.length,
      limit: INITIAL_ANGLE_PROCESS_LIMIT,
    });

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const candidate = toCandidate(card, index);

      if (!candidate.title || !candidate.teaser) {
        continue;
      }

      const response = await fetch(
        `${origin}/api/admin/process-angle-candidate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({
            reference: args.reference,
            verseText: args.verseText,
            lang: args.lang,
            provider: args.provider,
            source_provider: args.provider,
            source_model: args.sourceLabel,
            targetFeaturedCount: TARGET_ANGLE_COUNT,
            sourceArticle: "",
            candidate,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.warn("[INITIAL_ANGLES] process failed", {
          reference: args.reference,
          lang: args.lang,
          title: candidate.title,
          status: response.status,
          data,
        });
        continue;
      }

      console.log("[INITIAL_ANGLES] processed", {
        reference: args.reference,
        lang: args.lang,
        title: candidate.title,
        data,
      });
    }

    console.log("[INITIAL_ANGLES] background processing done", {
      reference: args.reference,
      lang: args.lang,
      count: cards.length,
    });
  } catch (error) {
    console.warn("[INITIAL_ANGLES] processing crashed", {
      reference: args.reference,
      lang: args.lang,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(req: Request) {
  const accessError = await requireProductAccess(req);
  if (accessError) return accessError;

  try {
    const body = await req.json();

    const kind = body?.kind;
    const id = body?.id;
    const reference =
      typeof body?.reference === "string" ? body.reference.trim() : "";
    const verseText =
      typeof body?.verseText === "string" ? body.verseText.trim() : "";
    const lang: Lang = isLang(body?.lang) ? body.lang : "en";
    const clientProvider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();
    const analyzeProviderTask = resolveAnalyzeProviderTask(
      typeof kind === "string" ? kind : "",
      typeof id === "string" ? id : null,
    );
    const provider =
      analyzeProviderTask === "lexicon_generation"
        ? resolveProviderPolicy(analyzeProviderTask).provider
        : clientProvider;

    if (!reference || !verseText) {
      return NextResponse.json(
        { error: "reference and verseText are required" },
        { status: 400 },
      );
    }

    const normalizedReference = normalizeReference(reference);

    const shouldUseAnglesCache =
      kind === "lens" && id === "angles" && isLensId(id);

    const shouldUseTranslationsCache =
      kind === "lens" && id === "translations" && isLensId(id);

    const shouldUseWordCache =
      kind === "lens" && id === "word" && isLensId(id);

    const lensCacheReference = normalizedReference.canonical_ref ?? reference;

    if (shouldUseAnglesCache) {
      console.log("[ANGLE_CARDS] lookup", {
        reference,
        canonical_ref: normalizedReference.canonical_ref,
        lens: "angles",
        lang,
      });

      const publishedPearlSet = await getPublishedLensSet({
        canonicalRef: normalizedReference.canonical_ref ?? reference,
        lang,
        lensId: "pearl",
      });

      if (publishedPearlSet.error) {
        console.warn("[PUBLISHED_LENS_SETS] pearl read failed", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          error: publishedPearlSet.error,
        });
      }

      if (publishedPearlSet.data?.cards.length) {
        console.log("[PUBLISHED_LENS_SETS] pearl hit", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          set_id: publishedPearlSet.data.set.id,
          version: publishedPearlSet.data.set.version,
          cards: publishedPearlSet.data.cards.length,
        });

        return NextResponse.json({
          text: publishedCardsToAngleCardsJson(publishedPearlSet.data.cards),
          cached: true,
          source: "published_lens_sets",
          canonical_ref: normalizedReference.canonical_ref,
          published_lens_id: "pearl",
          published_set_id: publishedPearlSet.data.set.id,
          published_version: publishedPearlSet.data.set.version,
        });
      }

      try {
        if (lang === "en") {
          console.log("[PEARL_V3_DISABLED] skipping EN pearl generation", {
            reference,
            canonical_ref: normalizedReference.canonical_ref,
            lang,
          });

          const fallbackText = await buildAnglesResponseFromCards({
            reference,
            lang,
            canonical_ref: normalizedReference.canonical_ref,
          });

          return NextResponse.json({
            text: fallbackText ?? "[]",
            cached: true,
            source: fallbackText ? "angle_cards" : "en_pearl_generation_disabled",
            generated: false,
            canonical_ref: normalizedReference.canonical_ref,
          });
        }
        console.log("[PUBLISHED_LENS_SETS] pearl miss; generating Pearl v3", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          provider,
        });

        const pearlResult = await runPearlV3({
          reference,
          verseText,
          lang,
          provider,
          options: {
            writeLimit: 12,
            targetCount: 6,
            minScore: 70,
            includeRaw: false,
          },
        });

        const publishedCards = mapPearlV3ResultToPublishedCards(pearlResult);

        if (publishedCards.length > 0) {
          const savedPearlSet = await savePublishedLensSet({
            canonicalRef: pearlResult.canonicalRef ?? normalizedReference.canonical_ref ?? reference,
            referenceLabel: pearlResult.verseContext.centralRef ?? reference,
            lang,
            lensId: "pearl",
            sourcePipeline: "pearl_v3_auto_public",
            sourceModel: pearlResult.model,
            generatedAt: new Date().toISOString(),
            metadata: {
              reference,
              provider,
              debug: pearlResult.debug,
              lexiconAvailable: pearlResult.lexiconAvailable,
            },
            cards: publishedCards,
          });

          if (savedPearlSet.error) {
            console.warn("[PUBLISHED_LENS_SETS] pearl save failed; falling back to legacy", {
              reference,
              canonical_ref: normalizedReference.canonical_ref,
              lang,
              error: savedPearlSet.error,
            });
          } else if (savedPearlSet.data?.cards.length) {
            console.log("[PUBLISHED_LENS_SETS] pearl generated and saved", {
              reference,
              canonical_ref: normalizedReference.canonical_ref,
              lang,
              set_id: savedPearlSet.data.set.id,
              version: savedPearlSet.data.set.version,
              cards: savedPearlSet.data.cards.length,
            });

            return NextResponse.json({
              text: publishedCardsToAngleCardsJson(savedPearlSet.data.cards),
              cached: true,
              source: "published_lens_sets",
              canonical_ref: normalizedReference.canonical_ref,
              published_lens_id: "pearl",
              published_set_id: savedPearlSet.data.set.id,
              published_version: savedPearlSet.data.set.version,
              generated: true,
              model: pearlResult.model,
            });
          }
        } else {
          console.warn("[PUBLISHED_LENS_SETS] Pearl v3 produced no publishable cards; falling back to legacy", {
            reference,
            canonical_ref: normalizedReference.canonical_ref,
            lang,
          });
        }
      } catch (error) {
        console.warn("[PUBLISHED_LENS_SETS] pearl generation failed; falling back to legacy", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const angleCardsText = await buildAnglesResponseFromCards({
        reference,
        lang,
        canonical_ref: normalizedReference.canonical_ref,
      });

      if (angleCardsText) {
        console.log("[ANGLE_CARDS] hit", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
        });

        return NextResponse.json({
          text: angleCardsText,
          cached: true,
          source: "angle_cards",
          canonical_ref: normalizedReference.canonical_ref,
        });
      }

      console.log("[ANGLE_CARDS] miss", {
        reference,
        canonical_ref: normalizedReference.canonical_ref,
        lang,
      });

      const cached = await getCachedResult(reference, "angles", lang);

      if (cached?.raw_json) {
        after(() =>
          autoProcessInitialAngles({
            req,
            reference,
            verseText,
            lang,
            provider,
            rawJson: cached.raw_json,
            sourceLabel: `cached_results:${cached.model ?? getModelName(provider)}`,
          }),
        );

        return NextResponse.json({
          text: stringifyCachedRawJson(cached.raw_json),
          cached: true,
          source: "cached_results",
          canonical_ref: normalizedReference.canonical_ref,
        });
      }
    }

    if (shouldUseWordCache) {
      console.log("[WORD_LENS_CACHE] lookup", {
        reference,
        canonical_ref: normalizedReference.canonical_ref,
        lens: "word",
        lang,
        provider,
      });

      const cachedWordLens = await getCachedResult(reference, "word", lang);

      if (cachedWordLens?.raw_json) {
        const cachedText = stringifyCachedRawJson(cachedWordLens.raw_json);

        after(() =>
          saveWordLensToResearchLake({
            req,
            reference,
            canonicalRef: normalizedReference.canonical_ref,
            verseText,
            lang,
            provider,
            prompt: "cached_word_lens_result; original prompt unavailable",
            rawOutput: cachedText,
          }).catch((error) => {
            console.warn("[WORD_LENS_RESEARCH_LAKE] cached save/extract failed", {
              reference,
              canonical_ref: normalizedReference.canonical_ref,
              lang,
              provider,
              model: getModelName(provider),
              error: error instanceof Error ? error.message : String(error),
            });
          }),
        );

        console.log("[WORD_LENS_CACHE] hit", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          provider,
          model: cachedWordLens.model ?? getModelName(provider),
        });

        return NextResponse.json({
          text: cachedText,
          cached: true,
          source: "cached_results",
          canonical_ref: normalizedReference.canonical_ref,
        });
      }

      console.log("[WORD_LENS_CACHE] miss", {
        reference,
        canonical_ref: normalizedReference.canonical_ref,
        lang,
        provider,
      });
    }

    if (shouldUseTranslationsCache) {
      console.log("[LENS_DISCOVERY_CARDS] lookup", {
        reference: lensCacheReference,
        originalReference: reference,
        lens: "translations",
        lang,
      });

      const cachedTranslationCards = await getActiveLensDiscoveryCards({
        reference: lensCacheReference,
        lensId: "translations",
        lang,
        limit: 3,
      });

      if (cachedTranslationCards) {
        console.log("[LENS_DISCOVERY_CARDS] hit", {
          reference: lensCacheReference,
          originalReference: reference,
          lens: "translations",
          lang,
          count: cachedTranslationCards.cards.length,
        });

        return NextResponse.json({
          text: JSON.stringify(cachedTranslationCards),
          cached: true,
          source: "lens_discovery_cards",
          canonical_ref: normalizedReference.canonical_ref,
        });
      }

      console.log("[LENS_DISCOVERY_CARDS] miss", {
        reference: lensCacheReference,
        originalReference: reference,
        lens: "translations",
        lang,
      });
    }

    if (kind === "extra" && isExtraId(id)) {
      const title = getExtraArticleTitle(id, lang);

      const cachedArticle = await getResearchArticle({
        reference,
        lang,
        provider,
        articleType: id,
      });

      if (cachedArticle?.raw_text) {
        if (
          cachedArticle.extraction_status === "pending" ||
          cachedArticle.extraction_status === "failed"
        ) {
          after(() =>
            runArticleExtractorAndTrack({
              articleId: cachedArticle.id,
              req,
              reference,
              verseText,
              lang,
              provider,
              sourceTitle: title,
              sourceType: "extra_analysis_article",
              sourceLens: String(id),
              sourceArticle: cachedArticle.raw_text,
            }),
          );
        }

        return NextResponse.json({
          text: cachedArticle.raw_text,
          cached: true,
          source: "research_articles",
          article_id: cachedArticle.id,
          extraction_status: cachedArticle.extraction_status,
          canonical_ref: normalizedReference.canonical_ref,
        });
      }
    }

    let prompt: string;
    let expectJSON = false;
    let autoIntake:
      | {
          articleId: string | null;
          sourceTitle: string;
          sourceType: string;
          sourceLens: string;
        }
      | null = null;

    if (kind === "lens" && isLensId(id)) {
      let chapterText: string | null = null;
      let chapterReference: string | null = null;

      if (id === "context") {
        try {
          const chapter = await getChapterText(reference, lang, provider);
          chapterText = chapter.text;
          chapterReference = chapter.reference;

          console.log("[CONTEXT_LENS] chapter loaded", {
            reference,
            chapterReference,
            lang,
            provider,
            model: getModelName(provider),
            length: chapterText.length,
          });
        } catch (error) {
          console.warn("[CONTEXT_LENS] chapter load failed", {
            reference,
            lang,
            provider,
            model: getModelName(provider),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      prompt = buildLensPrompt({
        lens: id,
        reference,
        verseText,
        lang,
        chapterText,
        chapterReference,
      });

      expectJSON = true;
    } else if (kind === "extra" && isExtraId(id)) {
      prompt = buildExtraPrompt({ id, reference, verseText, lang });
      expectJSON = true;

      autoIntake = {
        articleId: null,
        sourceTitle: getExtraArticleTitle(id, lang),
        sourceType: "extra_analysis_article",
        sourceLens: String(id),
      };
    } else if (kind === "context") {
      const { buildContextPrompt } = await import(
        "@/lib/prompts/buildContextPrompt"
      );
      prompt = buildContextPrompt({ reference, verseText, lang });
      expectJSON = true;
    } else if (kind === "expand-angle") {
      const angleTitle =
        typeof body?.angleTitle === "string" ? body.angleTitle.trim() : "";
      const anchor = typeof body?.anchor === "string" ? body.anchor.trim() : "";

      if (!angleTitle) {
        return NextResponse.json(
          { error: "angleTitle is required for expand-angle" },
          { status: 400 },
        );
      }

      prompt = buildExpandPrompt({
        angleTitle,
        anchor,
        reference,
        verseText,
        lang,
      });

      autoIntake = {
        articleId: null,
        sourceTitle: angleTitle,
        sourceType: getString(body?.sourceType) ?? "expanded_article",
        sourceLens: getString(body?.sourceLens) ?? "expand-angle",
      };
    } else {
      return NextResponse.json(
        {
          error:
            "kind must be 'lens', 'extra', 'context', or 'expand-angle' with a valid id",
        },
        { status: 400 },
      );
    }

    const text = await runAI(provider, prompt, lang, expectJSON);

    if (provider === "gemini" && expectJSON) {
      console.log("[DEBUG gemini raw]", {
        kind,
        id: id ?? null,
        model: getModelName(provider),
        len: text.length,
        first: text[0] ?? "(empty)",
        last: text[text.length - 1] ?? "(empty)",
        preview: text.slice(0, 2000),
      });
    }

    let wordLensArticleId: string | null = null;
    let wordLensExtractionStatus: string | null = null;
    let wordLensDuplicate = false;
    let wordLensContentHash: string | null = null;

    if (kind === "lens" && id === "word" && isLensId(id)) {
      try {
        const savedWordLens = await saveWordLensToResearchLake({
          req,
          reference,
          canonicalRef: normalizedReference.canonical_ref,
          verseText,
          lang,
          provider,
          prompt,
          rawOutput: text,
        });

        wordLensArticleId = savedWordLens.articleId;
        wordLensExtractionStatus = savedWordLens.extractionStatus;
        wordLensDuplicate = savedWordLens.duplicate;
        wordLensContentHash = savedWordLens.contentHash;
      } catch (error) {
        console.warn("[WORD_LENS_RESEARCH_LAKE] save/extract scheduling failed", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          provider,
          model: getModelName(provider),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (shouldUseWordCache) {
      const parsedReference = parseReference(reference);
      const cacheableJson = parseCacheableJson(text);

      if (cacheableJson) {
        await saveCachedResult({
          reference,
          book: parsedReference.book,
          chapter: parsedReference.chapter,
          verse: parsedReference.verse,
          lens: "word",
          lang,
          provider,
          model: getModelName(provider),
          raw_json: cacheableJson,
        });

        console.log("[WORD_LENS_CACHE] saved", {
          reference,
          canonical_ref: normalizedReference.canonical_ref,
          lang,
          provider,
          model: getModelName(provider),
        });
      } else {
        console.warn("[WORD_LENS_CACHE] skipped save because response was not valid JSON", {
          reference,
          lens: "word",
          lang,
          provider,
          model: getModelName(provider),
          preview: text.slice(0, 1000),
        });
      }
    }

    if (shouldUseTranslationsCache) {
      const rawJson = parseCacheableJson(text);
      const normalizedOutput = normalizeLensDiscoveryOutput(rawJson);

      if (normalizedOutput) {
        await saveLensDiscoveryCards({
          reference: lensCacheReference,
          lensId: "translations",
          lang,
          protocolVersion: "translation_discovery_v2.2",
          provider,
          model: getModelName(provider),
          output: normalizedOutput,
          status: "active",
          score: 75,
          sourceKind: "translation_lens_generation",
        });

        console.log("[LENS_DISCOVERY_CARDS] saved", {
          reference: lensCacheReference,
          originalReference: reference,
          lens: "translations",
          lang,
          count: normalizedOutput.cards.length,
        });
      } else {
        console.warn(
          "[LENS_DISCOVERY_CARDS] skipped save: invalid translation output",
          {
            reference: lensCacheReference,
            originalReference: reference,
            lens: "translations",
            lang,
            provider,
            model: getModelName(provider),
            preview: text.slice(0, 1000),
          },
        );
      }
    }

    if (kind === "extra" && isExtraId(id)) {
      const parsedReference = parseReference(reference);
      const rawJson = parseCacheableJson(text);

      const savedArticle = await saveResearchArticle({
        reference,
        canonicalRef: normalizedReference.canonical_ref,
        book: parsedReference.book,
        chapter: parsedReference.chapter,
        verse: parsedReference.verse,
        lang,
        provider,
        model: getModelName(provider),
        articleType: id,
        title: getExtraArticleTitle(id, lang),
        rawText: text,
        rawJson,
      });

      if (autoIntake && savedArticle?.id) {
        autoIntake.articleId = savedArticle.id;
      }
    }

    if (shouldUseAnglesCache) {
      const parsedReference = parseReference(reference);
      const cacheableJson = parseCacheableJson(text);

      if (cacheableJson) {
        await saveCachedResult({
          reference,
          book: parsedReference.book,
          chapter: parsedReference.chapter,
          verse: parsedReference.verse,
          lens: "angles",
          lang,
          provider,
          model: getModelName(provider),
          raw_json: cacheableJson,
        });

        after(() =>
          autoProcessInitialAngles({
            req,
            reference,
            verseText,
            lang,
            provider,
            rawJson: cacheableJson,
            sourceLabel: `initial_angles:${getModelName(provider)}`,
          }),
        );
      } else {
        console.warn("[CACHE] skipped save because response was not valid JSON", {
          reference,
          lens: "angles",
          lang,
          provider,
          model: getModelName(provider),
          preview: text.slice(0, 1000),
        });
      }
    }

    if (autoIntake) {
      after(() =>
        runArticleExtractorAndTrack({
          articleId: autoIntake.articleId,
          req,
          reference,
          verseText,
          lang,
          provider,
          sourceTitle: autoIntake.sourceTitle,
          sourceType: autoIntake.sourceType,
          sourceLens: autoIntake.sourceLens,
          sourceArticle: text,
        }),
      );
    }

    return NextResponse.json({
      text,
      cached: false,
      canonical_ref: normalizedReference.canonical_ref,
      article_id: autoIntake?.articleId ?? wordLensArticleId,
      word_lens_article_id: wordLensArticleId,
      word_lens_extraction_status: wordLensExtractionStatus,
      word_lens_duplicate: wordLensDuplicate,
      word_lens_content_hash: wordLensContentHash,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}












