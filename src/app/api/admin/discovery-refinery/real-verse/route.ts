import { NextResponse } from "next/server";
import { isProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import {
  getAllStudioCardsForVerse,
  type AngleCardRow,
} from "@/lib/cache/angleCards";
import { saveDiscoveryRefineryRun } from "@/lib/discovery-refinery/runLog/saveDiscoveryRefineryRun";
import {
  runRealVerseTextOnlyPreview,
  type RealVerseTextOnlyResult,
} from "@/lib/discovery-refinery/realVerseTextOnly/runRealVerseTextOnly";
import type { ExistingCoverageCard } from "@/lib/discovery-refinery/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru";

type RealVerseRequestBody = {
  reference?: unknown;
  canonical_ref?: unknown;
  canonicalRef?: unknown;
  lang?: unknown;
  detectorProvider?: unknown;
  detector_provider?: unknown;
  judgeProvider?: unknown;
  judge_provider?: unknown;
  verifierProvider?: unknown;
  verifier_provider?: unknown;
  genre?: unknown;
  saveRunLog?: unknown;
};

type NormalizedCandidate = {
  source: string;
  raw: string;
  canonical_ref: string | null;
  passage_id: string | null;
  book_key: string | null;
  usable: boolean;
};

type ReferenceIdentity = {
  canonicalRef: string;
  passageId: string;
  bookKey: string | null;
  chosenFrom: string;
  candidates: NormalizedCandidate[];
};

const ROUTE_RU_BOOK_ALIASES: Record<string, string> = {
  "бытие": "genesis",
  "бытия": "genesis",
  "быт": "genesis",

  "исход": "exodus",
  "исхода": "exodus",
  "исх": "exodus",

  "левит": "leviticus",
  "левита": "leviticus",
  "лев": "leviticus",

  "числа": "numbers",
  "чисел": "numbers",
  "чис": "numbers",

  "второзаконие": "deuteronomy",
  "второзакония": "deuteronomy",
  "втор": "deuteronomy",

  "иисус навин": "joshua",
  "иисуса навина": "joshua",
  "навин": "joshua",
  "навина": "joshua",

  "судьи": "judges",
  "судей": "judges",

  "руфь": "ruth",
  "руфи": "ruth",
  "рут": "ruth",

  "1 самуила": "1-samuel",
  "1-я самуила": "1-samuel",
  "1 царств": "1-samuel",
  "1-я царств": "1-samuel",

  "2 самуила": "2-samuel",
  "2-я самуила": "2-samuel",
  "2 царств": "2-samuel",
  "2-я царств": "2-samuel",

  "3 царств": "1-kings",
  "3-я царств": "1-kings",
  "1 королей": "1-kings",
  "1-я королей": "1-kings",

  "4 царств": "2-kings",
  "4-я царств": "2-kings",
  "2 королей": "2-kings",
  "2-я королей": "2-kings",

  "1 паралипоменон": "1-chronicles",
  "1-я паралипоменон": "1-chronicles",
  "1 летопись": "1-chronicles",
  "1-я летопись": "1-chronicles",

  "2 паралипоменон": "2-chronicles",
  "2-я паралипоменон": "2-chronicles",
  "2 летопись": "2-chronicles",
  "2-я летопись": "2-chronicles",

  "ездра": "ezra",
  "ездры": "ezra",

  "неемия": "nehemiah",
  "неемии": "nehemiah",

  "есфирь": "esther",
  "есфири": "esther",

  "иов": "job",
  "иова": "job",

  "псалом": "psalms",
  "псалма": "psalms",
  "псалтирь": "psalms",
  "псалмы": "psalms",
  "пс": "psalms",

  "притчи": "proverbs",
  "притчей": "proverbs",

  "екклесиаст": "ecclesiastes",
  "екклесиаста": "ecclesiastes",
  "экклезиаст": "ecclesiastes",
  "экклезиаста": "ecclesiastes",

  "песнь песней": "song-of-songs",
  "песни песней": "song-of-songs",

  "исаия": "isaiah",
  "исайя": "isaiah",
  "исаии": "isaiah",
  "исайи": "isaiah",

  "иеремия": "jeremiah",
  "иеремии": "jeremiah",

  "плач иеремии": "lamentations",
  "плач": "lamentations",

  "иезекииль": "ezekiel",
  "иезекииля": "ezekiel",
  "езекииль": "ezekiel",
  "езекииля": "ezekiel",

  "даниил": "daniel",
  "даниила": "daniel",

  "осия": "hosea",
  "осии": "hosea",

  "иоиль": "joel",
  "иоиля": "joel",

  "амос": "amos",
  "амоса": "amos",

  "авдий": "obadiah",
  "авдия": "obadiah",

  "иона": "jonah",
  "ионы": "jonah",

  "михей": "micah",
  "михея": "micah",

  "наум": "nahum",
  "наума": "nahum",

  "аввакум": "habakkuk",
  "аввакума": "habakkuk",

  "софония": "zephaniah",
  "софонии": "zephaniah",

  "аггей": "haggai",
  "аггея": "haggai",

  "захария": "zechariah",
  "захарии": "zechariah",

  "малахия": "malachi",
  "малахии": "malachi",

  "матфея": "matthew",
  "матфей": "matthew",
  "от матфея": "matthew",

  "марка": "mark",
  "марк": "mark",
  "от марка": "mark",

  "луки": "luke",
  "лука": "luke",
  "от луки": "luke",

  "иоанна": "john",
  "иоанн": "john",
  "от иоанна": "john",

  "деяния": "acts",
  "деяний": "acts",
  "деяния апостолов": "acts",

  "римлянам": "romans",
  "к римлянам": "romans",

  "1 коринфянам": "1-corinthians",
  "1-е коринфянам": "1-corinthians",
  "2 коринфянам": "2-corinthians",
  "2-е коринфянам": "2-corinthians",

  "галатам": "galatians",
  "к галатам": "galatians",

  "ефесянам": "ephesians",
  "к ефесянам": "ephesians",

  "филиппийцам": "philippians",
  "к филиппийцам": "philippians",

  "колоссянам": "colossians",
  "к колоссянам": "colossians",

  "1 фессалоникийцам": "1-thessalonians",
  "1-е фессалоникийцам": "1-thessalonians",
  "2 фессалоникийцам": "2-thessalonians",
  "2-е фессалоникийцам": "2-thessalonians",

  "1 тимофею": "1-timothy",
  "1-е тимофею": "1-timothy",
  "2 тимофею": "2-timothy",
  "2-е тимофею": "2-timothy",

  "титу": "titus",

  "филимону": "philemon",

  "евреям": "hebrews",
  "к евреям": "hebrews",

  "иакова": "james",
  "иаков": "james",

  "1 петра": "1-peter",
  "1-е петра": "1-peter",
  "2 петра": "2-peter",
  "2-е петра": "2-peter",

  "1 иоанна": "1-john",
  "1-е иоанна": "1-john",
  "2 иоанна": "2-john",
  "2-е иоанна": "2-john",
  "3 иоанна": "3-john",
  "3-е иоанна": "3-john",

  "иуды": "jude",
  "иуда": "jude",

  "откровение": "revelation",
  "откровения": "revelation",
  "откровение иоанна": "revelation",
  "апокалипсис": "revelation",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[DISCOVERY_REFINERY_REAL_VERSE] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
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

function getJsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function getNestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> {
  const record = getJsonRecord(value);
  return getJsonRecord(record[key]);
}

function getNestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return getString(current);
}

function getFingerprintHash(card: AngleCardRow): string | null {
  return (
    getNestedString(card.evaluation, ["angle_fingerprint", "hash"]) ||
    getNestedString(card.evaluation, ["fingerprint", "hash"]) ||
    getNestedString(card.battle, ["angle_fingerprint", "hash"]) ||
    getNestedString(card.original_card, ["angle_fingerprint", "hash"]) ||
    getNestedString(card.original_card, ["signal", "angle_fingerprint", "hash"])
  );
}

function getFingerprintComponents(card: AngleCardRow): Record<string, unknown> | null {
  const evaluation = getJsonRecord(card.evaluation);
  const battle = getJsonRecord(card.battle);
  const originalCard = getJsonRecord(card.original_card);
  const originalSignal = getNestedRecord(card.original_card, "signal");

  const direct =
    getJsonRecord(evaluation.angle_fingerprint).hash ||
    getJsonRecord(battle.angle_fingerprint).hash ||
    getJsonRecord(originalCard.angle_fingerprint).hash ||
    getJsonRecord(originalSignal.angle_fingerprint).hash;

  if (direct) {
    const fingerprint =
      getJsonRecord(evaluation.angle_fingerprint).hash
        ? getJsonRecord(evaluation.angle_fingerprint)
        : getJsonRecord(battle.angle_fingerprint).hash
          ? getJsonRecord(battle.angle_fingerprint)
          : getJsonRecord(originalCard.angle_fingerprint).hash
            ? getJsonRecord(originalCard.angle_fingerprint)
            : getJsonRecord(originalSignal.angle_fingerprint);

    return {
      anchor:
        getNestedString(fingerprint, ["anchor_canonical", "text"]) ??
        card.anchor ??
        null,
      phenomenon: getString(fingerprint.phenomenon),
      interpretive_move: getString(fingerprint.interpretive_move),
      angle_family: getString(fingerprint.angle_family),
    };
  }

  return {
    anchor: card.anchor,
    phenomenon: null,
    interpretive_move: card.angle_summary ?? card.title,
    angle_family: card.coverage_type ?? "other",
  };
}

function toExistingCoverageCard(card: AngleCardRow): ExistingCoverageCard {
  const fingerprintComponents = getFingerprintComponents(card);

  const coverageCard = {
    card_id: card.id,
    id: card.id,

    reference: card.reference,
    canonical_ref: card.canonical_ref,
    lang: card.lang,

    status: card.status,
    title: card.title,
    anchor_surface: card.anchor,
    anchor_canonical: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    angle_summary: card.angle_summary,
    coverage_type: card.coverage_type,

    score_total: card.score_total,
    effective_score: (card.score_total ?? 0) + (card.moderator_boost ?? 0),

    angle_family:
      getString(fingerprintComponents?.angle_family) ??
      card.coverage_type ??
      "other",
    fingerprint_hash: getFingerprintHash(card),
    fingerprint_components: fingerprintComponents,

    source_type: card.source_type,
    source_model: card.source_model,

    created_at: card.created_at,
    updated_at: card.updated_at,
  };

  return coverageCard as unknown as ExistingCoverageCard;
}

function buildPassageId(canonicalRef: string): string {
  return canonicalRef
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRouteBookName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—]/g, "-")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/^к\s+/, "")
    .replace(/^ко\s+/, "")
    .replace(/^от\s+/, "")
    .replace(/^пророка\s+/, "")
    .replace(/^книга\s+/, "")
    .replace(/^евангелие\s+от\s+/, "")
    .replace(/^([1-4])\s*[-–—]?\s*(?:я|е|й|ая|ое)?\s+/, "$1 ")
    .trim();
}

function isSafeCanonicalRef(value: string | null): value is string {
  if (!value) return false;
  if (/[А-Яа-яЁё:]/.test(value)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+){0,2}$/.test(value);
}

function deriveBookKeyFromCanonical(canonicalRef: string | null): string | null {
  if (!canonicalRef) return null;

  const parts = canonicalRef.split("-").filter(Boolean);

  while (parts.length > 0 && /^\d+$/.test(parts[parts.length - 1])) {
    parts.pop();
  }

  const bookKey = parts.join("-");
  return bookKey || null;
}

function fallbackNormalizeReference(raw: string): {
  canonical_ref: string;
  passage_id: string;
  book_key: string;
} | null {
  const normalized = raw
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const match = normalized.match(
    /^(.+?)\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?)?$/,
  );

  if (!match) return null;

  const rawBook = normalizeRouteBookName(match[1] ?? "");
  const chapter = Number(match[2]);
  const verse = match[3] ? Number(match[3]) : null;
  const endVerse = match[4] ? Number(match[4]) : null;

  const bookKey = ROUTE_RU_BOOK_ALIASES[rawBook];

  if (!bookKey || !Number.isFinite(chapter) || chapter <= 0) {
    return null;
  }

  const canonicalRef =
    verse && endVerse && endVerse !== verse
      ? `${bookKey}-${chapter}-${verse}-${endVerse}`
      : verse
        ? `${bookKey}-${chapter}-${verse}`
        : `${bookKey}-${chapter}`;

  return {
    canonical_ref: canonicalRef,
    passage_id: buildPassageId(canonicalRef),
    book_key: bookKey,
  };
}

function normalizeCandidate(source: string, raw: string | null): NormalizedCandidate | null {
  if (!raw) return null;

  const normalized = normalizeReference(raw);
  const fallback = fallbackNormalizeReference(raw);

  const canonicalRef = isSafeCanonicalRef(normalized.canonical_ref)
    ? normalized.canonical_ref
    : fallback?.canonical_ref ?? null;

  const bookKey =
    normalized.book_key ??
    fallback?.book_key ??
    deriveBookKeyFromCanonical(canonicalRef);

  const passageId = canonicalRef
    ? normalized.passage_id && !/[А-Яа-яЁё]/.test(normalized.passage_id)
      ? normalized.passage_id
      : buildPassageId(canonicalRef)
    : null;

  return {
    source,
    raw,
    canonical_ref: canonicalRef,
    passage_id: passageId,
    book_key: bookKey,
    usable: Boolean(canonicalRef && passageId),
  };
}

function resolveReferenceIdentity(args: {
  reference: string;
  returnedReference: string | null;
  explicitCanonical: string | null;
}): ReferenceIdentity {
  const candidates = [
    normalizeCandidate("explicit_body_canonical", args.explicitCanonical),
    normalizeCandidate("request_reference", args.reference),
    normalizeCandidate("getVerseText_returned_reference", args.returnedReference),
  ].filter((item): item is NormalizedCandidate => item !== null);

  const preferred =
    candidates.find((item) => item.usable && Boolean(item.book_key)) ??
    candidates.find((item) => item.usable);

  if (preferred?.canonical_ref && preferred.passage_id) {
    return {
      canonicalRef: preferred.canonical_ref,
      passageId: preferred.passage_id,
      bookKey: preferred.book_key,
      chosenFrom: preferred.source,
      candidates,
    };
  }

  const fallbackCanonical = args.reference
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return {
    canonicalRef: fallbackCanonical || args.reference,
    passageId: buildPassageId(fallbackCanonical || args.reference),
    bookKey: null,
    chosenFrom: "last_resort_slug",
    candidates,
  };
}

function simplifyResultForResponse(result: RealVerseTextOnlyResult) {
  return {
    ok: result.ok,
    mode: result.mode,
    reference: result.reference,
    canonical_ref: result.canonical_ref,
    passage_id: result.passage_id,

    lang: result.lang,
    surface_translation: result.surface_translation,
    pipeline_language_mode: result.pipeline_language_mode,
    experiment_id: result.experiment_id,

    detector_signal_count: result.detector_signal_count,
    queue_item_count: result.queue.length,
    action_counts: result.action_counts,
    tier_counts: result.tier_counts,
    errors: result.errors,

    queue: result.queue,
    diagnostics: result.diagnostics,
    signal_flow: result.signal_flow,
    scope_decision: result.scope_decision,
    input_context_snapshot: result.input_context_snapshot,
    detector_raw_text: result.detector_raw_text,
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as RealVerseRequestBody;

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }

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
        {
          ok: false,
          error:
            "Only lang=ru is supported in the current real_text_only Russian-first experiment.",
        },
        { status: 400 },
      );
    }

    const detectorProvider = chooseProvider(
      body.detectorProvider ?? body.detector_provider,
      "DISCOVERY_SIGNAL_PROVIDER",
      "claude",
    );
    const judgeProvider = chooseProvider(
      body.judgeProvider ?? body.judge_provider,
      "DISCOVERY_JUDGE_PROVIDER",
      "openai",
    );
    const verifierProvider = chooseProvider(
      body.verifierProvider ?? body.verifier_provider,
      "DISCOVERY_VERIFIER_PROVIDER",
      "openai",
    );

    const genre = getString(body.genre);

    const verseResult = await getVerseText(reference, lang, detectorProvider);
    const verseTextRu = verseResult.text.trim();

    const explicitCanonical =
      getString(body.canonical_ref) || getString(body.canonicalRef);

    const identity = resolveReferenceIdentity({
      reference,
      returnedReference: verseResult.reference,
      explicitCanonical,
    });

    const canonicalRef = identity.canonicalRef;
    const passageId = identity.passageId;
    const bookKey = identity.bookKey;

    if (!verseTextRu) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not load Russian verse text.",
          reference,
          canonical_ref: canonicalRef,
          book_key: bookKey,
          normalization: {
            chosen_from: identity.chosenFrom,
            candidates: identity.candidates,
          },
        },
        { status: 500 },
      );
    }

    const cardsResult = await getAllStudioCardsForVerse({
      reference,
      canonical_ref: canonicalRef,
      lang,
      limit: 140,
    });

    if (!cardsResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: cardsResult.error ?? "Failed to read existing Studio cards.",
          reference,
          canonical_ref: canonicalRef,
          book_key: bookKey,
          normalization: {
            chosen_from: identity.chosenFrom,
            candidates: identity.candidates,
          },
        },
        { status: 500 },
      );
    }

    const existingCards = cardsResult.cards.map(toExistingCoverageCard);

    const result = await runRealVerseTextOnlyPreview({
      reference,
      canonicalRef,
      passageId,
      verseTextRu,
      passageTextRu: verseTextRu,
      existingCards,
      detectorProvider,
      judgeProvider,
      verifierProvider,
      genre,
    });

    const shouldSaveRunLog = getBoolean(body.saveRunLog) ?? true;
    let runLog:
      | {
          saved: boolean;
          run_id: string | null;
          signal_count: number;
          skipped: boolean;
          error: string | null;
        }
      | null = null;

    if (shouldSaveRunLog) {
      try {
        const saved = await saveDiscoveryRefineryRun({
          result,
          mode: "real_text_only",
          isFixture: false,
          fixtureId: null,
          codeGitSha:
            process.env.VERCEL_GIT_COMMIT_SHA ??
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
            null,
        });

        runLog = {
          saved: !saved.skipped,
          run_id: saved.run_id || null,
          signal_count: saved.signal_count,
          skipped: saved.skipped,
          error: null,
        };
      } catch (error) {
        runLog = {
          saved: false,
          run_id: null,
          signal_count: 0,
          skipped: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return NextResponse.json({
      ok: result.ok,
      mode: "real_text_only",
      changed_database: shouldSaveRunLog && Boolean(runLog?.saved),
      saved_to_run_log: Boolean(runLog?.saved),
      run_log: runLog,

      reference,
      canonical_ref: canonicalRef,
      book_key: bookKey,
      passage_id: passageId,
      lang,

      normalization: {
        chosen_from: identity.chosenFrom,
        candidates: identity.candidates,
      },

      source: {
        verse_text_source: "getVerseText ru local-first",
        verse_reference_returned: verseResult.reference,
        surface_translation: "rstj_yahweh",
      },

      existing_card_count: cardsResult.cards.length,
      active_or_reserve_count: cardsResult.cards.filter(
        (card) => card.status === "featured" || card.status === "reserve",
      ).length,

      result: simplifyResultForResponse(result),
    });
  } catch (error) {
    console.error("[DISCOVERY_REFINERY_REAL_VERSE] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to run real verse text-only diagnostic.",
      },
      { status: 500 },
    );
  }
}
