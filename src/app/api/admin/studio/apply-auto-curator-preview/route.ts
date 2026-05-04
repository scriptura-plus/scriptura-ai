import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandidateCard = {
  title?: string;
  anchor?: string | null;
  teaser?: string;
  why_it_matters?: string | null;
};

type PreviewCandidate = {
  candidate?: CandidateCard;
  score_total?: number | null;
  angle_relationship?: string | null;
  relationship_confidence?: string | null;
  matched_card_id?: string | null;
  matched_card_title?: string | null;
  recommended_action?: string | null;
  suggestion_type?: string | null;
  reason?: string | null;
  risk_level?: string | null;
  risk?: string | null;
  source_basis?: string | null;
};

type ApplyAutoCuratorPreviewBody = {
  reference?: string;
  canonical_ref?: string | null;
  book_key?: string | null;
  book?: string | null;
  chapter?: number | null;
  verse?: number | null;
  lang?: string;
  provider?: string | null;
  model?: string | null;
  generator_provider?: string | null;
  generator_model?: string | null;
  candidates?: PreviewCandidate[];
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[APPLY_AUTO_CURATOR_PREVIEW] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeAngleRelationship(value: unknown): string {
  const text = getString(value);

  if (
    text === "duplicate" ||
    text === "stronger_version" ||
    text === "sibling_angle" ||
    text === "distinct_angle" ||
    text === "uncertain"
  ) {
    return text;
  }

  return "uncertain";
}

function normalizeConfidence(value: unknown): string {
  const text = getString(value);

  if (text === "low" || text === "medium" || text === "high") {
    return text;
  }

  return "medium";
}

function normalizeRiskLevel(value: unknown): string {
  const text = getString(value);

  if (text === "low" || text === "medium" || text === "high" || text === "unknown") {
    return text;
  }

  return "unknown";
}

function normalizeSuggestionType(value: unknown): string {
  const text = getString(value);

  if (
    text === "replacement" ||
    text === "needs_review" ||
    text === "locked_card_challenger" ||
    text === "style_review" ||
    text === "promote_candidate" ||
    text === "duplicate_uncertain"
  ) {
    return text;
  }

  return "needs_review";
}

function normalizeScore(value: unknown): number | null {
  const raw = getNumber(value);
  return raw === null ? null : clampInt(raw, 0, 100);
}

function normalizeCandidate(value: PreviewCandidate): {
  candidatePayload: {
    title: string;
    anchor: string | null;
    teaser: string;
    why_it_matters: string | null;
  };
  scoreCandidate: number | null;
  angleRelationship: string;
  relationshipConfidence: string;
  suggestionType: string;
  reason: string;
  risk: string | null;
  riskLevel: string;
  sourceSummary: string | null;
  existingCardId: string | null;
  matchedCardTitle: string | null;
} | null {
  const card = isRecord(value.candidate) ? value.candidate : null;

  const title = getString(card?.title);
  const teaser = getString(card?.teaser);

  if (!title || !teaser) return null;

  const scoreCandidate = normalizeScore(value.score_total);
  const angleRelationship = normalizeAngleRelationship(value.angle_relationship);
  const relationshipConfidence = normalizeConfidence(value.relationship_confidence);

  return {
    candidatePayload: {
      title,
      anchor: getString(card?.anchor),
      teaser,
      why_it_matters: getString(card?.why_it_matters),
    },
    scoreCandidate,
    angleRelationship,
    relationshipConfidence,
    suggestionType: normalizeSuggestionType(value.suggestion_type),
    reason:
      getString(value.reason) ??
      "Auto Curator recommended editor review for this candidate.",
    risk: getString(value.risk),
    riskLevel: normalizeRiskLevel(value.risk_level),
    sourceSummary: getString(value.source_basis),
    existingCardId: getString(value.matched_card_id),
    matchedCardTitle: getString(value.matched_card_title),
  };
}

function getSuggestionTypeForRelationship(args: {
  angleRelationship: string;
  existingCardId: string | null;
  suggestionType: string;
}): string {
  if (args.suggestionType && args.suggestionType !== "needs_review") {
    return args.suggestionType;
  }

  if (args.existingCardId && args.angleRelationship === "stronger_version") {
    return "replacement";
  }

  if (args.angleRelationship === "duplicate" || args.angleRelationship === "uncertain") {
    return "duplicate_uncertain";
  }

  return "needs_review";
}

async function getExistingCardScore(args: {
  client: ReturnType<typeof createAdminClient>;
  existingCardId: string | null;
}): Promise<number | null> {
  if (!args.client || !args.existingCardId) return null;

  const { data, error } = await args.client
    .from("angle_cards")
    .select("score_total")
    .eq("id", args.existingCardId)
    .maybeSingle();

  if (error) {
    console.error("[APPLY_AUTO_CURATOR_PREVIEW] existing card score read error", {
      cardId: args.existingCardId,
      message: error.message,
    });
    return null;
  }

  if (!data || !isRecord(data)) return null;

  return normalizeScore(data.score_total);
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = createAdminClient();

  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  let body: ApplyAutoCuratorPreviewBody = {};

  try {
    body = (await req.json()) as ApplyAutoCuratorPreviewBody;
  } catch {
    body = {};
  }

  const reference = getString(body.reference);
  const canonicalRef = getString(body.canonical_ref);
  const lang = getString(body.lang) ?? "ru";
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];

  if (!reference && !canonicalRef) {
    return NextResponse.json(
      { ok: false, error: "Missing reference or canonical_ref" },
      { status: 400 },
    );
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No preview candidates provided" },
      { status: 400 },
    );
  }

  const effectiveReference = reference ?? canonicalRef ?? "";
  const now = new Date().toISOString();

  const insertedSuggestions: unknown[] = [];
  const skipped: Array<{
    index: number;
    reason: string;
    title?: string | null;
    recommended_action?: string | null;
  }> = [];
  const errors: Array<{ index: number; title?: string | null; error: string }> = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const previewCandidate = candidates[index];

    if (previewCandidate.recommended_action !== "editorial_suggestion") {
      skipped.push({
        index,
        reason: "Only editorial_suggestion is applied in this safe first version.",
        title: getString(previewCandidate.candidate?.title),
        recommended_action: getString(previewCandidate.recommended_action),
      });
      continue;
    }

    const normalized = normalizeCandidate(previewCandidate);

    if (!normalized) {
      skipped.push({
        index,
        reason: "Candidate is missing title or teaser.",
        title: getString(previewCandidate.candidate?.title),
        recommended_action: getString(previewCandidate.recommended_action),
      });
      continue;
    }

    const scoreExisting = await getExistingCardScore({
      client,
      existingCardId: normalized.existingCardId,
    });

    const scoreCandidate = normalized.scoreCandidate;
    const scoreDelta =
      typeof scoreExisting === "number" && typeof scoreCandidate === "number"
        ? scoreCandidate - scoreExisting
        : null;

    const suggestionType = getSuggestionTypeForRelationship({
      angleRelationship: normalized.angleRelationship,
      existingCardId: normalized.existingCardId,
      suggestionType: normalized.suggestionType,
    });

    const payload = {
      reference: effectiveReference,
      canonical_ref: canonicalRef ?? reference,
      book_key: getString(body.book_key),
      book: getString(body.book),
      chapter: getNumber(body.chapter),
      verse: getNumber(body.verse),
      lang,

      suggestion_type: suggestionType,
      status: "pending",

      existing_card_id: normalized.existingCardId,
      candidate_card_id: null,
      candidate_payload: {
        ...normalized.candidatePayload,
        auto_curator_preview: {
          matched_card_title: normalized.matchedCardTitle,
          recommended_action: previewCandidate.recommended_action,
          source_basis: normalized.sourceSummary,
        },
      },

      score_existing: scoreExisting,
      score_candidate: scoreCandidate,
      score_delta: scoreDelta,

      angle_relationship: normalized.angleRelationship,
      relationship_confidence: normalized.relationshipConfidence,
      same_angle_summary:
        normalized.matchedCardTitle && normalized.angleRelationship === "stronger_version"
          ? `Кандидат выглядит как более сильная версия существующей карточки: ${normalized.matchedCardTitle}.`
          : normalized.angleRelationship,

      reason: normalized.reason,
      risk: normalized.risk,
      risk_level: normalized.riskLevel,
      source_summary: normalized.sourceSummary,

      source_id: null,
      note_id: null,

      provider: getString(body.generator_provider) ?? getString(body.provider) ?? "claude",
      model: getString(body.generator_model) ?? getString(body.model) ?? "claude-sonnet-4-6",
      evaluator_version: "auto_curator_preview_v1",
      decision_engine_version: "apply_preview_editorial_only_v1",

      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
      moderator_decision: null,

      created_at: now,
      updated_at: now,
    };

    const { data, error } = await client
      .from("editorial_suggestions")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("[APPLY_AUTO_CURATOR_PREVIEW] insert editorial suggestion error", {
        index,
        title: normalized.candidatePayload.title,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      errors.push({
        index,
        title: normalized.candidatePayload.title,
        error: error.message || "Failed to insert editorial suggestion",
      });
      continue;
    }

    insertedSuggestions.push(data);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    mode: "editorial_suggestion_only",
    reference: effectiveReference,
    canonical_ref: canonicalRef,
    lang,
    inserted_count: insertedSuggestions.length,
    skipped_count: skipped.length,
    error_count: errors.length,
    inserted_suggestions: insertedSuggestions,
    skipped,
    errors,
  }, { status: errors.length === 0 ? 200 : 207 });
}
