import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutoModeratorReportBody = {
  reference?: string;
  canonical_ref?: string | null;
  book_key?: string | null;
  book?: string | null;
  chapter?: number | null;
  verse?: number | null;
  lang?: string;
  maxCards?: number;
  apply?: boolean;
};

type StudioCard = {
  id: string;
  reference: string | null;
  canonical_ref: string | null;
  book_key: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
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

type AutomationClass =
  | "audit_only"
  | "create_editorial_suggestion"
  | "human_required"
  | "auto_apply_safe";

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
  | "rewrite_with_claude"
  | "create_editorial_suggestion"
  | "no_action";

type ReportFinding = {
  finding_type: ReportFindingType;
  title: string;
  severity: "low" | "medium" | "high";
  primary_card_id: string | null;
  related_card_ids: string[];
  recommended_action: ReportRecommendationAction;
  automation_class: AutomationClass;
  reason: string;
  suggested_note: string | null;
  human_question: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  angle_relationship:
    | "duplicate"
    | "stronger_version"
    | "sibling_angle"
    | "distinct_angle"
    | "uncertain";
  score_total: number | null;
};

type ReportFindingWithPersistence = ReportFinding & {
  audit_decision_id: string | null;
  inserted_suggestion_id: string | null;
  applied_action: string | null;
  error: string | null;
};

type AutoModeratorReport = {
  health_score: number;
  summary: string;
  moderator_brief: string;
  set_status: "healthy" | "mostly_healthy" | "needs_cleanup" | "risky";
  active_count: number;
  reserve_count: number;
  hidden_count: number;
  rejected_count: number;
  audit_only_count: number;
  create_editorial_suggestion_count: number;
  human_required_count: number;
  auto_apply_safe_count: number;
  findings: ReportFinding[];
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[AUTO_MODERATOR_ENGINE] ADMIN_SECRET is not configured");
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
    book_key: getString(row.book_key),
    book: getString(row.book),
    chapter: getNumber(row.chapter),
    verse: getNumber(row.verse),
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
    text === "rewrite_with_claude" ||
    text === "create_editorial_suggestion" ||
    text === "no_action"
  ) {
    return text;
  }

  if (text === "rewrite") return "rewrite_with_claude";

  return "no_action";
}

function normalizeAutomationClass(value: unknown): AutomationClass {
  const text = getString(value);

  if (
    text === "audit_only" ||
    text === "create_editorial_suggestion" ||
    text === "human_required" ||
    text === "auto_apply_safe"
  ) {
    return text;
  }

  return "audit_only";
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

function normalizeReport(
  value: unknown,
  fallbackCounts: {
    active: number;
    reserve: number;
    hidden: number;
    rejected: number;
  },
): AutoModeratorReport {
  if (!isRecord(value)) {
    return {
      health_score: 70,
      summary: "GPT-5.5 did not return a valid report object.",
      moderator_brief: "Отчёт не распознан. Нужна техническая проверка.",
      set_status: "mostly_healthy",
      active_count: fallbackCounts.active,
      reserve_count: fallbackCounts.reserve,
      hidden_count: fallbackCounts.hidden,
      rejected_count: fallbackCounts.rejected,
      audit_only_count: 0,
      create_editorial_suggestion_count: 0,
      human_required_count: 0,
      auto_apply_safe_count: 0,
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
        automation_class: normalizeAutomationClass(item.automation_class),
        reason,
        suggested_note: getString(item.suggested_note),
        human_question: getString(item.human_question),
        risk_level: normalizeRiskLevel(item.risk_level),
        angle_relationship: normalizeAngleRelationship(item.angle_relationship),
        score_total: rawScore === null ? null : clampInt(rawScore, 0, 100),
      };
    })
    .filter((item): item is ReportFinding => item !== null);

  const auditOnlyCount = findings.filter((f) => f.automation_class === "audit_only").length;
  const suggestionCount = findings.filter(
    (f) => f.automation_class === "create_editorial_suggestion",
  ).length;
  const humanRequiredCount = findings.filter(
    (f) => f.automation_class === "human_required",
  ).length;
  const autoApplySafeCount = findings.filter(
    (f) => f.automation_class === "auto_apply_safe",
  ).length;

  const rawHealth = getNumber(value.health_score);

  return {
    health_score: rawHealth === null ? 70 : clampInt(rawHealth, 0, 100),
    summary: getString(value.summary) ?? "Auto Moderator Engine completed.",
    moderator_brief:
      getString(value.moderator_brief) ??
      `Автомодератор обработал набор: audit ${auditOnlyCount}, queue ${suggestionCount}, human ${humanRequiredCount}.`,
    set_status: normalizeSetStatus(value.set_status),
    active_count: getNumber(value.active_count) ?? fallbackCounts.active,
    reserve_count: getNumber(value.reserve_count) ?? fallbackCounts.reserve,
    hidden_count: getNumber(value.hidden_count) ?? fallbackCounts.hidden,
    rejected_count: getNumber(value.rejected_count) ?? fallbackCounts.rejected,
    audit_only_count: auditOnlyCount,
    create_editorial_suggestion_count: suggestionCount,
    human_required_count: humanRequiredCount,
    auto_apply_safe_count: autoApplySafeCount,
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

  return `
You are GPT-5.5 acting as Auto Moderator Engine for Scriptura AI Studio.

You are not generating or rewriting cards.
Claude writes and rewrites cards.
Your job is evaluation, risk checking, same-angle judgment, routing, and audit explanation.

Product goal:
A strong Scriptura card should make a serious Bible reader think:
"Wow — I have read this verse before, but I never noticed THAT."

Output language:
${getOutputLanguageInstruction(args.lang)}

You are reviewing the current card set for one Bible verse.

The final UX goal:
The human moderator should NOT read a long report.
The human moderator should see only exceptions:
- "replace this?"
- "move this to reserve?"
- "risk here?"
- "locked card challenge?"
- "uncertain duplicate?"

Therefore every finding must be routed into an automation_class.

Automation classes:

1. audit_only
Use when the finding is useful context but should not bother the human.
Examples:
- healthy set note
- mild diversity observation
- locked card note already handled by existing moderator_note
- no action needed

2. create_editorial_suggestion
Use when the system can create a concrete queue item for the moderator.
Examples:
- active card has medium overclaim risk and should be softened later
- two active cards are close and one may move to reserve
- reserve card might be promoted
- card should be rewritten by Claude with constraints
- possible replacement but not safe to auto-apply

3. human_required
Use only for sensitive/uncertain cases that need human taste or responsibility.
Examples:
- locked card may need replacement
- high-impact active card has serious risk
- unclear whether a strong card is duplicate or distinct
- conflicting recommendations

4. auto_apply_safe
Use only for non-destructive safe actions.
For now, do NOT recommend destructive changes like hide active / replace active / move active automatically.
Safe actions may include:
- no public change, only audit
- obvious duplicate reserve can stay reserve and be logged
- safe suggestion to keep, lock, or note, but the code will not directly mutate cards yet

Important:
- Be strict. Do not produce 10 human tasks if only 2 matter.
- Do not make the moderator read everything.
- If a finding does not need a human decision, mark audit_only.
- If a finding needs a future rewrite, route it to create_editorial_suggestion and make clear Claude should rewrite, not GPT.
- Respect human editorial context:
  - is_locked = true means do not propose replacement unless risk is serious.
  - moderator_note is human editorial memory and must be considered.
- Prefer fewer findings.
- Maximum useful findings: 6.
- If the set is mostly healthy, say so and route most observations as audit_only.

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
rewrite_with_claude
create_editorial_suggestion
no_action

Allowed automation_class:
audit_only
create_editorial_suggestion
human_required
auto_apply_safe

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
  "summary": "short audit summary",
  "moderator_brief": "what the human actually needs to know in 1-2 sentences",
  "active_count": ${activeCards.length},
  "reserve_count": ${reserveCards.length},
  "hidden_count": 0,
  "rejected_count": 0,
  "findings": [
    {
      "finding_type": "overclaim_risk",
      "title": "short title",
      "severity": "low | medium | high",
      "primary_card_id": "uuid or null",
      "related_card_ids": ["uuid"],
      "recommended_action": "rewrite_with_claude",
      "automation_class": "create_editorial_suggestion",
      "reason": "why this matters editorially",
      "suggested_note": "exact editorial instruction for Claude or null",
      "human_question": "short question for moderator, or null",
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

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

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

  return {
    rawText,
    rawJson,
    model: args.model,
  };
}

async function createRun(args: {
  client: ReturnType<typeof createAdminClient>;
  reference: string;
  canonicalRef: string | null;
  lang: string;
  existingCardCount: number;
  evaluatorModel: string;
  mode: "report" | "apply";
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
      mode: args.mode,
      status: "started",
      generator_provider: null,
      generator_model: null,
      evaluator_provider: "openai",
      evaluator_model: args.evaluatorModel,
      existing_card_count: args.existingCardCount,
      started_at: new Date().toISOString(),
      metadata: {
        engine_version: "auto_moderator_engine_v2",
        model_roles: {
          claude: "generation_and_rewrite",
          gpt_5_5: "evaluation_risk_routing_audit",
        },
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[AUTO_MODERATOR_ENGINE] curator_runs insert failed", {
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
  insertedSuggestionsCount?: number;
  errorCount?: number;
}) {
  if (!args.client || !args.runId) return;

  const { error } = await args.client
    .from("curator_runs")
    .update({
      status: args.status,
      evaluated_count: args.report?.findings.length ?? 0,
      editorial_suggestion_count:
        args.insertedSuggestionsCount ??
        args.report?.findings.filter(
          (finding) =>
            finding.automation_class === "create_editorial_suggestion" ||
            finding.automation_class === "human_required",
        ).length ??
        0,
      auto_reject_count: 0,
      applied_count: args.report?.findings.length ?? 0,
      error_count: args.errorCount ?? (args.error ? 1 : 0),
      summary: args.report?.moderator_brief ?? args.report?.summary ?? null,
      raw_evaluation: args.rawEvaluation ? truncate(args.rawEvaluation, 12000) : null,
      metadata: args.report
        ? {
            engine_version: "auto_moderator_engine_v2",
            health_score: args.report.health_score,
            set_status: args.report.set_status,
            active_count: args.report.active_count,
            reserve_count: args.report.reserve_count,
            hidden_count: args.report.hidden_count,
            rejected_count: args.report.rejected_count,
            audit_only_count: args.report.audit_only_count,
            create_editorial_suggestion_count: args.report.create_editorial_suggestion_count,
            human_required_count: args.report.human_required_count,
            auto_apply_safe_count: args.report.auto_apply_safe_count,
          }
        : {},
      error: args.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.runId);

  if (error) {
    console.error("[AUTO_MODERATOR_ENGINE] curator_runs update failed", {
      runId: args.runId,
      message: error.message,
    });
  }
}

function findingSuggestionType(finding: ReportFinding): string | null {
  if (finding.finding_type === "duplicate_cluster") return "duplicate_uncertain";
  if (finding.finding_type === "overclaim_risk") return "overclaim_review";
  if (finding.finding_type === "strong_reserve") return "promote_candidate";
  if (finding.finding_type === "weak_active") return "needs_review";
  if (finding.recommended_action === "rewrite_with_claude") return "needs_review";
  if (finding.automation_class === "human_required") return "needs_review";
  return "needs_review";
}

async function insertEditorialSuggestionFromFinding(args: {
  client: ReturnType<typeof createAdminClient>;
  reference: string;
  canonicalRef: string | null;
  bookKey: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lang: string;
  finding: ReportFinding;
  evaluatorModel: string;
  now: string;
}): Promise<{ id: string | null; error: string | null }> {
  if (!args.client) return { id: null, error: "Supabase admin client missing" };

  const candidatePayload = {
    title: args.finding.title,
    teaser: args.finding.reason,
    anchor: null,
    why_it_matters: args.finding.human_question,
    auto_moderator: {
      engine_version: "auto_moderator_engine_v2",
      finding_type: args.finding.finding_type,
      recommended_action: args.finding.recommended_action,
      automation_class: args.finding.automation_class,
      suggested_note: args.finding.suggested_note,
      primary_card_id: args.finding.primary_card_id,
      related_card_ids: args.finding.related_card_ids,
      human_question: args.finding.human_question,
      claude_should_rewrite:
        args.finding.recommended_action === "rewrite_with_claude",
    },
  };

  const { data, error } = await args.client
    .from("editorial_suggestions")
    .insert({
      reference: args.reference,
      canonical_ref: args.canonicalRef ?? args.reference,
      book_key: args.bookKey,
      book: args.book,
      chapter: args.chapter,
      verse: args.verse,
      lang: args.lang,

      suggestion_type: findingSuggestionType(args.finding),
      status: "pending",

      existing_card_id: args.finding.primary_card_id,
      candidate_card_id: null,
      candidate_payload: candidatePayload,

      score_existing: null,
      score_candidate: args.finding.score_total,
      score_delta: null,

      angle_relationship: args.finding.angle_relationship,
      relationship_confidence:
        args.finding.severity === "high"
          ? "high"
          : args.finding.severity === "low"
            ? "low"
            : "medium",
      same_angle_summary: args.finding.title,
      matched_card_id: args.finding.primary_card_id,

      reason: `${args.finding.reason}${
        args.finding.human_question ? `\n\nВопрос модератору: ${args.finding.human_question}` : ""
      }${
        args.finding.suggested_note ? `\n\nИнструкция для Claude: ${args.finding.suggested_note}` : ""
      }`,
      risk: args.finding.suggested_note,
      risk_level: args.finding.risk_level,
      source_summary: "Auto Moderator Engine v2",

      source_id: null,
      note_id: null,

      provider: "openai",
      model: args.evaluatorModel,
      evaluator_version: `auto_moderator_engine_v2:${args.evaluatorModel}`,
      decision_engine_version: "auto_moderator_routing_v2",

      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
      moderator_decision: null,

      created_at: args.now,
      updated_at: args.now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[AUTO_MODERATOR_ENGINE] editorial_suggestions insert failed", {
      title: args.finding.title,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return { id: null, error: error.message || "Failed to insert editorial_suggestion" };
  }

  return {
    id: isRecord(data) ? getString(data.id) : null,
    error: null,
  };
}

async function insertFindingDecision(args: {
  client: ReturnType<typeof createAdminClient>;
  runId: string | null;
  reference: string;
  canonicalRef: string | null;
  lang: string;
  finding: ReportFindingWithPersistence;
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
        engine_version: "auto_moderator_engine_v2",
        finding_type: args.finding.finding_type,
        title: args.finding.title,
        primary_card_id: args.finding.primary_card_id,
        related_card_ids: args.finding.related_card_ids,
        recommended_editorial_action: args.finding.recommended_action,
        automation_class: args.finding.automation_class,
        suggested_note: args.finding.suggested_note,
        human_question: args.finding.human_question,
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
      applied_action: args.finding.applied_action ?? "report_only",
      suggestion_type:
        args.finding.finding_type === "overclaim_risk"
          ? "overclaim_review"
          : args.finding.finding_type === "duplicate_cluster"
            ? "duplicate_uncertain"
            : args.finding.automation_class === "human_required"
              ? "needs_review"
              : null,

      existing_card_id: args.finding.primary_card_id,
      inserted_card_id: null,
      inserted_suggestion_id: args.finding.inserted_suggestion_id,

      source_basis: "Auto Moderator Engine v2",
      reason: args.finding.reason,
      decision_reason: `automation_class=${args.finding.automation_class}; recommended_action=${args.finding.recommended_action}`,
      error: args.finding.error,
      metadata: {
        severity: args.finding.severity,
        finding_type: args.finding.finding_type,
        automation_class: args.finding.automation_class,
        related_card_ids: args.finding.related_card_ids,
        human_question: args.finding.human_question,
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[AUTO_MODERATOR_ENGINE] curator_decisions insert failed", {
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
  const apply = body.apply === true;
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
      mode: apply ? "apply" : "report",
    });

    if (cards.length === 0) {
      const emptyReport: AutoModeratorReport = {
        health_score: 0,
        set_status: "needs_cleanup",
        summary: "По этому стиху нет карточек для проверки набора.",
        moderator_brief: "Карточек нет. Автомодератору нечего проверять.",
        active_count: 0,
        reserve_count: 0,
        hidden_count: 0,
        rejected_count: 0,
        audit_only_count: 0,
        create_editorial_suggestion_count: 0,
        human_required_count: 0,
        auto_apply_safe_count: 0,
        findings: [],
      };

      await updateRun({
        client,
        runId,
        status: "completed",
        report: emptyReport,
      });

      return NextResponse.json({
        ok: true,
        mode: apply ? "apply" : "report",
        run_id: runId,
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        evaluator_provider: "openai",
        evaluator_model: evaluatorModel,
        inserted_editorial_suggestion_count: 0,
        report: emptyReport,
      });
    }

    const prompt = buildReportPrompt({
      reference: effectiveReference,
      canonicalRef,
      lang,
      cards,
    });

    const ai = await callOpenAI({
      prompt,
      model: evaluatorModel,
    });

    const report = normalizeReport(ai.rawJson, fallbackCounts);
    const now = new Date().toISOString();

    const persistedFindings: ReportFindingWithPersistence[] = [];
    let insertedSuggestionsCount = 0;
    let errorCount = 0;

    for (const finding of report.findings) {
      const persisted: ReportFindingWithPersistence = {
        ...finding,
        audit_decision_id: null,
        inserted_suggestion_id: null,
        applied_action: "report_only",
        error: null,
      };

      const shouldCreateSuggestion =
        apply &&
        (finding.automation_class === "create_editorial_suggestion" ||
          finding.automation_class === "human_required");

      if (shouldCreateSuggestion) {
        const suggestion = await insertEditorialSuggestionFromFinding({
          client,
          reference: effectiveReference,
          canonicalRef,
          bookKey: getString(body.book_key),
          book: getString(body.book),
          chapter: getNumber(body.chapter),
          verse: getNumber(body.verse),
          lang,
          finding,
          evaluatorModel,
          now,
        });

        persisted.inserted_suggestion_id = suggestion.id;
        persisted.applied_action =
          suggestion.error === null ? "inserted_editorial_suggestion" : "failed";
        persisted.error = suggestion.error;

        if (suggestion.error) {
          errorCount += 1;
        } else {
          insertedSuggestionsCount += 1;
        }
      }

      if (apply && finding.automation_class === "audit_only") {
        persisted.applied_action = "report_only";
      }

      if (apply && finding.automation_class === "auto_apply_safe") {
        // v2 deliberately does not mutate cards yet.
        // Safe auto-apply will be enabled later for very narrow non-destructive actions.
        persisted.applied_action = "report_only";
      }

      persisted.audit_decision_id = await insertFindingDecision({
        client,
        runId,
        reference: effectiveReference,
        canonicalRef,
        lang,
        finding: persisted,
      });

      persistedFindings.push(persisted);
    }

    const persistedReport = {
      ...report,
      findings: persistedFindings,
    };

    await updateRun({
      client,
      runId,
      status: errorCount === 0 ? "completed" : "partial",
      report,
      rawEvaluation: ai.rawText,
      insertedSuggestionsCount,
      errorCount,
    });

    return NextResponse.json(
      {
        ok: errorCount === 0,
        mode: apply ? "apply" : "report",
        run_id: runId,
        reference: effectiveReference,
        canonical_ref: canonicalRef,
        lang,
        evaluator_provider: "openai",
        evaluator_model: evaluatorModel,
        existing_card_count: cards.length,
        inserted_editorial_suggestion_count: insertedSuggestionsCount,
        error_count: errorCount,
        report: persistedReport,
      },
      { status: errorCount === 0 ? 200 : 207 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Auto Moderator Engine failed.";

    await updateRun({
      client,
      runId,
      status: "failed",
      report: null,
      error: message,
    });

    console.error("[AUTO_MODERATOR_ENGINE] error", {
      reference,
      canonicalRef,
      lang,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        run_id: runId,
        error: message,
      },
      { status: 500 },
    );
  }
}
