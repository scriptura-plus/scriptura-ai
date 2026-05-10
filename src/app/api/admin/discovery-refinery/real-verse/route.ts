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

    const normalized = normalizeReference(reference);
    const canonicalRef =
      getString(body.canonical_ref) ||
      getString(body.canonicalRef) ||
      normalized.canonical_ref ||
      reference;

    const passageId = buildPassageId(canonicalRef);
    const genre = getString(body.genre);

    const verseResult = await getVerseText(reference, lang, detectorProvider);
    const verseTextRu = verseResult.text.trim();

    if (!verseTextRu) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not load Russian verse text.",
          reference,
          canonical_ref: canonicalRef,
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
      book_key: normalized.book_key ?? null,
      lang,

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
