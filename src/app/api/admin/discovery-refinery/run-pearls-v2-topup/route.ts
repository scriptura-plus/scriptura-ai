import { NextResponse } from "next/server";
import { isProvider, defaultProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { getAngleCards } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const MIN_OLD_PIPELINE_SAVE_SCORE = 74;
const REPLACEMENT_AUTO_DELTA = 8;
const NEAR_REPLACEMENT_MIN_DELTA = 3;
const STRONG_DUPLICATE_SCORE = 82;

type Lang = "ru";
type JsonRecord = Record<string, unknown>;

type TopupBody = {
  reference?: unknown;
  lang?: unknown;
  targetCount?: unknown;
  force?: unknown;
  processLimit?: unknown;
  includeStrongNonPublic?: unknown;
  provider?: unknown;
  editorProvider?: unknown;
  cards?: unknown;
};

type V2Card = {
  card_id?: string;
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
  score_total?: number | null;
  public_ready?: boolean;
  public_status?: string | null;
  risk_flags?: string[];
  public_blockers?: string[];
  verdict?: string | null;
  lexicon_claim_status?: string | null;
  lexicon_note?: string | null;
};

type PreviewDuplicateInfo = {
  matched_card_id: string | null;
  existing_score: number | null;
  candidate_score: number | null;
  score_delta: number | null;
  same_angle: boolean | null;
  similarity_confidence: number | null;
  battle_action: string | null;
  battle_reason: string | null;
  reason: string | null;
  existing_card: JsonRecord | null;
  candidate_card: JsonRecord | null;
};

type ReviewCandidate = {
  type: "near_replacement" | "strong_duplicate";
  reason: string;
  reference: string;
  canonical_ref: string;
  candidate_title: string;
  candidate_score_v2: number | null;
  preview_score: number | null;
  old_pipeline_status: string | null;
  existing_card_id: string | null;
  existing_title: string | null;
  existing_score: number | null;
  score_delta: number | null;
  candidate: ReturnType<typeof makeCandidate>;
  preview_duplicate: PreviewDuplicateInfo | null;
  suggested_actions: string[];
  preview_response: unknown;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[PEARLS_V2_TOPUP] ADMIN_SECRET is not configured");
    return false;
  }

  return req.headers.get("x-admin-secret") === expected;
}

function chooseProvider(value: unknown, fallback: Provider): Provider {
  if (isProvider(value)) return value;

  const envProvider = process.env.DISCOVERY_TOPUP_PROVIDER;
  if (isProvider(envProvider)) return envProvider;

  return fallback;
}

function normalizeV2Card(value: unknown): V2Card | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) return null;

  const riskFlags = Array.isArray(value.risk_flags)
    ? value.risk_flags
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const publicBlockers = Array.isArray(value.public_blockers)
    ? value.public_blockers
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    card_id: getString(value.card_id) ?? undefined,
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters: getString(value.why_it_matters),
    score_total: getNumber(value.score_total),
    public_ready: value.public_ready === true,
    public_status: getString(value.public_status),
    risk_flags: riskFlags,
    public_blockers: publicBlockers,
    verdict: getString(value.verdict),
    lexicon_claim_status: getString(value.lexicon_claim_status),
    lexicon_note: getString(value.lexicon_note),
  };
}

function shouldSendToOldPipeline(
  card: V2Card,
  _includeStrongNonPublic: boolean,
): boolean {
  const score = card.score_total ?? 0;

  // V2 is only the factory. The old process-angle-candidate route is the final judge.
  // So we send every strong V2 card to the old pipeline, even if V2 marked it not_public_ready.
  // The old pipeline will decide save / rewrite / duplicate / reject.
  if (score >= 82) return true;

  return false;
}

function isLexiconClearedByV2(card: V2Card): boolean {
  const status = (card.lexicon_claim_status ?? "").trim().toLowerCase();
  return status === "supported" || status === "not_applicable";
}

function hasEvidenceRisk(card: V2Card): boolean {
  const hardRiskFlags = new Set([
    "theological_overreach",
    "overclaim",
    "pretty_empty",
    "duplicate_risk",
    "needs_rewrite_or_moderator",
  ]);

  const evidenceRiskFlags = new Set([
    "lexical_check",
    "translation_check",
    "syntax_check",
    "historical_check",
    "intertextual_check",
    "needs_evidence_before_public",
  ]);

  const flags = [
    ...(card.risk_flags ?? []),
    ...(card.public_blockers ?? []),
    card.public_status ?? "",
    card.verdict ?? "",
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  const lexiconCleared = isLexiconClearedByV2(card);

  const hardRisk = flags.some((flag) => {
    if (hardRiskFlags.has(flag)) return true;
    if (flag.includes("theological_overreach")) return true;
    if (flag.includes("overclaim")) return true;
    if (flag.includes("pretty_empty")) return true;
    if (flag.includes("needs_rewrite_or_moderator")) return true;
    return false;
  });

  if (hardRisk) return true;

  const evidenceRisk = flags.some((flag) => {
    if (evidenceRiskFlags.has(flag)) return true;
    if (flag.includes("lexical_check")) return true;
    if (flag.includes("translation_check")) return true;
    if (flag.includes("syntax_check")) return true;
    if (flag.includes("historical_check")) return true;
    if (flag.includes("intertextual_check")) return true;
    if (flag.includes("needs_evidence")) return true;
    return false;
  });

  if (evidenceRisk && !lexiconCleared) return true;

  const text = getCardTextForRisk(card);

  // Catch risky source-sensitive claims even when V2 forgot to flag them.
  // If V2 already checked the inner lexicon and marked the claim supported/not_applicable,
  // we do not force hidden just because Greek/Hebrew words are present.
  const sourceSensitivePatterns = [
    "греческ",
    "еврейск",
    "арамейск",
    "оригинал",
    "original",
    "greek",
    "hebrew",
    "aramaic",
    "перевод",
    "translation",
    "лексич",
    "lexical",
    "синтакс",
    "syntax",
    "граммат",
    "grammar",
    "морфолог",
    "morpholog",
    "перфект",
    "perfect",
    "имперфект",
    "imperfect",
    "аорист",
    "aorist",
    "причаст",
    "participle",
    "падеж",
    "case",
    "форма незаверш",
    "незавершённ",
    "незавершенн",
    "длительность",
    "semantic",
    "root",
    "корень",
  ];

  if (!lexiconCleared) {
    return sourceSensitivePatterns.some((pattern) => text.includes(pattern));
  }

  return false;
}

function getCardTextForRisk(card: V2Card): string {
  return [
    card.title,
    card.anchor,
    card.teaser,
    card.why_it_matters,
    ...(card.risk_flags ?? []),
    ...(card.public_blockers ?? []),
    card.public_status,
    card.verdict,
    card.lexicon_claim_status,
    card.lexicon_note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function chooseForceStatus(card: V2Card): "hidden" | null {
  if (hasEvidenceRisk(card)) return "hidden";
  return null;
}

function makeCandidate(card: V2Card) {
  return {
    id: card.card_id ?? undefined,
    title: card.title,
    anchor: card.anchor ?? null,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? null,
  };
}

function keyOf(title: string | null | undefined, anchor: string | null | undefined) {
  return `${(title ?? "").trim().toLowerCase()}|${(anchor ?? "")
    .trim()
    .toLowerCase()}`;
}

function getNestedRecord(record: JsonRecord, key: string): JsonRecord | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function getPreviewDuplicateInfo(previewRecord: JsonRecord): PreviewDuplicateInfo | null {
  const duplicate = getNestedRecord(previewRecord, "duplicate");
  if (!duplicate) return null;

  const existingCard = getNestedRecord(duplicate, "existing_card");
  const candidateCard = getNestedRecord(duplicate, "candidate_card");
  const battle = getNestedRecord(duplicate, "battle");

  const existingScore = getNumber(duplicate.existing_score) ?? getNumber(existingCard?.score_total);
  const candidateScore = getNumber(duplicate.candidate_score) ?? getNumber(previewRecord.score_total);
  const scoreDelta =
    getNumber(battle?.score_delta) ??
    (typeof existingScore === "number" && typeof candidateScore === "number"
      ? candidateScore - existingScore
      : null);

  return {
    matched_card_id: getString(duplicate.matched_card_id) ?? getString(existingCard?.id),
    existing_score: existingScore,
    candidate_score: candidateScore,
    score_delta: scoreDelta,
    same_angle: typeof duplicate.same_angle === "boolean" ? duplicate.same_angle : null,
    similarity_confidence: getNumber(duplicate.similarity_confidence),
    battle_action: getString(battle?.battle_action),
    battle_reason: getString(battle?.battle_reason),
    reason: getString(duplicate.reason),
    existing_card: existingCard,
    candidate_card: candidateCard,
  };
}

function getPreviewDuplicateExistingId(previewRecord: JsonRecord): string | null {
  return getPreviewDuplicateInfo(previewRecord)?.matched_card_id ?? null;
}

function getPreviewWouldSave(previewRecord: JsonRecord): boolean | null {
  return getBoolean(previewRecord.would_save);
}

function getPreviewSkipReason(previewRecord: JsonRecord): string | null {
  return getString(previewRecord.skip_reason);
}

function shouldCreateReviewCandidate(args: {
  duplicateInfo: PreviewDuplicateInfo | null;
  previewScore: number | null;
  card: V2Card;
}): boolean {
  const duplicate = args.duplicateInfo;
  if (!duplicate?.matched_card_id) return false;

  const v2Score = args.card.score_total ?? null;
  const candidateScore = duplicate.candidate_score ?? args.previewScore ?? v2Score;
  const existingScore = duplicate.existing_score;
  const scoreDelta = duplicate.score_delta;

  // If Pearls v2 produced a strong card and the old pipeline rejected it only as a duplicate,
  // return it to editor review instead of letting it disappear.
  if (typeof v2Score === "number" && v2Score >= STRONG_DUPLICATE_SCORE) {
    return true;
  }

  if (typeof candidateScore === "number" && candidateScore >= STRONG_DUPLICATE_SCORE) {
    return true;
  }

  if (typeof scoreDelta === "number" && scoreDelta >= NEAR_REPLACEMENT_MIN_DELTA) {
    return true;
  }

  if (
    typeof candidateScore === "number" &&
    typeof existingScore === "number" &&
    candidateScore - existingScore >= NEAR_REPLACEMENT_MIN_DELTA
  ) {
    return true;
  }

  return false;
}

function buildReviewCandidate(args: {
  reference: string;
  canonicalRef: string;
  card: V2Card;
  candidate: ReturnType<typeof makeCandidate>;
  previewScore: number | null;
  oldPipelineStatus: string | null;
  duplicateInfo: PreviewDuplicateInfo | null;
  previewResponse: unknown;
}): ReviewCandidate {
  const duplicate = args.duplicateInfo;
  const existingCard = duplicate?.existing_card ?? null;
  const scoreDelta = duplicate?.score_delta ?? null;
  const v2Score = args.card.score_total ?? null;

  const type =
    typeof scoreDelta === "number" && scoreDelta >= NEAR_REPLACEMENT_MIN_DELTA
      ? "near_replacement"
      : "strong_duplicate";

  return {
    type,
    reason:
      type === "near_replacement"
        ? "stronger_duplicate_below_replacement_threshold"
        : "strong_duplicate_needs_editor_review",
    reference: args.reference,
    canonical_ref: args.canonicalRef,
    candidate_title: args.candidate.title,
    candidate_score_v2: v2Score,
    preview_score: args.previewScore,
    old_pipeline_status: args.oldPipelineStatus,
    existing_card_id: duplicate?.matched_card_id ?? null,
    existing_title: getString(existingCard?.title),
    existing_score: duplicate?.existing_score ?? null,
    score_delta: scoreDelta,
    candidate: args.candidate,
    preview_duplicate: duplicate,
    suggested_actions: [
      "replace_existing",
      "keep_existing",
      "merge_idea",
      "save_as_reserve_anyway",
      "dismiss",
    ],
    preview_response: args.previewResponse,
  };
}

function buildProcessBody(args: {
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
  editorProvider: Provider;
  targetCount: number;
  canonicalRef: string;
  card: V2Card;
  candidate: ReturnType<typeof makeCandidate>;
  previewOnly?: boolean;
}) {
  const forcedStatus = chooseForceStatus(args.card);

  return {
    reference: args.reference,
    verseText: args.verseText,
    lang: args.lang,
    provider: args.provider,
    source_provider: "pearls_v2",
    source_model: "pearls_v2_current_result_topup_v8_review_candidates",
    editor_provider: args.editorProvider,
    targetFeaturedCount: args.targetCount,
    ...(forcedStatus ? { force_status: forcedStatus } : {}),
    ...(args.previewOnly ? { preview_only: true } : {}),
    sourceArticle: JSON.stringify({
      source: "pearls_v2_current_result_topup_v8_review_candidates",
      canonical_ref: args.canonicalRef,
      v2_card: args.card,
      forced_status: forcedStatus,
      has_evidence_risk: hasEvidenceRisk(args.card),
      lexicon_cleared_by_v2: isLexiconClearedByV2(args.card),
      min_old_pipeline_save_score: MIN_OLD_PIPELINE_SAVE_SCORE,
      replacement_auto_delta: REPLACEMENT_AUTO_DELTA,
      near_replacement_min_delta: NEAR_REPLACEMENT_MIN_DELTA,
      strong_duplicate_score: STRONG_DUPLICATE_SCORE,
    }),
    candidate: args.candidate,
  };
}

async function postJson(args: {
  url: string;
  adminSecret: string;
  body: unknown;
}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": args.adminSecret,
    },
    body: JSON.stringify(args.body),
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_SECRET is not configured" },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as TopupBody;
    const reference = getString(body.reference);
    const lang: Lang = "ru";

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "reference is required" },
        { status: 400 },
      );
    }

    if (body.lang && body.lang !== "ru") {
      return NextResponse.json(
        { ok: false, error: "Only lang=ru is supported now" },
        { status: 400 },
      );
    }

    const incomingCards = Array.isArray(body.cards)
      ? body.cards.map(normalizeV2Card).filter((item): item is V2Card => item !== null)
      : [];

    if (incomingCards.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No cards were sent. Run Pearls v2 first, then click top-up.",
        },
        { status: 400 },
      );
    }

    const targetCount = Math.min(Math.max(getNumber(body.targetCount) ?? 12, 1), 100);
    const processLimit = Math.min(Math.max(getNumber(body.processLimit) ?? 3, 1), 8);
    const force = getBoolean(body.force) ?? false;
    const includeStrongNonPublic = getBoolean(body.includeStrongNonPublic) ?? false;

    const provider = chooseProvider(body.provider, defaultProvider());
    const editorProvider = chooseProvider(body.editorProvider, provider);

    const normalized = normalizeReference(reference);
    const canonicalRef = normalized.canonical_ref ?? reference;

    const existing = await getAngleCards({
      reference,
      lang,
      statuses: ["featured", "reserve"],
      limit: 200,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { ok: false, error: existing.error ?? "Failed to read existing cards" },
        { status: 500 },
      );
    }

    const existingCount = existing.cards.length;

    if (!force && existingCount >= targetCount) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "target_count_already_met",
        changed_database: false,
        reference,
        canonical_ref: canonicalRef,
        existing_count_before: existingCount,
        target_count: targetCount,
        v2_cards_total: incomingCards.length,
        selected_for_old_pipeline: 0,
        processed_count: 0,
        saved_count: 0,
        skipped_count: 0,
        failed_count: 0,
        review_candidate_count: 0,
        review_candidates: [],
        results: [],
      });
    }

    const existingKeys = new Set(
      existing.cards.map((card) => keyOf(card.title, card.anchor)),
    );

    const selectedCards = incomingCards
      .filter((card) => shouldSendToOldPipeline(card, includeStrongNonPublic))
      .filter((card) => !existingKeys.has(keyOf(card.title, card.anchor ?? null)))
      .slice(0, processLimit);

    const verse = await getVerseText(reference, lang, provider);
    const verseText = verse.text.trim();

    if (!verseText) {
      return NextResponse.json(
        { ok: false, error: "Could not load verse text" },
        { status: 500 },
      );
    }

    const origin = new URL(req.url).origin;
    const results = [];
    const reviewCandidates: ReviewCandidate[] = [];

    for (const card of selectedCards) {
      const candidate = makeCandidate(card);
      const processUrl = `${origin}/api/admin/process-angle-candidate`;

      const preview = await postJson({
        url: processUrl,
        adminSecret,
        body: buildProcessBody({
          reference,
          verseText,
          lang,
          provider,
          editorProvider,
          targetCount,
          canonicalRef,
          card,
          candidate,
          previewOnly: true,
        }),
      });

      const previewRecord = isRecord(preview.data) ? preview.data : {};
      const previewScore = getNumber(previewRecord.score_total);
      const previewSkipped = previewRecord.skipped === true;
      const previewSkipReason = getPreviewSkipReason(previewRecord);
      const previewWouldSave = getPreviewWouldSave(previewRecord);
      const previewDuplicateInfo = getPreviewDuplicateInfo(previewRecord);
      const previewDuplicateExistingId =
        previewDuplicateInfo?.matched_card_id ?? getPreviewDuplicateExistingId(previewRecord);
      const oldPipelineStatus = getString(previewRecord.status);
      const forcedStatus = chooseForceStatus(card);
      const evidenceRisk = hasEvidenceRisk(card);
      const lexiconCleared = isLexiconClearedByV2(card);

      if (!preview.ok) {
        results.push({
          candidate_title: candidate.title,
          candidate_score_v2: card.score_total ?? null,
          candidate_public_ready_v2: card.public_ready ?? false,
          candidate_public_status_v2: card.public_status ?? null,
          candidate_lexicon_claim_status_v2: card.lexicon_claim_status ?? null,
          candidate_lexicon_note_v2: card.lexicon_note ?? null,
          ok: false,
          status: preview.status,
          skipped: true,
          skip_reason: "preview_failed",
          saved_id: null,
          saved_ids: [],
          final_score: previewScore,
          preview_score: previewScore,
          preview_skipped: previewSkipped,
          preview_skip_reason: previewSkipReason,
          preview_would_save: previewWouldSave,
          preview_duplicate_existing_id: previewDuplicateExistingId,
          old_pipeline_status: oldPipelineStatus,
          forced_status: forcedStatus,
          has_evidence_risk: evidenceRisk,
          lexicon_cleared_by_v2: lexiconCleared,
          review_candidate: null,
          preview_response: preview.data,
          response: null,
        });
        continue;
      }

      if (previewWouldSave === false || previewSkipped) {
        const reviewCandidate = shouldCreateReviewCandidate({
          duplicateInfo: previewDuplicateInfo,
          previewScore,
          card,
        })
          ? buildReviewCandidate({
              reference,
              canonicalRef,
              card,
              candidate,
              previewScore,
              oldPipelineStatus,
              duplicateInfo: previewDuplicateInfo,
              previewResponse: preview.data,
            })
          : null;

        if (reviewCandidate) reviewCandidates.push(reviewCandidate);

        results.push({
          candidate_title: candidate.title,
          candidate_score_v2: card.score_total ?? null,
          candidate_public_ready_v2: card.public_ready ?? false,
          candidate_public_status_v2: card.public_status ?? null,
          candidate_lexicon_claim_status_v2: card.lexicon_claim_status ?? null,
          candidate_lexicon_note_v2: card.lexicon_note ?? null,
          ok: true,
          status: preview.status,
          skipped: true,
          skip_reason:
            previewSkipReason === "matched_duplicate"
              ? "old_preview_rejected_matched_duplicate"
              : "old_preview_would_not_save",
          saved_id: null,
          saved_ids: [],
          final_score: previewScore,
          preview_score: previewScore,
          preview_skipped: previewSkipped,
          preview_skip_reason: previewSkipReason,
          preview_would_save: previewWouldSave,
          preview_duplicate_existing_id: previewDuplicateExistingId,
          old_pipeline_status: oldPipelineStatus,
          forced_status: forcedStatus,
          has_evidence_risk: evidenceRisk,
          lexicon_cleared_by_v2: lexiconCleared,
          review_candidate: reviewCandidate,
          preview_response: preview.data,
          response: null,
        });
        continue;
      }

      if (typeof previewScore === "number" && previewScore < MIN_OLD_PIPELINE_SAVE_SCORE) {
        results.push({
          candidate_title: candidate.title,
          candidate_score_v2: card.score_total ?? null,
          candidate_public_ready_v2: card.public_ready ?? false,
          candidate_public_status_v2: card.public_status ?? null,
          candidate_lexicon_claim_status_v2: card.lexicon_claim_status ?? null,
          candidate_lexicon_note_v2: card.lexicon_note ?? null,
          ok: true,
          status: preview.status,
          skipped: true,
          skip_reason: "old_preview_score_below_74",
          saved_id: null,
          saved_ids: [],
          final_score: previewScore,
          preview_score: previewScore,
          preview_skipped: previewSkipped,
          preview_skip_reason: previewSkipReason,
          preview_would_save: previewWouldSave,
          preview_duplicate_existing_id: previewDuplicateExistingId,
          old_pipeline_status: oldPipelineStatus,
          forced_status: forcedStatus,
          has_evidence_risk: evidenceRisk,
          lexicon_cleared_by_v2: lexiconCleared,
          review_candidate: null,
          preview_response: preview.data,
          response: null,
        });
        continue;
      }

      const processed = await postJson({
        url: processUrl,
        adminSecret,
        body: buildProcessBody({
          reference,
          verseText,
          lang,
          provider,
          editorProvider,
          targetCount,
          canonicalRef,
          card,
          candidate,
          previewOnly: false,
        }),
      });

      const processedRecord = isRecord(processed.data) ? processed.data : {};

      results.push({
        candidate_title: candidate.title,
        candidate_score_v2: card.score_total ?? null,
        candidate_public_ready_v2: card.public_ready ?? false,
        candidate_public_status_v2: card.public_status ?? null,
        candidate_lexicon_claim_status_v2: card.lexicon_claim_status ?? null,
        candidate_lexicon_note_v2: card.lexicon_note ?? null,
        ok: processed.ok,
        status: processed.status,
        skipped: processedRecord.skipped === true,
        skip_reason: getString(processedRecord.skip_reason),
        saved_id: getString(processedRecord.saved_id),
        saved_ids: Array.isArray(processedRecord.saved_ids)
          ? processedRecord.saved_ids
          : [],
        final_score: getNumber(processedRecord.score_total),
        preview_score: previewScore,
        preview_skipped: previewSkipped,
        preview_skip_reason: previewSkipReason,
        preview_would_save: previewWouldSave,
        preview_duplicate_existing_id: previewDuplicateExistingId,
        old_pipeline_status: getString(processedRecord.status),
        forced_status: forcedStatus,
        has_evidence_risk: evidenceRisk,
        lexicon_cleared_by_v2: lexiconCleared,
        review_candidate: null,
        preview_response: preview.data,
        response: processed.data,
      });
    }

    return NextResponse.json({
      ok: true,
      skipped: false,
      changed_database: results.some((item) => Boolean(item.saved_id)),
      reference,
      canonical_ref: canonicalRef,
      lang,
      existing_count_before: existingCount,
      target_count: targetCount,
      process_limit: processLimit,
      include_strong_non_public: includeStrongNonPublic,

      v2_cards_total: incomingCards.length,
      selected_for_old_pipeline: selectedCards.length,

      processed_count: results.length,
      saved_count: results.filter((item) => Boolean(item.saved_id)).length,
      skipped_count: results.filter((item) => item.skipped).length,
      failed_count: results.filter((item) => !item.ok).length,

      review_candidate_count: reviewCandidates.length,
      review_candidates: reviewCandidates,

      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Pearls v2 top-up failed",
      },
      { status: 500 },
    );
  }
}
