import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutoModeratorReportBody = {
  reference?: string;
  canonical_ref?: string | null;
  lang?: string;
  maxCards?: number;
};

type StudioCard = {
  id: string;
  reference: string | null;
  canonical_ref: string | null;
  lang: string | null;
  title: string | null;
  anchor: string | null;
  teaser: string | null;
  why_it_matters: string | null;
  status: string | null;
  score_total: number | null;
  moderator_boost: number | null;
  moderator_note: string | null;
  is_locked: boolean | null;
  angle_summary: string | null;
  coverage_type: string | null;
  source_type: string | null;
  source_provider: string | null;
  source_model: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ReportFindingType =
  | "duplicate_cluster"
  | "overclaim_risk"
  | "weak_active"
  | "strong_reserve"
  | "diversity_issue"
  | "locked_card_note"
  | "healthy_set"
  | "needs_human_review"
  | "other";

type ReportRecommendationAction =
  | "keep"
  | "move_to_reserve"
  | "promote_to_active"
  | "hide"
  | "lock"
  | "add_note"
  | "rewrite"
  | "create_editorial_suggestion"
  | "no_action";

type ReportFinding = {
  finding_type: ReportFindingType;
  title: string;
  severity: "low" | "medium" | "high";
  primary_card_id: string | null;
  related_card_ids: string[];
  recommended_action: ReportRecommendationAction;
  reason: string;
  suggested_note: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  angle_relationship:
    | "duplicate"
    | "stronger_version"
    | "sibling_angle"
    | "distinct_angle"
    | "uncertain";
  score_total: number | null;
};

type AutoModeratorReport = {
  health_score: number;
  summary: string;
  set_status: "healthy" | "mostly_healthy" | "needs_cleanup" | "risky";
  active_count: number;
  reserve_count: number;
  hidden_count: number;
  rejected_count: number;
  findings: ReportFinding[];
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[AUTO_MODERATOR_REPORT] ADMIN_SECRET is not configured");
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

function getBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
}

function extractOpenAIResponseText(value: unknown): string {
  if (!isRecord(value)) return "";

  const direct = getString(value.output_text);
  if (direct) return direct;

  const output = Array.isArray(value.output) ? value.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    if (!isRecord(item)) continue;
    const content = Array.isArray(item.content) ? item.content : [];

    for (const part of content) {
      if (!isRecord(part)) continue;
      const text = getString(part.text);
      if (text) chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();

  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(fenced);
  } catch {
    // continue
  }

  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(fenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function compactCard(row: unknown): StudioCard | null {
  if (!isRecord(row)) return null;

  const id = getString(row.id);
  if (!id) return null;

  return {
    id,
    reference: getString(row.reference),
    canonical_ref: getString(row.canonical_ref),
    lang: getString(row.lang),
    title: getString(row.title),
    anchor: getString(row.anchor),
    teaser: getString(row.teaser),
    why_it_matters: getString(row.why_it_matters),
    status: getString(row.status),
    score_total: getNumber(row.score_total),
    moderator_boost: getNumber(row.moderator_boost),
    moderator_note: getString(row.moderator_note),
    is_locked: getBoolean(row.is_locked),
    angle_summary: getString(row.angle_summary),
    coverage_type: getString(row.coverage_type),
    source_type: getString(row.source_type),
    source_provider: getString(row.source_provider),
    source_model: getString(row.source_model),
    created_at: getString(row.created_at),
    updated_at: getString(row.updated_at),
  };
}

function normalizeFindingType(value: unknown): ReportFindingType {
  const text = getString(value);

  if (
    text === "duplicate_cluster" ||
    text === "overclaim_risk" ||
    text === "weak_active" ||
    text === "strong_reserve" ||
    text === "diversity_issue" ||
    text === "locked_card_note" ||
    text === "healthy_set" ||
    text === "needs_human_review" ||
    text === "other"
  ) {
    return text;
  }

  return "other";
}

function normalizeSeverity(value: unknown): ReportFinding["severity"] {
  const text = getString(value);
  if (text === "low" || text === "medium" || text === "high") return text;
  return "medium";
}

function normalizeRecommendationAction(value: unknown): ReportRecommendationAction {
  const text = getString(value);

  if (
    text === "keep" ||
    text === "move_to_reserve" ||
    text === "promote_to_active" ||
    text === "hide" ||
    text === "lock" ||
    text === "add_note" ||
    text === "rewrite" ||
    text === "create_editorial_suggestion" ||
    text === "no_action"
  ) {
    return text;
  }

  return "no_action";
}

function normalizeRiskLevel(value: unknown): ReportFinding["risk_level"] {
  const text = getString(value);
  if (text === "low" || text === "medium" || text === "high" || text === "unknown") return text;
  return "unknown";
}

function normalizeAngleRelationship(value: unknown): ReportFinding["angle_relationship"] {
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

function normalizeSetStatus(value: unknown): AutoModeratorReport["set_status"] {
  const text = getString(value);

  if (
    text === "healthy" ||
    text === "mostly_healthy" ||
    text === "needs_cleanup" ||
    text === "risky"
  ) {
    return text;
  }

  return "mostly_healthy";
}

function normalizeReport(value: unknown, fallbackCounts: {
  active: number;
  reserve: number;
  hidden: number;
  rejected: number;
}): AutoModeratorReport {
  if (!isRecord(value)) {
    return {
      health_score: 70,
      summary: "GPT-5.5 did not return a valid report object.",
      set_status: "mostly_healthy",
      active_count: fallbackCounts.active,
      reserve_count: fallbackCounts.reserve,
      hidden_count: fallbackCounts.hidden,
      rejected_count: fallbackCounts.rejected,
      findings: [],
    };
  }

  const rawFindings = Array.isArray(value.findings) ? value.findings : [];
  const findings = rawFindings
    .map((item) => {
      if (!isRecord(item)) return null;

      const title = getString(item.title);
      const reason = getString(item.reason);

      if (!title || !reason) return null;

      const relatedIds = Array.isArray(item.related_card_ids)
        ? item.related_card_ids
            .map((id) => getString(id))
            .filter((id): id is string => id !== null)
        : [];

      const rawScore = getNumber(item.score_total);

      return {
        finding_type: normalizeFindingType(item.finding_type),
        title,
        severity: normalizeSeverity(item.severity),
        primary_card_id: getString(item.primary_card_id),
        related_card_ids: relatedIds,
        recommended_action: normalizeRecommendationAction(item.recommended_action),
        reason,
        suggested_note: getString(item.suggested_note),
        risk_level: normalizeRiskLevel(item.risk_level),
        angle_relationship: normalizeAngleRelationship(item.angle_relationship),
        score_total: rawScore === null ? null : clampInt(rawScore, 0, 100),
      };
    })
    .filter((item): item is ReportFinding => item !== null);

  const rawHealth = getNumber(value.health_score);

  return {
    health_score: rawHealth === null ? 70 : clampInt(rawHealth, 0, 100),
    summary: getString(value.summary) ?? "Auto Moderator Report completed.",
    set_status: normalizeSetStatus(value.set_status),
    active_count: getNumber(value.active_count) ?? fallbackCounts.active,
    reserve_count: getNumber(value.reserve_count) ?? fallbackCounts.reserve,
    hidden_count: getNumber(value.hidden_count) ?? fallbackCounts.hidden,
    rejected_count: getNumber(value.rejected_count) ?? fallbackCounts.rejected,
    findings,
  };
}

function getOutputLanguageInstruction(lang: string): string {
  if (lang === "ru") return "Write all human-readable report fields in Russian.";
  if (lang === "es") return "Write all human-readable report fields in Spanish.";
  return "Write all human-readable report fields in English.";
}

function buildReportPrompt(args: {
  reference: string;
  canonicalRef: string | null;
  lang: string;
  cards: StudioCard[];
}): string {
  const activeCards = args.cards.filter((card) => card.status === "featured");
  const reserveCards = args.cards.filter((card) => card.status === "reserve");
  const hiddenCards = args.cards.filter((card) => card.status === "hidden");
  const rejectedCards = args.cards.filter((card) => card.status === "rejected");

  return `
You are GPT-5.5 acting as Auto Moderator Report for Scriptura AI Studio.

You are not generating new cards.
You are reviewing the current card set for one Bible verse, like a careful human editor.

Product goal:
A strong Scriptura card should make a serious Bible reader think:
"Wow — I have read this verse before, but I never noticed THAT."

Output language:
${getOutputLanguageInstruction(args.lang)}

Your job:
1. Review active and reserve cards.
2. Identify likely duplicate angles.
3. Identify overclaim / unsupported original-language risk.
4. Identify weak active cards.
5. Identify reserve cards that may deserve promotion.
6. Identify diversity issues, e.g. too many cards on same mechanism.
7. Respect human editorial context:
   - is_locked = true means do not recommend replacement unless risk is serious.
   - moderator_note is human editorial memory and must be considered.
8. Produce a report only. Do not apply database changes.

Important:
- Be conservative with action recommendations.
- Do not create work for the moderator unless useful.
- If the set is healthy, say so.
- Prefer no_action / keep when no intervention is needed.
- Recommendations are advisory. They will be stored in audit log.

Allowed finding_type:
duplicate_cluster
overclaim_risk
weak_active
strong_reserve
diversity_issue
locked_card_note
healthy_set
needs_human_review
other

Allowed recommended_action:
keep
move_to_reserve
promote_to_active
hide
lock
add_note
rewrite
create_editorial_suggestion
no_action

Allowed risk_level:
low
medium
high
unknown

Allowed angle_relationship:
duplicate
stronger_version
sibling_angle
distinct_angle
uncertain

Return ONLY valid JSON:
{
  "health_score": 0,
  "set_status": "healthy | mostly_healthy | needs_cleanup | risky",
  "summary": "short editorial summary",
  "active_count": ${activeCards.length},
  "reserve_count": ${reserveCards.length},
  "hidden_count": ${hiddenCards.length},
  "rejected_count": ${rejectedCards.length},
  "findings": [
    {
      "finding_type": "duplicate_cluster",
      "title": "short title",
      "severity": "low | medium | high",
      "primary_card_id": "uuid or null",
      "related_card_ids": ["uuid"],
      "recommended_action": "move_to_reserve",
      "reason": "why this matters editorially",
      "suggested_note": "optional moderator note or null",
      "risk_level": "low | medium | high | unknown",
      "angle_relationship": "duplicate | stronger_version | sibling_angle | distinct_angle | uncertain",
      "score_total": 0
    }
  ]
}

Verse:
reference: ${args.reference}
canonical_ref: ${args.canonicalRef ?? "null"}
lang: ${args.lang}

Cards to review:
${JSON.stringify(args.cards, null, 2)}
`.trim();
}

async function callOpenAI(args: {
  prompt: string;
  model: string;
}): Promise<{ rawText: string; rawJson: unknown; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: args.prompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const json = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      isRecord(json) && isRecord(json.error)
        ? getString(json.error.message)
        : null;

    throw new Error(message ?? `OpenAI request failed with status ${response.status}`);
  }

  const rawText = extractOpenAIResponseText(json);
  const rawJson = extractJsonObject(rawText);

  return { rawText, rawJson, model: args.model };
}

async function createRun(args: {
  client: ReturnType<typeof createAdminClient>;
  reference: string;
  canonicalRef: string | null;
  lang: string;
  existingCardCount: number;
  evaluatorModel: string;
}): Promise<string | null> {
  if (!args.client) return null;

  const { data, error } = await args.client
    .from("curator_runs")
    .insert({
      reference: args.reference,
      canonical_ref: args.canonicalRef ?? args.reference,
      lang: args.lang,
      source_mode: "moderator_report",
      run_type: "auto_moderator_report",
      mode: "report",
      status: "started",
      evaluator_provider: "openai",
      evaluator_model: args.evaluatorModel,
      existing_card_count: args.existingCardCount,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[AUTO_MODERATOR_REPORT] curator_runs insert failed", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  return isRecord(data) ? getString(data.id) : null;
}

async function updateRun(args: {
  client: ReturnType<typeof createAdminClient>;
  runId: string | null;
  status: "completed" | "failed" | "partial";
  report: AutoModeratorReport | null;
  rawEvaluation?: string | null;
  error?: string | null;
}) {
  if (!args.client || !args.runId) return;

  const { error } = await args.client
    .from("curator_runs")
    .update({
      status: args.status,
      evaluated_count: args.report?.findings.length ?? 0,
      editorial_suggestion_count:
        args.report?.findings.filter(
          (finding) => finding.recommended_action === "create_editorial_suggestion",
        ).length ?? 0,
      applied_count: args.report?.findings.length ?? 0,
      error_count: args.error ? 1 : 0,
      summary: args.report?.summary ?? null,
      raw_evaluation: args.rawEvaluation ? truncate(args.rawEvaluation, 12000) : null,
      metadata: args.report
        ? {
            health_score: args.report.health_score,
            set_status: args.report.set_status,
            active_count: args.report.active_count,
            reserve_count: args.report.reserve_count,
            hidden_count: args.report.hidden_count,
            rejected_count: args.report.rejected_count,
          }
        : {},
      error: args.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.runId);

  if (error) {
    console.error("[AUTO_MODERATOR_REPORT] curator_runs update failed", {
      runId: args.runId,
      message: error.message,
    });
  }
}

async function insertFindingDecision(args: {
  client: ReturnType<typeof createAdminClient>;
  runId: string | null;
  reference: string;
  canonicalRef: string | null;
  lang: string;
  finding: ReportFinding;
}): Promise<string | null> {
  if (!args.client || !args.runId) return null;

  const { data, error } = await args.client
    .from("curator_decisions")
    .insert({
      run_id: args.runId,
      reference: args.reference,
      canonical_ref: args.canonicalRef ?? args.reference,
      lang: args.lang,

      candidate_payload: {
        report_finding: true,
        finding_type: args.finding.finding_type,
        title: args.finding.title,
        primary_card_id: args.finding.primary_card_id,
        related_card_ids: args.finding.related_card_ids,
        recommended_editorial_action: args.finding.recommended_action,
        suggested_note: args.finding.suggested_note,
      },

      score_total: args.finding.score_total,
      scores: {
        severity:
          args.finding.severity === "high"
            ? 10
            : args.finding.severity === "medium"
              ? 6
              : 3,
      },
      coverage_type: args.finding.finding_type,
      angle_summary: args.finding.title,

      risk_level: args.finding.risk_level,
      risk: args.finding.suggested_note,

      angle_relationship: args.finding.angle_relationship,
      relationship_confidence:
        args.finding.severity === "high"
          ? "high"
          : args.finding.severity === "low"
            ? "low"
            : "medium",
      matched_card_id: args.finding.primary_card_id,
      matched_card_title: null,

      recommended_action: "report_only",
      applied_action: "report_only",
      suggestion_type:
        args.finding.finding_type === "overclaim_risk"
          ? "overclaim_review"
          : args.finding.finding_type === "duplicate_cluster"
            ? "duplicate_uncertain"
            : args.finding.finding_type === "needs_human_review"
              ? "needs_review"
              : null,

      existing_card_id: args.finding.primary_card_id,
      inserted_card_id: null,
      inserted_suggestion_id: null,

      source_basis: "Auto Moderator Report",
      reason: args.finding.reason,
      decision_reason: `Report recommendation: ${args.finding.recommended_action}`,
      error: null,
      metadata: {
        severity: args.finding.severity,
        finding_type: args.finding.finding_type,
        related_card_ids: args.finding.related_card_ids,
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[AUTO_MODERATOR_REPORT] curator_decisions insert failed", {
      title: args.finding.title,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  return isRecord(data) ? getString(data.id) : null;
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

  let body: AutoModeratorReportBody = {};

  try {
    body = (await req.json()) as AutoModeratorReportBody;
  } catch {
    body = {};
  }

  const reference = getString(body.reference);
  const canonicalRef = getString(body.canonical_ref);
  const lang = getString(body.lang) ?? "ru";
  const effectiveReference = reference ?? canonicalRef ?? "";
  const maxCards = clampInt(body.maxCards ?? 80, 12, 120);
  const evaluatorModel = process.env.OPENAI_EVALUATOR_MODEL ?? "gpt-5.5";

  if (!reference && !canonicalRef) {
    return NextResponse.json(
      { ok: false, error: "Missing reference or canonical_ref" },
      { status: 400 },
    );
  }

  let runId: string | null = null;

  try {
    let cardsQuery = client
      .from("angle_cards")
      .select("*")
      .eq("lang", lang)
      .in("status", ["featured", "reserve", "hidden", "rejected"])
      .order("score_total", { ascending: false, nullsFirst: false })
      .limit(maxCards);

    if (canonicalRef) {
      cardsQuery = cardsQuery.eq("canonical_ref", canonicalRef);
    } else if (reference) {
      cardsQuery = cardsQuery.eq("reference", reference);
    }

    const cardsResult = await cardsQuery;

    if (cardsResult.error) {
      throw new Error(`angle_cards read failed: ${cardsResult.error.message}`);
    }

    const cards = ((cardsResult.data ?? []) as unknown[])
      .map(compactCard)
      .filter((card): card is StudioCard => card !== null);

    const fallbackCounts = {
      active: cards.filter((card) => card.status === "featured").length,
      reserve: cards.filter((card) => card.status === "reserve").length,
      hidden: cards.filter((card) => card.status === "hidden").length,
      rejected: cards.filter((card) => card.status === "rejected").length,
    };

    runId = await createRun({
      client,
      reference: effectiveReference,
      canonicalRef,
      lang,
      existingCardCount: cards.length,
      evaluatorModel,
    });

    if (cards.length === 0) {
      const emptyReport: AutoModeratorReport = {
        health_score: 0,
        set_status: "needs_cleanup",
        summary: "По этому стиху нет карточек для проверки набора.",
        active_count: 0,
        reserve_count: 0,
        hidden_count: 0,
        rejected_count: 0,
        findings: [],
      };

      await updateRun({ client, runId, status: "completed", report: emptyReport });

      return NextResponse.json({
        ok: true,
        mode: "report",
        run_id: runId,
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        evaluator_provider: "openai",
        evaluator_model: evaluatorModel,
        report: emptyReport,
      });
    }

    const prompt = buildReportPrompt({
      reference: effectiveReference,
      canonicalRef,
      lang,
      cards,
    });

    const ai = await callOpenAI({ prompt, model: evaluatorModel });
    const report = normalizeReport(ai.rawJson, fallbackCounts);

    const decisions: Array<ReportFinding & { audit_decision_id: string | null }> = [];

    for (const finding of report.findings) {
      const auditDecisionId = await insertFindingDecision({
        client,
        runId,
        reference: effectiveReference,
        canonicalRef,
        lang,
        finding,
      });

      decisions.push({ ...finding, audit_decision_id: auditDecisionId });
    }

    await updateRun({
      client,
      runId,
      status: "completed",
      report,
      rawEvaluation: ai.rawText,
    });

    return NextResponse.json({
      ok: true,
      mode: "report",
      run_id: runId,
      reference: effectiveReference,
      canonical_ref: canonicalRef,
      lang,
      evaluator_provider: "openai",
      evaluator_model: evaluatorModel,
      existing_card_count: cards.length,
      report: { ...report, findings: decisions },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto Moderator Report failed.";

    await updateRun({ client, runId, status: "failed", report: null, error: message });

    console.error("[AUTO_MODERATOR_REPORT] error", {
      reference,
      canonicalRef,
      lang,
      message,
    });

    return NextResponse.json(
      { ok: false, run_id: runId, error: message },
      { status: 500 },
    );
  }
}
