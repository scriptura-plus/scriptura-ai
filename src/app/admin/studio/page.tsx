"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatReference } from "@/lib/bible/formatReference";
import { ManualMaterialBuilder } from "@/components/studio/ManualMaterialBuilder";
import { GroupCardActions } from "@/components/studio/GroupCardActions";

type Lang = "ru" | "en" | "es";
type RewriteMode = "polish" | "from_idea";

type VerseSummary = {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lang: Lang;
  total_count: number;
  featured_count: number;
  reserve_count: number;
  hidden_count: number;
  rejected_count: number;
  best_score: number | null;
  sources: string[];
  last_activity_at: string;
  book_key: string | null;
  canonical_ref: string | null;
};

type StudioCard = {
  id: string;
  reference: string;
  lang: Lang;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  angle_summary: string | null;
  coverage_type: string | null;
  score_total: number | null;
  status: string;
  rank?: number | null;
  is_locked?: boolean;

  moderator_boost?: number | null;
  moderator_note?: string | null;
  moderator_decision?: string | null;
  moderator_reviewed_at?: string | null;

  source_type: string | null;
  source_provider: string | null;
  source_model: string | null;
  editor_model: string | null;
  created_at: string;
  updated_at: string;
};

type CardsSummary = {
  total: number;
  featured: number;
  reserve: number;
  rewrite: number;
  hidden: number;
  rejected: number;
  best_score: number | null;
  sources: string[];
};

type RecentVersesResponse = {
  ok?: boolean;
  error?: string;
  lang?: Lang;
  days?: number;
  count?: number;
  verses?: VerseSummary[];
};

type CardsResponse = {
  ok?: boolean;
  error?: string;
  reference?: string;
  canonical_ref?: string | null;
  lang?: Lang;
  summary?: CardsSummary;
  count?: number;
  cards?: StudioCard[];
};

type ResearchMemorySource = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  lang: string;
  source_kind: string;
  source_type: string | null;
  source_provider: string | null;
  source_model: string | null;
  title: string | null;
  status: string;
  extraction_status: string;
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
};

type ResearchMemoryNote = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  lang: string;
  note_kind: string;
  lens_id: string | null;
  source_kind: string | null;
  title: string | null;
  kicker: string | null;
  summary: string | null;
  body_preview: string | null;
  anchor: string | null;
  status: string;
  score: number | null;
  confidence: string | null;
  candidate_status: string;
  created_at: string;
  updated_at: string;
};

type ResearchMemoryResponse = {
  ok?: boolean;
  error?: string;
  reference?: string | null;
  canonical_ref?: string | null;
  lang?: Lang;
  summary?: {
    sources_count: number;
    notes_count: number;
    source_kinds: Record<string, number>;
    source_types: Record<string, number>;
    extraction_statuses: Record<string, number>;
    note_kinds: Record<string, number>;
    note_statuses: Record<string, number>;
    candidate_statuses: Record<string, number>;
  };
  latest_sources?: ResearchMemorySource[];
  latest_notes?: ResearchMemoryNote[];
};

type EditorialSuggestion = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  book_key: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lang: string;

  suggestion_type: string;
  status: string;

  existing_card_id: string | null;
  candidate_card_id: string | null;
  candidate_payload: unknown | null;

  score_existing: number | null;
  score_candidate: number | null;
  score_delta: number | null;

  angle_relationship: string | null;
  relationship_confidence: string | null;
  same_angle_summary: string | null;
  matched_card_id: string | null;

  reason: string | null;
  risk: string | null;
  risk_level: string | null;
  source_summary: string | null;

  source_id: string | null;
  note_id: string | null;

  provider: string | null;
  model: string | null;
  evaluator_version: string | null;
  decision_engine_version: string | null;

  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  moderator_decision: string | null;

  created_at: string;
  updated_at: string;
};

type EditorialSuggestionsResponse = {
  ok?: boolean;
  error?: string;
  reference?: string | null;
  canonical_ref?: string | null;
  lang?: Lang;
  status?: string;
  count?: number;
  summary?: {
    statuses: Record<string, number>;
    suggestion_types: Record<string, number>;
    angle_relationships: Record<string, number>;
    risk_levels: Record<string, number>;
  };
  suggestions?: EditorialSuggestion[];
};

type RunAutoCuratorDecision = {
  candidate: {
    title: string;
    anchor: string | null;
    teaser: string;
    why_it_matters: string | null;
  };
  score_total: number;
  scores?: Record<string, number>;
  coverage_type: string | null;
  angle_summary: string | null;
  angle_relationship:
    | "duplicate"
    | "stronger_version"
    | "sibling_angle"
    | "distinct_angle"
    | "uncertain";
  relationship_confidence: "low" | "medium" | "high";
  matched_card_id: string | null;
  matched_card_title: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  risk: string | null;
  reason: string;
  source_basis: string | null;
  recommended_action:
    | "auto_add_active"
    | "auto_add_reserve"
    | "auto_add"
    | "auto_reject"
    | "editorial_suggestion";
  applied_action?:
    | "inserted_active"
    | "inserted_reserve"
    | "inserted_editorial_suggestion"
    | "rejected_logged"
    | "report_only"
    | "skipped"
    | "failed"
    | null;
  suggestion_type:
    | "replacement"
    | "needs_review"
    | "locked_card_challenger"
    | "style_review"
    | "promote_candidate"
    | "duplicate_uncertain"
    | "risk_review"
    | "overclaim_review"
    | null;
  decision_reason: string;
  applied: boolean;
  inserted_card_id: string | null;
  inserted_suggestion_id: string | null;
  audit_decision_id?: string | null;
  error: string | null;
};

type RunAutoCuratorResponse = {
  ok?: boolean;
  error?: string;
  mode?: "preview" | "apply";
  reference?: string;
  canonical_ref?: string | null;
  lang?: Lang;
  generator_provider?: string;
  generator_model?: string;
  evaluator_provider?: string;
  evaluator_model?: string;
  source_count?: number;
  note_count?: number;
  existing_card_count?: number;
  generated_count?: number;
  evaluated_count?: number;
  run_id?: string | null;
  auto_add_count?: number;
  auto_add_active_count?: number;
  auto_add_reserve_count?: number;
  editorial_suggestion_count?: number;
  auto_reject_count?: number;
  applied_count?: number;
  error_count?: number;
  summary?: string;
  raw_generation?: string;
  decisions?: RunAutoCuratorDecision[];
};

type AutoModeratorFinding = {
  finding_type:
    | "duplicate_cluster"
    | "overclaim_risk"
    | "weak_active"
    | "strong_reserve"
    | "diversity_issue"
    | "locked_card_note"
    | "healthy_set"
    | "needs_human_review"
    | "other";
  title: string;
  severity: "low" | "medium" | "high";
  primary_card_id: string | null;
  related_card_ids: string[];
  recommended_action:
    | "keep"
    | "move_to_reserve"
    | "promote_to_active"
    | "hide"
    | "lock"
    | "add_note"
    | "rewrite"
    | "rewrite_with_claude"
    | "create_editorial_suggestion"
    | "no_action";
  automation_class?:
    | "audit_only"
    | "create_editorial_suggestion"
    | "human_required"
    | "auto_apply_safe";
  reason: string;
  suggested_note: string | null;
  human_question?: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  angle_relationship:
    | "duplicate"
    | "stronger_version"
    | "sibling_angle"
    | "distinct_angle"
    | "uncertain";
  score_total: number | null;
  audit_decision_id?: string | null;
  inserted_suggestion_id?: string | null;
  applied_action?: string | null;
  error?: string | null;
};

type AutoModeratorReportResponse = {
  ok?: boolean;
  error?: string;
  mode?: "report" | "apply";
  run_id?: string | null;
  reference?: string;
  canonical_ref?: string | null;
  lang?: Lang;
  evaluator_provider?: string;
  evaluator_model?: string;
  existing_card_count?: number;
  inserted_editorial_suggestion_count?: number;
  error_count?: number;
  report?: {
    health_score: number;
    set_status: "healthy" | "mostly_healthy" | "needs_cleanup" | "risky";
    summary: string;
    moderator_brief?: string;
    active_count: number;
    reserve_count: number;
    hidden_count: number;
    rejected_count: number;
    audit_only_count?: number;
    create_editorial_suggestion_count?: number;
    human_required_count?: number;
    auto_apply_safe_count?: number;
    findings: AutoModeratorFinding[];
  };
};

type ReEvaluation = {
  score_total?: number;
  placement?: string;
  reason?: string;
  risk?: string | null;
  scores?: Record<string, number>;
  coverage_type?: string;
  angle_summary?: string;
  battle?: unknown;
};

type ReEvaluateResponse = {
  ok?: boolean;
  error?: string;
  mode?: string;
  changed_database?: boolean;
  reference?: string;
  canonical_ref?: string | null;
  lang?: Lang;
  candidate_id?: string | null;
  old_score?: number | null;
  verse_text_source?: "request" | "getVerseText";
  verse_text_preview?: string;
  evaluation?: ReEvaluation;
};

type ApplyEvaluationResponse = {
  ok?: boolean;
  error?: string;
  changed_database?: boolean;
  card_id?: string;
  applied?: {
    score_total?: number | null;
    status?: string;
    rank?: number | null;
    coverage_type?: string | null;
    angle_summary?: string | null;
  };
  card?: Partial<StudioCard>;
};

type RetranslateCardResponse = {
  ok?: boolean;
  error?: string;
  changed_database?: boolean;
  card_id?: string;
  target_lang?: Lang;
  source_card_id?: string;
  source_lang?: Lang;
  translation_group_id?: string;
  updated_fields?: {
    title?: string;
    anchor?: string | null;
    teaser?: string;
    why_it_matters?: string | null;
    updated_at?: string;
  };
  card?: Partial<StudioCard>;
};

type RewrittenCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
};

type RewriteCardResponse = {
  ok?: boolean;
  error?: string;
  mode?: string;
  rewrite_mode?: RewriteMode;
  changed_database?: boolean;
  card_id?: string;
  reference?: string;
  canonical_ref?: string | null;
  lang?: Lang;
  verse_text_source?: "request" | "getVerseText";
  verse_text_preview?: string;
  instruction?: string;
  original_card?: Partial<StudioCard>;
  rewritten_card?: RewrittenCard;
  evaluation?: ReEvaluation;
};

type ApplyRewriteResponse = {
  ok?: boolean;
  error?: string;
  changed_database?: boolean;
  mode?: string;
  card_id?: string;
  translation_group_id?: string;
  origin_lang?: Lang;
  updated_ids?: string[];
  inserted_ids?: string[];
  applied?: {
    score_total?: number | null;
    status?: string;
    rank?: number | null;
    coverage_type?: string | null;
    angle_summary?: string | null;
  };
  card?: Partial<StudioCard>;
};

type UpdateAngleCardResponse = {
  ok?: boolean;
  error?: string;
  card?: Partial<StudioCard>;
};

type GroupStatus = "featured" | "reserve" | "hidden" | "rejected";

type ReEvaluateState = {
  loading: boolean;
  applying: boolean;
  applied: boolean;
  error: string;
  applyError: string;
  result: ReEvaluateResponse | null;
};

type RetranslateState = {
  loading: boolean;
  applied: boolean;
  error: string;
};

type RewriteState = {
  rewriteMode: RewriteMode;
  instruction: string;
  extraMaterial: string;
  preserveOriginalMeta: boolean;
  loading: boolean;
  applying: boolean;
  applied: boolean;
  error: string;
  applyError: string;
  result: RewriteCardResponse | null;
};

const BG = "#f4efe7";
const PAGE_GLOW =
  "radial-gradient(circle at top, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0) 52%)";
const PAPER = "#fbf8f3";
const PANEL = "#f9f5ee";
const CARD = "#fffdfa";
const CARD_ALT = "#f7f3ec";
const LINE = "#d9d0c2";
const LINE_SOFT = "#e7e0d4";
const INK = "#2f2923";
const TEXT = "#40372f";
const MUTED = "#6d645b";
const MUTED_2 = "#8b8277";
const SLATE = "#6f7b88";
const SLATE_DARK = "#5b6672";
const SLATE_SOFT = "#eef2f5";
const SLATE_SOFT_2 = "#f5f7f9";
const WARM_ACCENT = "#9a8061";
const WARM_SOFT = "#f4ede3";
const WARNING_BG = "#f5ebd5";
const WARNING_TEXT = "#8a6330";
const ERROR_BG = "#f5dfd7";
const ERROR_TEXT = "#8b3e2e";
const SUCCESS_BG = "#e4ecde";
const SUCCESS_TEXT = "#4f6b3d";

function formatDate(value: string): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}

function cleanSource(source: string): string {
  return source
    .replace("article_extractor_v1:", "")
    .replace("admin_process_candidate", "manual")
    .replace("extra_analysis_article", "extra")
    .replace("context_card_article", "context")
    .replace("word_card_article", "word");
}

function modelLabel(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === "gemini") return "Gemini";
  if (normalized === "claude") return "Claude";
  if (normalized === "openai") return "OpenAI";
  if (normalized === "gpt") return "OpenAI";
  if (normalized === "gpt-5.5") return "GPT-5.5";

  return value;
}

function readableSourceLabel(source: string): string {
  const cleaned = cleanSource(source);

  if (cleaned.startsWith("manual_material:")) {
    return `Ручной материал ${modelLabel(cleaned.replace("manual_material:", ""))}`;
  }

  if (cleaned === "manual_material") return "Ручной материал";

  if (cleaned.startsWith("initial_angles:gemini")) return "Первичная генерация Gemini";
  if (cleaned.startsWith("initial_angles:claude")) return "Первичная генерация Claude";
  if (cleaned.startsWith("initial_angles:openai")) return "Первичная генерация OpenAI";
  if (cleaned.startsWith("initial_angles:gpt")) return "Первичная генерация OpenAI";

  if (cleaned === "word") return "Word Lens";
  if (cleaned === "context") return "Context Lens";
  if (cleaned === "intertext") return "Связи с другими стихами";
  if (cleaned === "socio") return "Социально-историческая линза";
  if (cleaned === "genre") return "Жанровая линза";
  if (cleaned === "rhetoric") return "Риторическая линза";
  if (cleaned === "structure") return "Структурная линза";
  if (cleaned === "historical_scene") return "Историческая сцена";
  if (cleaned === "text_findings") return "Текстовые находки";
  if (cleaned === "scripture_links") return "Связи с другими стихами";
  if (cleaned === "expand-angle") return "Развёрнутая карточка";
  if (cleaned === "expand_angle") return "Развёрнутая карточка";

  if (cleaned === "generated_candidates_v2") return "Ручная генерация кандидатов";
  if (cleaned === "generated_candidates_v1") return "Старая генерация кандидатов";
  if (cleaned === "manual") return "Ручная обработка";
  if (cleaned === "manual_test") return "Ручной тест";
  if (cleaned === "studio_rewrite") return "Доработка в Studio";
  if (cleaned === "cached_results:gpt-5.5") return "Сохранённая карточка GPT-5.5";
  if (cleaned === "unknown") return "Неизвестно";

  return cleaned;
}

function statusLabel(status: string): string {
  if (status === "featured") return "Статус: активная";
  if (status === "reserve") return "Статус: запас";
  if (status === "hidden") return "Статус: скрыта";
  if (status === "rejected") return "Статус: отклонена";
  if (status === "rewrite") return "Статус: на доработку";
  return `Статус: ${status}`;
}

function shortStatusLabel(status: string): string {
  if (status === "featured") return "активных";
  if (status === "reserve") return "в запасе";
  if (status === "hidden") return "скрытых";
  if (status === "rejected") return "отклонённых";
  if (status === "rewrite") return "на доработке";
  return status;
}

function readableCardStatus(status: string): string {
  if (status === "featured") return "активная";
  if (status === "reserve") return "запас";
  if (status === "hidden") return "скрыта";
  if (status === "rejected") return "отклонена";
  if (status === "rewrite") return "на доработке";
  return status || "—";
}

function coverageLabel(type: string | null): string | null {
  if (!type) return null;
  if (type === "lexical") return "Тип: слово / лексика";
  if (type === "grammatical") return "Тип: грамматика";
  if (type === "structural") return "Тип: структура";
  if (type === "contextual") return "Тип: контекст";
  if (type === "translation") return "Тип: перевод";
  if (type === "rhetorical") return "Тип: риторика";
  if (type === "historical") return "Тип: история";
  if (type === "conceptual") return "Тип: идея";
  if (type === "other") return "Тип: другое";
  return `Тип: ${type}`;
}

function getCardSource(card: StudioCard): string {
  return readableSourceLabel(card.source_model || card.source_type || "unknown");
}

function getModeratorBoost(card: StudioCard): number {
  return typeof card.moderator_boost === "number" && Number.isFinite(card.moderator_boost)
    ? card.moderator_boost
    : 0;
}

function getEffectiveScore(card: StudioCard): number | null {
  if (typeof card.score_total !== "number" || !Number.isFinite(card.score_total)) {
    return null;
  }

  return card.score_total + getModeratorBoost(card);
}

function getStatusWeight(status: string): number {
  if (status === "featured") return 1;
  if (status === "reserve") return 2;
  if (status === "rewrite") return 3;
  if (status === "hidden") return 4;
  if (status === "rejected") return 5;
  return 99;
}

function sortStudioCards(cards: StudioCard[]): StudioCard[] {
  return [...cards].sort((a, b) => {
    const statusDiff = getStatusWeight(a.status) - getStatusWeight(b.status);
    if (statusDiff !== 0) return statusDiff;

    const aHasRank = typeof a.rank === "number";
    const bHasRank = typeof b.rank === "number";

    if (aHasRank && bHasRank && a.rank !== b.rank) {
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    }

    if (aHasRank && !bHasRank) return -1;
    if (!aHasRank && bHasRank) return 1;

    const aEffective = getEffectiveScore(a) ?? -9999;
    const bEffective = getEffectiveScore(b) ?? -9999;

    if (aEffective !== bEffective) return bEffective - aEffective;

    return a.created_at.localeCompare(b.created_at);
  });
}

function getButtonStyle(active = false, disabled = false) {
  return {
    border: `1px solid ${active ? SLATE : "rgba(111, 123, 136, 0.26)"}`,
    borderRadius: 999,
    background: active ? `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)` : SLATE_SOFT_2,
    color: active ? "#ffffff" : SLATE_DARK,
    padding: "10px 15px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: active ? "0 10px 22px rgba(91, 102, 114, 0.20)" : "none",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getSmallButtonStyle(disabled = false) {
  return {
    border: `1px solid rgba(111, 123, 136, 0.24)`,
    borderRadius: 999,
    background: SLATE_SOFT_2,
    color: SLATE_DARK,
    padding: "8px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getApplyButtonStyle(disabled = false) {
  return {
    border: `1px solid ${disabled ? "rgba(111, 123, 136, 0.24)" : SLATE}`,
    borderRadius: 999,
    background: disabled ? "#eceff2" : `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`,
    color: disabled ? SLATE_DARK : "#ffffff",
    padding: "8px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: disabled ? "none" : "0 8px 18px rgba(91, 102, 114, 0.16)",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getRepairButtonStyle(disabled = false) {
  return {
    border: `1px solid ${disabled ? "rgba(154, 128, 97, 0.22)" : "rgba(154, 128, 97, 0.38)"}`,
    borderRadius: 999,
    background: disabled ? "#eee8de" : WARNING_BG,
    color: WARNING_TEXT,
    padding: "8px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getModeButtonStyle(active = false, disabled = false) {
  return {
    border: `1px solid ${active ? SLATE : "rgba(111, 123, 136, 0.22)"}`,
    borderRadius: 12,
    background: active ? `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)` : "#fffaf3",
    color: active ? "#ffffff" : SLATE_DARK,
    padding: "9px 10px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 850,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: active ? "0 6px 16px rgba(91, 102, 114, 0.18)" : "none",
  } as const;
}

function getToggleRejectedButtonStyle(active = false): CSSProperties {
  return {
    border: `1px solid ${active ? "rgba(138, 99, 48, 0.34)" : "rgba(111, 123, 136, 0.22)"}`,
    borderRadius: 999,
    background: active ? WARNING_BG : SLATE_SOFT_2,
    color: active ? WARNING_TEXT : SLATE_DARK,
    padding: "7px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 850,
    fontFamily: "inherit",
  };
}

function getEvaluationScore(result: ReEvaluateResponse | RewriteCardResponse | null): number | null {
  const score = result?.evaluation?.score_total;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getEvaluationPlacement(result: ReEvaluateResponse | RewriteCardResponse | null): string | null {
  const placement = result?.evaluation?.placement;
  return typeof placement === "string" && placement.trim() ? placement.trim() : null;
}

function getEvaluationReason(result: ReEvaluateResponse | RewriteCardResponse | null): string | null {
  const reason = result?.evaluation?.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function getEvaluationRisk(result: ReEvaluateResponse | RewriteCardResponse | null): string | null {
  const risk = result?.evaluation?.risk;
  return typeof risk === "string" && risk.trim() ? risk.trim() : null;
}

function placementFromCardStatus(status: string): string {
  if (status === "featured") return "featured_new";
  if (status === "reserve") return "reserve";
  if (status === "hidden") return "hidden";
  if (status === "rejected") return "rejected";
  if (status === "rewrite") return "rewrite";
  return status || "reserve";
}

function buildPreservedRewriteEvaluation(card: StudioCard, evaluation: ReEvaluation): ReEvaluation {
  return {
    ...evaluation,
    score_total:
      typeof card.score_total === "number" && Number.isFinite(card.score_total)
        ? card.score_total
        : evaluation.score_total,
    placement: placementFromCardStatus(card.status),
    coverage_type: card.coverage_type ?? evaluation.coverage_type,
    angle_summary: card.angle_summary ?? evaluation.angle_summary,
    reason: [
      "Soft patch mode: исходный score/status сохранены. Новая проверка использована только как risk-check, а не как решение о продвижении.",
      evaluation.reason,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function createEmptyReEvaluateState(previous?: ReEvaluateState): ReEvaluateState {
  return {
    loading: false,
    applying: false,
    applied: false,
    error: "",
    applyError: "",
    result: previous?.result ?? null,
  };
}

function createEmptyRetranslateState(): RetranslateState {
  return {
    loading: false,
    applied: false,
    error: "",
  };
}

function createEmptyRewriteState(previous?: RewriteState): RewriteState {
  return {
    rewriteMode: previous?.rewriteMode ?? "polish",
    instruction: previous?.instruction ?? "",
    extraMaterial: previous?.extraMaterial ?? "",
    preserveOriginalMeta: previous?.preserveOriginalMeta ?? false,
    loading: false,
    applying: false,
    applied: false,
    error: "",
    applyError: "",
    result: previous?.result ?? null,
  };
}

function summarizeCards(cards: StudioCard[]): CardsSummary {
  const sources = new Set<string>();
  let bestScore: number | null = null;

  const summary: CardsSummary = {
    total: cards.length,
    featured: 0,
    reserve: 0,
    rewrite: 0,
    hidden: 0,
    rejected: 0,
    best_score: null,
    sources: [],
  };

  for (const card of cards) {
    if (card.status === "featured") summary.featured += 1;
    if (card.status === "reserve") summary.reserve += 1;
    if (card.status === "rewrite") summary.rewrite += 1;
    if (card.status === "hidden") summary.hidden += 1;
    if (card.status === "rejected") summary.rejected += 1;

    const effectiveScore = getEffectiveScore(card);

    if (effectiveScore !== null && (bestScore === null || effectiveScore > bestScore)) {
      bestScore = effectiveScore;
    }

    sources.add(getCardSource(card));
  }

  summary.best_score = bestScore;
  summary.sources = Array.from(sources);

  return summary;
}

function splitSourcesForPreview(sources: string[], limit = 3) {
  const cleaned = sources.map(readableSourceLabel);
  return {
    shown: cleaned.slice(0, limit),
    hiddenCount: Math.max(0, cleaned.length - limit),
  };
}

function readableSuggestionType(type: string): string {
  if (type === "replacement") return "Возможная замена";
  if (type === "needs_review") return "Нужна проверка";
  if (type === "locked_card_challenger") return "Альтернатива к locked";
  if (type === "style_review") return "Проверка стиля";
  if (type === "promote_candidate") return "Продвинуть кандидата";
  if (type === "duplicate_uncertain") return "Возможный дубль";
  if (type === "risk_review") return "Проверка риска";
  if (type === "overclaim_review") return "Проверка overclaim";
  return type;
}

function readableAngleRelationship(value: string | null): string | null {
  if (!value) return null;
  if (value === "duplicate") return "дубль";
  if (value === "stronger_version") return "сильнее того же угла";
  if (value === "sibling_angle") return "родственный угол";
  if (value === "distinct_angle") return "новый угол";
  if (value === "uncertain") return "неясно";
  return value;
}

function readableRiskLevel(level: "low" | "medium" | "high" | "unknown" | string | null | undefined): string {
  if (level === "low") return "низкий риск";
  if (level === "medium") return "средний риск";
  if (level === "high") return "высокий риск";
  return "риск неизвестен";
}

function readableRunAction(action: RunAutoCuratorDecision["recommended_action"]): string {
  if (action === "auto_add_active") return "в активные";
  if (action === "auto_add_reserve") return "в запас";
  if (action === "auto_add") return "auto-add";
  if (action === "editorial_suggestion") return "в очередь";
  if (action === "auto_reject") return "reject";
  return action;
}

function readableRunActionLong(action: RunAutoCuratorDecision["recommended_action"]): string {
  if (action === "auto_add_active") return "Автоматически добавить в активные";
  if (action === "auto_add_reserve") return "Автоматически добавить в запас";
  if (action === "auto_add") return "Автоматически добавить";
  if (action === "editorial_suggestion") return "Создать редакторское предложение";
  if (action === "auto_reject") return "Автоматически отклонить";
  return action;
}

function getRunDecisionScoreBackground(action: RunAutoCuratorDecision["recommended_action"]): string {
  if (action === "auto_add_active") {
    return `linear-gradient(180deg, ${SUCCESS_TEXT} 0%, #3f5730 100%)`;
  }

  if (action === "auto_add_reserve") {
    return `linear-gradient(180deg, ${WARM_ACCENT} 0%, #7f674c 100%)`;
  }

  if (action === "editorial_suggestion") {
    return `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`;
  }

  return `linear-gradient(180deg, ${MUTED_2} 0%, ${MUTED} 100%)`;
}

function readableReportStatus(
  status: "healthy" | "mostly_healthy" | "needs_cleanup" | "risky",
): string {
  if (status === "healthy") return "здоровый набор";
  if (status === "mostly_healthy") return "в целом здоровый";
  if (status === "needs_cleanup") return "нужна чистка";
  if (status === "risky") return "есть риски";
  return "статус неизвестен";
}

function readableReportFindingType(type: AutoModeratorFinding["finding_type"]): string {
  if (type === "duplicate_cluster") return "Дубли / близкие углы";
  if (type === "overclaim_risk") return "Риск overclaim";
  if (type === "weak_active") return "Слабая активная";
  if (type === "strong_reserve") return "Сильная запасная";
  if (type === "diversity_issue") return "Diversity набора";
  if (type === "locked_card_note") return "Locked / заметка";
  if (type === "healthy_set") return "Набор здоров";
  if (type === "needs_human_review") return "Нужна проверка";
  return "Другое";
}

function readableReportAction(action: AutoModeratorFinding["recommended_action"]): string {
  if (action === "keep") return "оставить";
  if (action === "move_to_reserve") return "перевести в запас";
  if (action === "promote_to_active") return "поднять в активные";
  if (action === "hide") return "скрыть";
  if (action === "lock") return "защитить";
  if (action === "add_note") return "добавить заметку";
  if (action === "rewrite" || action === "rewrite_with_claude") return "доработать Claude";
  if (action === "create_editorial_suggestion") return "в очередь";
  if (action === "no_action") return "без действия";
  return action;
}

function readableAutomationClass(value: AutoModeratorFinding["automation_class"]): string {
  if (value === "audit_only") return "только audit";
  if (value === "create_editorial_suggestion") return "создать очередь";
  if (value === "human_required") return "нужен человек";
  if (value === "auto_apply_safe") return "безопасное авто";
  return "маршрут не указан";
}

function readableFindingSeverity(severity: AutoModeratorFinding["severity"]): string {
  if (severity === "high") return "важно";
  if (severity === "medium") return "средне";
  return "низко";
}

function getReportHealthBackground(
  status: "healthy" | "mostly_healthy" | "needs_cleanup" | "risky",
): string {
  if (status === "healthy") {
    return `linear-gradient(180deg, ${SUCCESS_TEXT} 0%, #3f5730 100%)`;
  }

  if (status === "mostly_healthy") {
    return `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`;
  }

  if (status === "needs_cleanup") {
    return `linear-gradient(180deg, ${WARM_ACCENT} 0%, #7f674c 100%)`;
  }

  return `linear-gradient(180deg, ${ERROR_TEXT} 0%, #6f3328 100%)`;
}


function getPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getSuggestionCandidateTitle(suggestion: EditorialSuggestion): string {
  return (
    getPayloadString(suggestion.candidate_payload, "title") ??
    getPayloadString(suggestion.candidate_payload, "heading") ??
    getPayloadString(suggestion.candidate_payload, "name") ??
    "Кандидат без заголовка"
  );
}

function getSuggestionCandidatePreview(suggestion: EditorialSuggestion): string | null {
  return (
    getPayloadString(suggestion.candidate_payload, "teaser") ??
    getPayloadString(suggestion.candidate_payload, "body") ??
    getPayloadString(suggestion.candidate_payload, "text") ??
    getPayloadString(suggestion.candidate_payload, "why_it_matters")
  );
}


type EditorialQueueLocalResolution = "kept" | "deferred";
type EditorialQueueAction = "accept" | "soft_rewrite" | "keep" | "defer";
type EditorialQueueActionFeedback = {
  action: EditorialQueueAction;
  kind: "success" | "info" | "warning";
  message: string;
  targetCardId?: string | null;
  targetCardTitle?: string | null;
  instruction?: string | null;
};

function getSuggestionTargetCardIds(suggestion: EditorialSuggestion): string[] {
  return [
    suggestion.existing_card_id,
    suggestion.matched_card_id,
    suggestion.candidate_card_id,
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function buildSoftRewriteInstruction(suggestion: EditorialSuggestion): string {
  const parts = [
    "Сохрани карточку как уже одобренную. Это НЕ новая генерация и НЕ новая карточка.",
    "Сделай только мягкий patch: измени одно рискованное выражение, одно предложение или максимум один абзац. Всё остальное оставь максимально близко к оригиналу.",
    "Не меняй главный угол, статус, силу открытия и композицию карточки. Не превращай её в осторожную справочную заметку.",
  ];

  if (suggestion.suggestion_type) {
    parts.push(`Тип проблемы: ${readableSuggestionType(suggestion.suggestion_type)}.`);
  }

  if (suggestion.risk_level) {
    parts.push(`Уровень риска: ${suggestion.risk_level}.`);
  }

  if (suggestion.reason) {
    parts.push(`Причина из очереди: ${suggestion.reason}`);
  }

  if (suggestion.risk) {
    parts.push(`Риск: ${suggestion.risk}`);
  }

  if (suggestion.source_summary) {
    parts.push(`Опора/заметка: ${suggestion.source_summary}`);
  }

  parts.push(
    "Важно: если проблема только в одном выражении, замени только это выражение или одно предложение. Не ухудшай стиль и не меняй смысл без необходимости.",
    "Score/status исходной карточки должны считаться сохранёнными: проверка после правки нужна только как risk-check, а не как новое решение о продвижении карточки.",
  );

  return parts.join("\n\n");
}

function getAcceptRecommendationLabel(suggestion: EditorialSuggestion): string {
  const type = suggestion.suggestion_type;

  if (type === "overclaim_review" || type === "style_review") {
    return "Принять рекомендацию: подготовить мягкую правку";
  }

  if (type === "needs_review" || type === "risk_review") {
    return "Принять рекомендацию: оставить на проверке";
  }

  if (type === "replacement") {
    return "Принять рекомендацию: подготовить замену";
  }

  return "Принять рекомендацию";
}

export default function StudioPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [secretLoaded, setSecretLoaded] = useState(false);
  const [lang, setLang] = useState<Lang>("ru");
  const [days, setDays] = useState(7);

  const [verses, setVerses] = useState<VerseSummary[]>([]);
  const [selectedReference, setSelectedReference] = useState("");
  const [cards, setCards] = useState<StudioCard[]>([]);
  const [cardsSummary, setCardsSummary] = useState<CardsSummary | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const [loadingVerses, setLoadingVerses] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);

  const [versesError, setVersesError] = useState("");
  const [cardsError, setCardsError] = useState("");
  const [notice, setNotice] = useState("");

  const [reEvaluations, setReEvaluations] = useState<Record<string, ReEvaluateState>>({});
  const [retranslations, setRetranslations] = useState<Record<string, RetranslateState>>({});
  const [rewrites, setRewrites] = useState<Record<string, RewriteState>>({});
  const [updatingEditorial, setUpdatingEditorial] = useState<Record<string, boolean>>({});
  const [researchMemory, setResearchMemory] = useState<ResearchMemoryResponse | null>(null);
  const [loadingResearchMemory, setLoadingResearchMemory] = useState(false);
  const [researchMemoryError, setResearchMemoryError] = useState("");
  const [editorialSuggestions, setEditorialSuggestions] = useState<EditorialSuggestionsResponse | null>(null);
  const [loadingEditorialSuggestions, setLoadingEditorialSuggestions] = useState(false);
  const [editorialSuggestionsError, setEditorialSuggestionsError] = useState("");
  const [queueResolutions, setQueueResolutions] = useState<
    Record<string, EditorialQueueLocalResolution>
  >({});
  const [queueActionFeedback, setQueueActionFeedback] = useState<
    Record<string, EditorialQueueActionFeedback>
  >({});

  const [runAutoCuratorResult, setRunAutoCuratorResult] =
    useState<RunAutoCuratorResponse | null>(null);
  const [runningAutoCuratorPreview, setRunningAutoCuratorPreview] = useState(false);
  const [applyingRunAutoCurator, setApplyingRunAutoCurator] = useState(false);
  const [runAutoCuratorError, setRunAutoCuratorError] = useState("");
  const [autoModeratorReport, setAutoModeratorReport] =
    useState<AutoModeratorReportResponse | null>(null);
  const [runningAutoModeratorReport, setRunningAutoModeratorReport] = useState(false);
  const [applyingAutoModeratorRouting, setApplyingAutoModeratorRouting] = useState(false);
  const [autoModeratorReportError, setAutoModeratorReportError] = useState("");

  const selectedVerse = useMemo(() => {
    return verses.find((verse) => verse.reference === selectedReference) ?? null;
  }, [verses, selectedReference]);

  const visibleCards = useMemo(() => {
    if (showRejected) return cards;
    return cards.filter((card) => card.status !== "rejected");
  }, [cards, showRejected]);

  const hiddenRejectedCount = useMemo(() => {
    return cards.filter((card) => card.status === "rejected").length;
  }, [cards]);

  const visibleEditorialSuggestions = useMemo(() => {
    return (editorialSuggestions?.suggestions ?? []).filter(
      (suggestion) => queueResolutions[suggestion.id] !== "kept",
    );
  }, [editorialSuggestions, queueResolutions]);

  const locallyResolvedSuggestionCount = useMemo(() => {
    return Object.values(queueResolutions).filter((value) => value === "kept").length;
  }, [queueResolutions]);

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura_admin_secret");
    if (saved) setAdminSecret(saved);
    setSecretLoaded(true);
  }, []);

  useEffect(() => {
    if (!secretLoaded) return;
    if (!adminSecret.trim()) return;
    if (verses.length > 0 || loadingVerses) return;
    void loadRecentVerses(7, adminSecret);
  }, [secretLoaded, adminSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice("");
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function saveSecret(value: string) {
    setAdminSecret(value);
    window.localStorage.setItem("scriptura_admin_secret", value);
  }

  async function loadRecentVerses(nextDays = days, secretOverride?: string) {
    const secret = secretOverride ?? adminSecret;
    if (!secret.trim()) {
      setVersesError("Вставь Admin Secret, чтобы открыть Studio.");
      return;
    }

    setLoadingVerses(true);
    setVersesError("");
    setNotice(`Загружаю активность за ${nextDays} дн...`);

    try {
      const params = new URLSearchParams({
        lang,
        days: String(nextDays),
        limit: "80",
      });

      const response = await fetch(`/api/admin/studio/recent-verses?${params}`, {
        method: "GET",
        headers: { "x-admin-secret": secret },
      });

      const data = (await response.json()) as RecentVersesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить активность.");
      }

      const nextVerses = data.verses ?? [];
      setVerses(nextVerses);
      setNotice(`Готово: найдено стихов — ${nextVerses.length}.`);

      if (!selectedReference && nextVerses[0]) {
        setSelectedReference(nextVerses[0].reference);
        void loadCards(nextVerses[0], secret);
      }

      if (selectedReference && !nextVerses.some((v) => v.reference === selectedReference)) {
        setSelectedReference("");
        setCards([]);
        setCardsSummary(null);
      }
    } catch (error) {
      setVersesError(
        error instanceof Error ? error.message : "Не удалось загрузить активность.",
      );
      setNotice("");
    } finally {
      setLoadingVerses(false);
    }
  }

  async function loadCards(verse: VerseSummary, secretOverride?: string) {
    const secret = secretOverride ?? adminSecret;
    if (!secret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }
    if (!verse.reference.trim()) {
      setCardsError("Reference пустой.");
      return;
    }

    setSelectedReference(verse.reference);
    setLoadingCards(true);
    setCardsError("");
    setReEvaluations({});
    setRetranslations({});
    setRewrites({});
    setUpdatingEditorial({});
    setResearchMemory(null);
    setResearchMemoryError("");
    setEditorialSuggestions(null);
    setEditorialSuggestionsError("");
    setQueueResolutions({});
    setRunAutoCuratorResult(null);
    setRunAutoCuratorError("");
    setAutoModeratorReport(null);
    setAutoModeratorReportError("");
    setNotice(`Открываю ${displayReference(verse)}...`);

    try {
      const params = new URLSearchParams({
        reference: verse.reference,
        lang,
        limit: "120",
      });

      if (verse.canonical_ref) {
        params.set("canonical_ref", verse.canonical_ref);
      }

      const response = await fetch(`/api/admin/studio/cards?${params}`, {
        method: "GET",
        headers: { "x-admin-secret": secret },
      });

      const data = (await response.json()) as CardsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить карточки.");
      }

      const loadedCards = sortStudioCards(data.cards ?? []);
      setCards(loadedCards);
      setCardsSummary(summarizeCards(loadedCards));
      void loadResearchMemory(verse, secret);
      void loadEditorialSuggestions(verse, secret);
      setNotice(`Карточки загружены: ${loadedCards.length}.`);
    } catch (error) {
      setCards([]);
      setCardsSummary(null);
      setResearchMemory(null);
      setResearchMemoryError("");
      setEditorialSuggestions(null);
      setEditorialSuggestionsError("");
              setRunAutoCuratorResult(null);
      setRunAutoCuratorError("");
      setAutoModeratorReport(null);
      setAutoModeratorReportError("");
      setCardsError(
        error instanceof Error ? error.message : "Не удалось загрузить карточки.",
      );
      setNotice("");
    } finally {
      setLoadingCards(false);
    }
  }

  async function loadResearchMemory(verse: VerseSummary, secretOverride?: string) {
    const secret = secretOverride ?? adminSecret;

    if (!secret.trim()) {
      setResearchMemoryError("Вставь Admin Secret.");
      return;
    }

    setLoadingResearchMemory(true);
    setResearchMemoryError("");

    try {
      const params = new URLSearchParams({
        reference: verse.reference,
        lang,
        limit: "8",
      });

      if (verse.canonical_ref) {
        params.set("canonical_ref", verse.canonical_ref);
      }

      const response = await fetch(`/api/admin/studio/research-memory?${params}`, {
        method: "GET",
        headers: { "x-admin-secret": secret },
      });

      const data = (await response.json()) as ResearchMemoryResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить память стиха.");
      }

      setResearchMemory(data);
    } catch (error) {
      setResearchMemory(null);
      setResearchMemoryError(
        error instanceof Error ? error.message : "Не удалось загрузить память стиха.",
      );
    } finally {
      setLoadingResearchMemory(false);
    }
  }

  async function loadEditorialSuggestions(verse: VerseSummary, secretOverride?: string) {
    const secret = secretOverride ?? adminSecret;

    if (!secret.trim()) {
      setEditorialSuggestionsError("Вставь Admin Secret.");
      return;
    }

    setLoadingEditorialSuggestions(true);
    setEditorialSuggestionsError("");

    try {
      const params = new URLSearchParams({
        reference: verse.reference,
        lang,
        status: "pending",
        limit: "8",
      });

      if (verse.canonical_ref) {
        params.set("canonical_ref", verse.canonical_ref);
      }

      const response = await fetch(`/api/admin/studio/editorial-suggestions?${params}`, {
        method: "GET",
        headers: { "x-admin-secret": secret },
      });

      const data = (await response.json()) as EditorialSuggestionsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить редакторские предложения.");
      }

      setEditorialSuggestions(data);
    } catch (error) {
      setEditorialSuggestions(null);
      setEditorialSuggestionsError(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить редакторские предложения.",
      );
    } finally {
      setLoadingEditorialSuggestions(false);
    }
  }

  async function runAutoCuratorEngine(apply: boolean) {
    if (!selectedVerse) {
      setCardsError("Сначала выбери стих.");
      return;
    }

    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    if (apply) {
      const confirmed = window.confirm(
        "Применить Автокуратор? Безопасные distinct-angle кандидаты могут быть добавлены в angle_cards, спорные уйдут в редакторскую очередь, слабые будут отклонены в отчёте.",
      );

      if (!confirmed) return;
    }

    setRunAutoCuratorError("");
    setRunAutoCuratorResult(null);

    if (apply) {
      setApplyingRunAutoCurator(true);
      setNotice("Автокуратор применяет решения...");
    } else {
      setRunningAutoCuratorPreview(true);
      setNotice("Автокуратор строит preview...");
    }

    try {
      const response = await fetch("/api/admin/studio/run-auto-curator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: selectedVerse.reference,
          canonical_ref: selectedVerse.canonical_ref,
          book_key: selectedVerse.book_key,
          book: selectedVerse.book,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse,
          lang,
          maxCandidates: 5,
          apply,
        }),
      });

      const data = (await response.json()) as RunAutoCuratorResponse;

      if (!response.ok || data.ok === false) {
        const failedDecision = data.decisions?.find((decision) => decision.error);
        throw new Error(
          data.error ||
            failedDecision?.error ||
            "Не удалось запустить Auto Curator Engine.",
        );
      }

      setRunAutoCuratorResult(data);

      if (apply && selectedVerse) {
        await loadCards(selectedVerse, adminSecret);
        await loadEditorialSuggestions(selectedVerse, adminSecret);
      }

      setNotice(
        apply
          ? `Автокуратор применён: применено — ${data.applied_count ?? 0}, решений в аудите — ${data.decisions?.length ?? 0}.`
          : `Автокуратор проверил Озеро: решений — ${data.decisions?.length ?? 0}.`,
      );
    } catch (error) {
      setRunAutoCuratorError(
        error instanceof Error
          ? error.message
          : "Не удалось запустить Auto Curator Engine.",
      );
      setNotice("");
    } finally {
      setRunningAutoCuratorPreview(false);
      setApplyingRunAutoCurator(false);
    }
  }

  async function runAutoModeratorReport(apply = false) {
    if (!selectedVerse) {
      setCardsError("Сначала выбери стих.");
      return;
    }

    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    setAutoModeratorReport(null);
    setAutoModeratorReportError("");

    if (apply) {
      setApplyingAutoModeratorRouting(true);
      setNotice("Автомодератор создаёт очередь исключений...");
    } else {
      setRunningAutoModeratorReport(true);
      setNotice("GPT-5.5 проверяет здоровье набора...");
    }

    try {
      const response = await fetch("/api/admin/studio/auto-moderator-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: selectedVerse.reference,
          canonical_ref: selectedVerse.canonical_ref,
          book_key: selectedVerse.book_key,
          book: selectedVerse.book,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse,
          lang,
          maxCards: 100,
          apply,
        }),
      });

      const data = (await response.json()) as AutoModeratorReportResponse;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Не удалось проверить набор.");
      }

      setAutoModeratorReport(data);

      const health = data.report?.health_score;
      const queueCount = data.inserted_editorial_suggestion_count ?? 0;
      setNotice(
        apply
          ? `Маршрутизация готова: в очередь создано ${queueCount}.`
          : `Проверка набора готова${
              typeof health === "number" ? `: health ${health}` : ""
            }.`,
      );

      if (apply) {
        await loadEditorialSuggestions(selectedVerse);
      }
    } catch (error) {
      setAutoModeratorReport(null);
      setAutoModeratorReportError(
        error instanceof Error ? error.message : "Не удалось проверить набор.",
      );
      setNotice("");
    } finally {
      setRunningAutoModeratorReport(false);
      setApplyingAutoModeratorRouting(false);
    }
  }

  async function applyGroupStatusLocally(
    card: StudioCard,
    status: GroupStatus,
    message: string,
  ) {
    setCards((prevCards) => {
      const nextCards = sortStudioCards(
        prevCards.map((current) => {
          if (current.id !== card.id) return current;

          return {
            ...current,
            status,
            moderator_decision:
              status === "hidden"
                ? "group_hide_from_studio"
                : status === "rejected"
                  ? "group_reject_from_studio"
                  : status === "reserve"
                    ? "group_restore_reserve_from_studio"
                    : "group_force_featured_from_studio",
            moderator_reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }),
      );

      setCardsSummary(summarizeCards(nextCards));
      return nextCards;
    });

    setNotice(message);

    if (selectedVerse) {
      await loadCards(selectedVerse);
    }
  }

  async function updateAngleCardEditorial(
    card: StudioCard,
    patch: {
      moderator_boost?: number;
      status?: string;
      is_locked?: boolean;
      moderator_note?: string | null;
      moderator_decision?: string | null;
    },
  ) {
    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    setUpdatingEditorial((prev) => ({ ...prev, [card.id]: true }));
    setCardsError("");

    try {
      const response = await fetch("/api/admin/studio/update-angle-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          card_id: card.id,
          ...patch,
        }),
      });

      const data = (await response.json()) as UpdateAngleCardResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось обновить карточку.");
      }

      setCards((prevCards) => {
        const nextCards = sortStudioCards(
          prevCards.map((current) => {
            if (current.id !== card.id) return current;

            return {
              ...current,
              status:
                typeof data.card?.status === "string"
                  ? data.card.status
                  : patch.status ?? current.status,
              is_locked:
                typeof data.card?.is_locked === "boolean"
                  ? data.card.is_locked
                  : typeof patch.is_locked === "boolean"
                    ? patch.is_locked
                    : current.is_locked,
              moderator_boost:
                typeof data.card?.moderator_boost === "number"
                  ? data.card.moderator_boost
                  : typeof patch.moderator_boost === "number"
                    ? patch.moderator_boost
                    : current.moderator_boost ?? 0,
              moderator_note:
                data.card?.moderator_note !== undefined
                  ? data.card.moderator_note ?? null
                  : patch.moderator_note !== undefined
                    ? patch.moderator_note
                    : current.moderator_note ?? null,
              moderator_decision:
                data.card?.moderator_decision !== undefined
                  ? data.card.moderator_decision ?? null
                  : patch.moderator_decision !== undefined
                    ? patch.moderator_decision
                    : current.moderator_decision ?? null,
              moderator_reviewed_at:
                typeof data.card?.moderator_reviewed_at === "string"
                  ? data.card.moderator_reviewed_at
                  : new Date().toISOString(),
              updated_at:
                typeof data.card?.updated_at === "string"
                  ? data.card.updated_at
                  : new Date().toISOString(),
            };
          }),
        );

        setCardsSummary(summarizeCards(nextCards));
        return nextCards;
      });

      const updatedBoost =
        typeof data.card?.moderator_boost === "number"
          ? data.card.moderator_boost
          : patch.moderator_boost;

      const boostText =
        typeof updatedBoost === "number" ? ` Буст: ${updatedBoost > 0 ? "+" : ""}${updatedBoost}.` : "";

      setNotice(`Карточка обновлена.${boostText}`);
    } catch (error) {
      setCardsError(error instanceof Error ? error.message : "Не удалось обновить карточку.");
      setNotice("");
    } finally {
      setUpdatingEditorial((prev) => ({ ...prev, [card.id]: false }));
    }
  }

  async function adjustModeratorBoost(card: StudioCard, delta: number) {
    const currentBoost = getModeratorBoost(card);
    const nextBoost = Math.max(-30, Math.min(30, currentBoost + delta));

    await updateAngleCardEditorial(card, {
      moderator_boost: nextBoost,
      moderator_decision: delta > 0 ? `boost_plus_${delta}` : `boost_minus_${Math.abs(delta)}`,
    });
  }

  async function setModeratorBoost(card: StudioCard, boost: number) {
    const nextBoost = Math.max(-30, Math.min(30, Math.round(boost)));

    await updateAngleCardEditorial(card, {
      moderator_boost: nextBoost,
      moderator_decision: "boost_set",
    });
  }

  async function updateModeratorNote(card: StudioCard) {
    const current = card.moderator_note ?? "";
    const next = window.prompt("Заметка модератора для этой карточки:", current);

    if (next === null) return;

    await updateAngleCardEditorial(card, {
      moderator_note: next.trim() ? next.trim() : null,
      moderator_decision: "moderator_note",
    });
  }

  async function reEvaluateCard(card: StudioCard) {
    if (!selectedVerse) {
      setCardsError("Сначала выбери стих.");
      return;
    }

    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    setReEvaluations((prev) => ({
      ...prev,
      [card.id]: {
        ...createEmptyReEvaluateState(prev[card.id]),
        loading: true,
        applied: false,
      },
    }));

    setNotice(`Переоцениваю карточку: ${card.title}`);

    try {
      const response = await fetch("/api/admin/studio/re-evaluate-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: selectedVerse.reference,
          canonical_ref: selectedVerse.canonical_ref,
          lang,
          provider: "openai",
          candidate: {
            id: card.id,
            title: card.title,
            anchor: card.anchor,
            teaser: card.teaser,
            why_it_matters: card.why_it_matters,
            score_total: card.score_total,
            status: card.status,
            is_locked: card.is_locked ?? false,
            angle_summary: card.angle_summary,
          },
          targetFeaturedCount: 12,
        }),
      });

      const data = (await response.json()) as ReEvaluateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось переоценить карточку.");
      }

      setReEvaluations((prev) => ({
        ...prev,
        [card.id]: {
          loading: false,
          applying: false,
          applied: false,
          error: "",
          applyError: "",
          result: data,
        },
      }));

      const newScore = getEvaluationScore(data);
      const placement = getEvaluationPlacement(data);

      setNotice(
        `Переоценка готова: ${
          newScore === null ? "без score" : `score ${newScore}`
        }${placement ? ` / ${placement}` : ""}.`,
      );
    } catch (error) {
      setReEvaluations((prev) => ({
        ...prev,
        [card.id]: {
          ...createEmptyReEvaluateState(prev[card.id]),
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось переоценить карточку.",
        },
      }));
      setNotice("");
    }
  }

  async function applyEvaluation(card: StudioCard) {
    const state = reEvaluations[card.id];

    if (!state?.result?.evaluation) {
      setCardsError("Сначала сделай переоценку карточки.");
      return;
    }

    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    setReEvaluations((prev) => ({
      ...prev,
      [card.id]: {
        ...createEmptyReEvaluateState(prev[card.id]),
        result: prev[card.id]?.result ?? null,
        applying: true,
      },
    }));

    setNotice(`Применяю новую оценку: ${card.title}`);

    try {
      const response = await fetch("/api/admin/studio/apply-card-evaluation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          card_id: card.id,
          evaluation: state.result.evaluation,
        }),
      });

      const data = (await response.json()) as ApplyEvaluationResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось применить оценку.");
      }

      setCards((prevCards) => {
        const nextCards = sortStudioCards(
          prevCards.map((current) => {
            if (current.id !== card.id) return current;

            return {
              ...current,
              score_total:
                typeof data.applied?.score_total === "number"
                  ? data.applied.score_total
                  : current.score_total,
              status: data.applied?.status ?? current.status,
              rank:
                typeof data.applied?.rank === "number" || data.applied?.rank === null
                  ? data.applied.rank
                  : current.rank,
              coverage_type:
                data.applied?.coverage_type === undefined
                  ? current.coverage_type
                  : data.applied.coverage_type,
              angle_summary:
                data.applied?.angle_summary === undefined
                  ? current.angle_summary
                  : data.applied.angle_summary,
              updated_at:
                typeof data.card?.updated_at === "string"
                  ? data.card.updated_at
                  : new Date().toISOString(),
            };
          }),
        );

        setCardsSummary(summarizeCards(nextCards));
        return nextCards;
      });

      setReEvaluations((prev) => ({
        ...prev,
        [card.id]: {
          loading: false,
          applying: false,
          applied: true,
          error: "",
          applyError: "",
          result: prev[card.id]?.result ?? null,
        },
      }));

      setNotice("Новая оценка применена. База обновлена.");
    } catch (error) {
      setReEvaluations((prev) => ({
        ...prev,
        [card.id]: {
          ...createEmptyReEvaluateState(prev[card.id]),
          result: prev[card.id]?.result ?? null,
          applying: false,
          applyError:
            error instanceof Error ? error.message : "Не удалось применить оценку.",
        },
      }));
      setNotice("");
    }
  }

  async function retranslateCard(card: StudioCard) {
    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    setRetranslations((prev) => ({
      ...prev,
      [card.id]: {
        loading: true,
        applied: false,
        error: "",
      },
    }));

    setNotice(`Перевожу заново карточку: ${card.title}`);

    try {
      const response = await fetch("/api/admin/studio/retranslate-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          card_id: card.id,
          target_lang: lang,
        }),
      });

      const data = (await response.json()) as RetranslateCardResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось перевести карточку заново.");
      }

      setCards((prevCards) => {
        const nextCards = prevCards.map((current) => {
          if (current.id !== card.id) return current;

          return {
            ...current,
            title:
              typeof data.updated_fields?.title === "string"
                ? data.updated_fields.title
                : typeof data.card?.title === "string"
                  ? data.card.title
                  : current.title,
            anchor:
              data.updated_fields?.anchor !== undefined
                ? data.updated_fields.anchor ?? null
                : data.card?.anchor !== undefined
                  ? data.card.anchor ?? null
                  : current.anchor,
            teaser:
              typeof data.updated_fields?.teaser === "string"
                ? data.updated_fields.teaser
                : typeof data.card?.teaser === "string"
                  ? data.card.teaser
                  : current.teaser,
            why_it_matters:
              data.updated_fields?.why_it_matters !== undefined
                ? data.updated_fields.why_it_matters ?? null
                : data.card?.why_it_matters !== undefined
                  ? data.card.why_it_matters ?? null
                  : current.why_it_matters,
            updated_at:
              typeof data.card?.updated_at === "string"
                ? data.card.updated_at
                : new Date().toISOString(),
          };
        });

        return nextCards;
      });

      setRetranslations((prev) => ({
        ...prev,
        [card.id]: {
          loading: false,
          applied: true,
          error: "",
        },
      }));

      setNotice("Карточка переведена заново. Текст обновлён.");
    } catch (error) {
      setRetranslations((prev) => ({
        ...prev,
        [card.id]: {
          loading: false,
          applied: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось перевести карточку заново.",
        },
      }));
      setNotice("");
    }
  }

  function updateRewriteMode(cardId: string, rewriteMode: RewriteMode) {
    setRewrites((prev) => ({
      ...prev,
      [cardId]: {
        ...createEmptyRewriteState(prev[cardId]),
        rewriteMode,
        preserveOriginalMeta: false,
        result: null,
        applied: false,
        error: "",
        applyError: "",
      },
    }));
  }

  function updateRewriteInstruction(cardId: string, instruction: string) {
    setRewrites((prev) => ({
      ...prev,
      [cardId]: {
        ...createEmptyRewriteState(prev[cardId]),
        instruction,
      },
    }));
  }

  function updateRewriteExtraMaterial(cardId: string, extraMaterial: string) {
    setRewrites((prev) => ({
      ...prev,
      [cardId]: {
        ...createEmptyRewriteState(prev[cardId]),
        extraMaterial,
      },
    }));
  }

  async function previewRewrite(card: StudioCard) {
    const state = rewrites[card.id] ?? createEmptyRewriteState();

    if (!state.instruction.trim()) {
      setCardsError("Напиши инструкцию для доработки карточки.");
      return;
    }

    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    setRewrites((prev) => ({
      ...prev,
      [card.id]: {
        ...createEmptyRewriteState(prev[card.id]),
        rewriteMode: state.rewriteMode,
        instruction: state.instruction,
        extraMaterial: state.extraMaterial,
        preserveOriginalMeta: state.preserveOriginalMeta,
        loading: true,
        applied: false,
      },
    }));

    setNotice(`Готовлю доработку карточки: ${card.title}`);

    try {
      const response = await fetch("/api/admin/studio/rewrite-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          card_id: card.id,
          lang,
          provider: "openai",
          rewrite_mode: state.rewriteMode,
          instruction: state.instruction,
          extra_material: state.extraMaterial,
          soft_patch_mode: state.preserveOriginalMeta,
          preserve_original_score: state.preserveOriginalMeta,
          preserve_original_status: state.preserveOriginalMeta,
        }),
      });

      const data = (await response.json()) as RewriteCardResponse;

      if (!response.ok || !data.ok || !data.rewritten_card || !data.evaluation) {
        throw new Error(data.error || "Не удалось подготовить доработку.");
      }

      setRewrites((prev) => ({
        ...prev,
        [card.id]: {
          rewriteMode: state.rewriteMode,
          instruction: state.instruction,
          extraMaterial: state.extraMaterial,
          preserveOriginalMeta: state.preserveOriginalMeta,
          loading: false,
          applying: false,
          applied: false,
          error: "",
          applyError: "",
          result: data,
        },
      }));

      const newScore = getEvaluationScore(data);
      const placement = getEvaluationPlacement(data);

      setNotice(
        state.preserveOriginalMeta
          ? `Мягкий patch готов. Исходные score/status будут сохранены: ${card.score_total ?? "—"} / ${readableCardStatus(card.status)}.`
          : `Доработка готова: ${
              newScore === null ? "без score" : `score ${newScore}`
            }${placement ? ` / ${placement}` : ""}.`,
      );
    } catch (error) {
      setRewrites((prev) => ({
        ...prev,
        [card.id]: {
          ...createEmptyRewriteState(prev[card.id]),
          rewriteMode: state.rewriteMode,
          instruction: state.instruction,
          extraMaterial: state.extraMaterial,
          preserveOriginalMeta: state.preserveOriginalMeta,
          loading: false,
          error:
            error instanceof Error ? error.message : "Не удалось подготовить доработку.",
        },
      }));
      setNotice("");
    }
  }

  function findPendingSuggestionForCard(cardId: string): EditorialSuggestion | null {
    const suggestions = editorialSuggestions?.suggestions ?? [];

    const feedbackMatch = Object.entries(queueActionFeedback).find(([, feedback]) => {
      return (
        feedback.targetCardId === cardId &&
        (feedback.action === "soft_rewrite" || feedback.action === "accept")
      );
    });

    if (feedbackMatch) {
      const suggestion = suggestions.find((item) => item.id === feedbackMatch[0]);
      if (suggestion && suggestion.status === "pending") return suggestion;
    }

    return (
      suggestions.find((suggestion) => {
        if (suggestion.status !== "pending") return false;
        return getSuggestionTargetCardIds(suggestion).includes(cardId);
      }) ?? null
    );
  }

  function removeEditorialSuggestionFromCurrentQueue(suggestionId: string) {
    setEditorialSuggestions((prev) => {
      if (!prev?.suggestions) return prev;

      const currentSuggestions = prev.suggestions;
      const removed = currentSuggestions.find((item) => item.id === suggestionId);

      if (!removed) return prev;

      const nextSuggestions = currentSuggestions.filter(
        (item) => item.id !== suggestionId,
      );

      const nextStatuses = prev.summary?.statuses
        ? {
            ...prev.summary.statuses,
            pending: Math.max((prev.summary.statuses.pending ?? 0) - 1, 0),
            applied: (prev.summary.statuses.applied ?? 0) + 1,
          }
        : undefined;

      return {
        ...prev,
        count: nextSuggestions.length,
        summary: prev.summary
          ? {
              ...prev.summary,
              statuses: nextStatuses ?? prev.summary.statuses,
            }
          : prev.summary,
        suggestions: nextSuggestions,
      };
    });

    setQueueResolutions((prev) => {
      const next = { ...prev };
      delete next[suggestionId];
      return next;
    });

    setQueueActionFeedback((prev) => {
      const next = { ...prev };
      delete next[suggestionId];
      return next;
    });
  }

  async function markEditorialSuggestionAppliedAfterPatch(args: {
    suggestionId: string;
    cardTitle: string;
  }): Promise<boolean> {
    try {
      const response = await fetch("/api/admin/studio/editorial-suggestions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          id: args.suggestionId,
          status: "applied",
          moderator_decision: "soft_patch_applied",
          review_note: `Мягкая правка применена к карточке “${args.cardTitle}”. Score/status сохранены.`,
          reviewed_by: "studio",
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Не удалось закрыть задачу очереди после мягкой правки.",
        );
      }

      removeEditorialSuggestionFromCurrentQueue(args.suggestionId);
      return true;
    } catch (error) {
      setEditorialSuggestionsError(
        error instanceof Error
          ? error.message
          : "Мягкая правка применена, но задачу очереди не удалось закрыть.",
      );
      return false;
    }
  }

  async function markEditorialSuggestionReviewed(args: {
    suggestion: EditorialSuggestion;
    status: "ignored" | "archived";
    moderatorDecision: string;
    reviewNote: string;
    notice: string;
    feedbackMessage: string;
    feedbackKind: "success" | "info" | "warning";
    localResolution: EditorialQueueLocalResolution;
  }) {
    if (!adminSecret.trim()) {
      setEditorialSuggestionsError("Вставь Admin Secret.");
      return;
    }

    setQueueActionFeedback((prev) => ({
      ...prev,
      [args.suggestion.id]: {
        action: args.status === "ignored" ? "keep" : "defer",
        kind: args.feedbackKind,
        message: "Сохраняю решение...",
      },
    }));

    try {
      const response = await fetch("/api/admin/studio/editorial-suggestions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          id: args.suggestion.id,
          status: args.status,
          moderator_decision: args.moderatorDecision,
          review_note: args.reviewNote,
          reviewed_by: "studio",
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Не удалось сохранить решение очереди.");
      }

      removeEditorialSuggestionFromCurrentQueue(args.suggestion.id);

      setQueueResolutions((prev) => ({
        ...prev,
        [args.suggestion.id]: args.localResolution,
      }));

      setQueueActionFeedback((prev) => ({
        ...prev,
        [args.suggestion.id]: {
          action: args.status === "ignored" ? "keep" : "defer",
          kind: args.feedbackKind,
          message: args.feedbackMessage,
        },
      }));

      setNotice(args.notice);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось сохранить решение очереди.";

      setQueueActionFeedback((prev) => ({
        ...prev,
        [args.suggestion.id]: {
          action: args.status === "ignored" ? "keep" : "defer",
          kind: "warning",
          message,
        },
      }));
      setEditorialSuggestionsError(message);
    }
  }

  async function applyRewrite(card: StudioCard) {
    const state = rewrites[card.id];

    if (!state?.result?.rewritten_card || !state.result.evaluation) {
      setCardsError("Сначала сделай вариант доработки.");
      return;
    }

    if (!adminSecret.trim()) {
      setCardsError("Вставь Admin Secret.");
      return;
    }

    const preserveOriginalMeta = state.preserveOriginalMeta === true;
    const evaluationForApply = preserveOriginalMeta
      ? buildPreservedRewriteEvaluation(card, state.result.evaluation)
      : state.result.evaluation;

    setRewrites((prev) => ({
      ...prev,
      [card.id]: {
        ...createEmptyRewriteState(prev[card.id]),
        rewriteMode: prev[card.id]?.rewriteMode ?? "polish",
        instruction: prev[card.id]?.instruction ?? "",
        extraMaterial: prev[card.id]?.extraMaterial ?? "",
        preserveOriginalMeta: prev[card.id]?.preserveOriginalMeta ?? preserveOriginalMeta,
        result: prev[card.id]?.result ?? null,
        applying: true,
      },
    }));

    setNotice(
      preserveOriginalMeta
        ? `Применяю мягкую правку RU/EN/ES без изменения score/status: ${card.title}`
        : `Применяю доработку RU/EN/ES: ${card.title}`,
    );

    try {
      const response = await fetch("/api/admin/studio/apply-card-rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          card_id: card.id,
          lang,
          rewritten_card: state.result.rewritten_card,
          evaluation: evaluationForApply,
          soft_patch_mode: preserveOriginalMeta,
          preserve_original_score: preserveOriginalMeta,
          preserve_original_status: preserveOriginalMeta,
        }),
      });

      const data = (await response.json()) as ApplyRewriteResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось применить доработку.");
      }

      setCards((prevCards) => {
        const nextCards = sortStudioCards(
          prevCards.map((current) => {
            if (current.id !== card.id) return current;

            return {
              ...current,
              title:
                typeof data.card?.title === "string"
                  ? data.card.title
                  : state.result?.rewritten_card?.title ?? current.title,
              anchor:
                data.card?.anchor !== undefined
                  ? data.card.anchor ?? null
                  : state.result?.rewritten_card?.anchor ?? current.anchor,
              teaser:
                typeof data.card?.teaser === "string"
                  ? data.card.teaser
                  : state.result?.rewritten_card?.teaser ?? current.teaser,
              why_it_matters:
                data.card?.why_it_matters !== undefined
                  ? data.card.why_it_matters ?? null
                  : state.result?.rewritten_card?.why_it_matters ?? current.why_it_matters,
              score_total: preserveOriginalMeta
                ? current.score_total
                : typeof data.applied?.score_total === "number"
                  ? data.applied.score_total
                  : current.score_total,
              status: preserveOriginalMeta ? current.status : data.applied?.status ?? current.status,
              rank: preserveOriginalMeta
                ? current.rank
                : typeof data.applied?.rank === "number" || data.applied?.rank === null
                  ? data.applied.rank
                  : current.rank,
              coverage_type: preserveOriginalMeta
                ? current.coverage_type
                : data.applied?.coverage_type === undefined
                  ? current.coverage_type
                  : data.applied.coverage_type,
              angle_summary: preserveOriginalMeta
                ? current.angle_summary
                : data.applied?.angle_summary === undefined
                  ? current.angle_summary
                  : data.applied.angle_summary,
              updated_at:
                typeof data.card?.updated_at === "string"
                  ? data.card.updated_at
                  : new Date().toISOString(),
            };
          }),
        );

        setCardsSummary(summarizeCards(nextCards));
        return nextCards;
      });

      setRewrites((prev) => ({
        ...prev,
        [card.id]: {
          rewriteMode: prev[card.id]?.rewriteMode ?? "polish",
          instruction: prev[card.id]?.instruction ?? "",
          extraMaterial: prev[card.id]?.extraMaterial ?? "",
          preserveOriginalMeta: prev[card.id]?.preserveOriginalMeta ?? preserveOriginalMeta,
          loading: false,
          applying: false,
          applied: true,
          error: "",
          applyError: "",
          result: prev[card.id]?.result ?? null,
        },
      }));

      let queueClosed = false;
      const relatedSuggestion =
        preserveOriginalMeta && data.ok ? findPendingSuggestionForCard(card.id) : null;

      if (relatedSuggestion) {
        queueClosed = await markEditorialSuggestionAppliedAfterPatch({
          suggestionId: relatedSuggestion.id,
          cardTitle: card.title,
        });
      }

      setNotice(
        preserveOriginalMeta
          ? queueClosed
            ? "Мягкая правка применена. RU/EN/ES версии обновлены, исходные score/status сохранены. Задача очереди закрыта."
            : "Мягкая правка применена. RU/EN/ES версии обновлены, исходные score/status сохранены."
          : "Доработка применена. RU/EN/ES версии обновлены.",
      );
    } catch (error) {
      setRewrites((prev) => ({
        ...prev,
        [card.id]: {
          ...createEmptyRewriteState(prev[card.id]),
          rewriteMode: prev[card.id]?.rewriteMode ?? "polish",
          instruction: prev[card.id]?.instruction ?? "",
          extraMaterial: prev[card.id]?.extraMaterial ?? "",
          preserveOriginalMeta: prev[card.id]?.preserveOriginalMeta ?? preserveOriginalMeta,
          result: prev[card.id]?.result ?? null,
          applying: false,
          applyError:
            error instanceof Error ? error.message : "Не удалось применить доработку.",
        },
      }));
      setNotice("");
    }
  }

  function findSuggestionTargetCard(suggestion: EditorialSuggestion): StudioCard | null {
    const targetIds = getSuggestionTargetCardIds(suggestion);

    for (const id of targetIds) {
      const card = cards.find((item) => item.id === id);
      if (card) return card;
    }

    return null;
  }

  function handleEditorialSuggestionAction(
    suggestion: EditorialSuggestion,
    action: EditorialQueueAction,
  ) {
    if (action === "keep") {
      void markEditorialSuggestionReviewed({
        suggestion,
        status: "ignored",
        moderatorDecision: "keep_as_is",
        reviewNote:
          "Модератор оставил карточку как есть. Действий с карточкой не требуется.",
        notice: "Решение сохранено: карточку оставляем как есть. Задача закрыта.",
        feedbackMessage:
          "Решение сохранено на сервере: карточку оставляем как есть. Задача больше не будет висеть в pending.",
        feedbackKind: "success",
        localResolution: "kept",
      });
      return;
    }

    if (action === "defer") {
      void markEditorialSuggestionReviewed({
        suggestion,
        status: "archived",
        moderatorDecision: "deferred",
        reviewNote:
          "Модератор отложил задачу. Карточка не изменена; к вопросу можно вернуться позже через archived/all.",
        notice: "Задача отложена и убрана из pending.",
        feedbackMessage:
          "Задача отложена на сервере и убрана из pending. Карточка не изменилась.",
        feedbackKind: "info",
        localResolution: "deferred",
      });
      return;
    }

    const targetCard = findSuggestionTargetCard(suggestion);

    if (!targetCard) {
      const message =
        action === "accept"
          ? "Рекомендация принята как пункт проверки, но связанная карточка не найдена в текущем списке. Обнови карточки или открой связанный стих."
          : "Не нашёл связанную карточку для мягкой правки в текущем списке.";

      setQueueActionFeedback((prev) => ({
        ...prev,
        [suggestion.id]: {
          action,
          kind: "warning",
          message,
        },
      }));
      setNotice(message);
      return;
    }

    const instruction = buildSoftRewriteInstruction(suggestion);

    setRewrites((prev) => ({
      ...prev,
      [targetCard.id]: {
        ...createEmptyRewriteState(prev[targetCard.id]),
        rewriteMode: "polish",
        instruction,
        extraMaterial: suggestion.source_summary ?? suggestion.reason ?? "",
        preserveOriginalMeta: true,
        result: null,
        applied: false,
        error: "",
        applyError: "",
      },
    }));

    const message =
      action === "accept"
        ? `Рекомендация принята: инструкция для мягкой правки добавлена к карточке “${targetCard.title}”.`
        : `Мягкая правка подготовлена для карточки “${targetCard.title}”. Инструкция уже вставлена в блок доработки ниже.`;

    setQueueActionFeedback((prev) => ({
      ...prev,
      [suggestion.id]: {
        action,
        kind: "success",
        message,
        targetCardId: targetCard.id,
        targetCardTitle: targetCard.title,
        instruction,
      },
    }));

    setNotice(message);

    window.setTimeout(() => {
      const el = document.getElementById(`studio-card-${targetCard.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  async function changeDays(nextDays: number) {
    setDays(nextDays);
    setCardsError("");
    await loadRecentVerses(nextDays);
  }

  function displayReference(verse: VerseSummary): string {
    return (
      formatReference({
        bookKey: verse.book_key,
        chapter: verse.chapter,
        verse: verse.verse,
        lang,
      }) ?? verse.reference
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `${PAGE_GLOW}, ${BG}`,
        color: INK,
        padding: "24px 14px 84px",
        fontFamily:
          'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes studio-shimmer {
          0% { background-position: 220% 0; }
          100% { background-position: -220% 0; }
        }
        @keyframes studio-fade-up {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .studio-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.84fr) minmax(0, 1.16fr);
          gap: 16px;
        }
        @media (max-width: 760px) {
          .studio-layout {
            grid-template-columns: 1fr;
          }
        }
        .studio-card-enter {
          animation: studio-fade-up 180ms ease;
        }
        summary::-webkit-details-marker {
          display: none;
        }
      `}</style>

      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: SLATE_DARK,
              fontWeight: 900,
              marginBottom: 8,
            }}
          >
            Scriptura Studio
          </div>

          <h1
            style={{
              fontFamily:
                'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
              fontSize: 32,
              lineHeight: 1.08,
              margin: 0,
              letterSpacing: "-0.03em",
              color: INK,
            }}
          >
            Живая работа системы
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: MUTED,
              fontSize: 15,
              lineHeight: 1.6,
              maxWidth: 760,
            }}
          >
            Здесь видно, какие стихи недавно получили жемчужины, откуда они пришли,
            какие карточки активны, что лежит в запасе и что уже стоит доработать.
          </p>
        </header>

        <section
          style={{
            background: `linear-gradient(180deg, ${PAPER} 0%, ${PANEL} 100%)`,
            border: `1px solid ${LINE}`,
            borderRadius: 24,
            padding: 16,
            boxShadow:
              "0 1px 2px rgba(42, 31, 22, 0.05), 0 16px 36px rgba(42, 31, 22, 0.08)",
            marginBottom: 16,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 10,
            }}
          >
            Admin Secret
          </label>

          <input
            value={adminSecret}
            onChange={(event) => saveSecret(event.target.value)}
            type="password"
            placeholder="Вставь ADMIN_SECRET"
            style={{
              width: "100%",
              border: `1px solid ${LINE}`,
              borderRadius: 16,
              padding: "13px 15px",
              background: CARD,
              color: INK,
              fontSize: 15,
              boxSizing: "border-box",
              outlineColor: SLATE,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <button
              type="button"
              disabled={loadingVerses}
              onClick={() => changeDays(1)}
              style={getButtonStyle(days === 1, loadingVerses)}
            >
              Сегодня
            </button>

            <button
              type="button"
              disabled={loadingVerses}
              onClick={() => changeDays(7)}
              style={getButtonStyle(days === 7, loadingVerses)}
            >
              7 дней
            </button>

            <button
              type="button"
              disabled={loadingVerses}
              onClick={() => changeDays(30)}
              style={getButtonStyle(days === 30, loadingVerses)}
            >
              30 дней
            </button>

            <select
              value={lang}
              onChange={(event) => setLang(event.target.value as Lang)}
              disabled={loadingVerses}
              style={{
                border: `1px solid rgba(111, 123, 136, 0.24)`,
                borderRadius: 999,
                background: SLATE_SOFT_2,
                color: SLATE_DARK,
                padding: "10px 13px",
                fontWeight: 800,
                fontFamily: "inherit",
                cursor: loadingVerses ? "not-allowed" : "pointer",
              }}
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>

            <button
              type="button"
              disabled={loadingVerses}
              onClick={() => loadRecentVerses(days)}
              style={{ ...getButtonStyle(true, loadingVerses), marginLeft: "auto" }}
            >
              {loadingVerses ? "Загружаю..." : "Обновить"}
            </button>
          </div>

          {notice ? (
            <div
              className="studio-card-enter"
              style={{
                marginTop: 14,
                padding: "11px 13px",
                borderRadius: 14,
                background: SLATE_SOFT,
                border: `1px solid rgba(111, 123, 136, 0.14)`,
                color: SLATE_DARK,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {notice}
            </div>
          ) : null}

          {versesError ? (
            <div
              className="studio-card-enter"
              style={{
                marginTop: 14,
                padding: "11px 13px",
                borderRadius: 14,
                background: ERROR_BG,
                border: `1px solid rgba(139, 62, 46, 0.14)`,
                color: ERROR_TEXT,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {versesError}
            </div>
          ) : null}
        </section>

        <div className="studio-layout">
          <section
            style={{
              background: `linear-gradient(180deg, ${PAPER} 0%, ${PANEL} 100%)`,
              border: `1px solid ${LINE}`,
              borderRadius: 24,
              padding: 14,
              boxShadow:
                "0 1px 2px rgba(42, 31, 22, 0.05), 0 16px 36px rgba(42, 31, 22, 0.08)",
              minHeight: 320,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  margin: 0,
                  fontFamily:
                    'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                  color: INK,
                }}
              >
                Недавние стихи
              </h2>
              <span style={{ fontSize: 13, color: MUTED }}>{verses.length} найдено</span>
            </div>

            {loadingVerses ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Skeleton width="80%" />
                <Skeleton width="92%" />
                <Skeleton width="65%" />
              </div>
            ) : null}

            {!loadingVerses && verses.length === 0 ? (
              <EmptyBox text='Пока нет загруженной активности. Нажми "Обновить".' />
            ) : null}

            <div style={{ display: "grid", gap: 12 }}>
              {verses.map((verse) => {
                const active = verse.reference === selectedReference;
                const previewSources = splitSourcesForPreview(verse.sources, 3);

                return (
                  <button
                    key={`${verse.lang}-${verse.canonical_ref ?? verse.reference}`}
                    type="button"
                    onClick={() => loadCards(verse)}
                    disabled={loadingCards && active}
                    className="studio-card-enter"
                    style={{
                      textAlign: "left",
                      border: `1px solid ${active ? "rgba(111, 123, 136, 0.5)" : LINE}`,
                      background: active
                        ? `linear-gradient(180deg, ${SLATE_SOFT} 0%, #f2f5f7 100%)`
                        : CARD,
                      borderRadius: 18,
                      padding: 15,
                      cursor: "pointer",
                      color: INK,
                      fontFamily: "inherit",
                      boxShadow: active
                        ? "0 12px 28px rgba(91, 102, 114, 0.12)"
                        : "0 2px 10px rgba(42, 31, 22, 0.04)",
                      transition:
                        "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 16,
                        marginBottom: 9,
                        color: active ? SLATE_DARK : INK,
                        lineHeight: 1.25,
                      }}
                    >
                      {displayReference(verse)}
                      {!verse.canonical_ref ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            color: WARNING_TEXT,
                            background: WARNING_BG,
                            borderRadius: 999,
                            padding: "2px 7px",
                            verticalAlign: "middle",
                          }}
                        >
                          legacy
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                      <Badge text={`${verse.featured_count} ${shortStatusLabel("featured")}`} strong />
                      {verse.reserve_count > 0 ? (
                        <Badge text={`${verse.reserve_count} ${shortStatusLabel("reserve")}`} />
                      ) : null}
                      {verse.best_score !== null ? (
                        <Badge text={`лучшая оценка: ${verse.best_score}`} />
                      ) : null}
                    </div>

                    {previewSources.shown.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        {previewSources.shown.map((source) => (
                          <MiniSourceChip key={source} text={source} />
                        ))}
                        {previewSources.hiddenCount > 0 ? (
                          <MiniSourceChip text={`+${previewSources.hiddenCount} ещё`} />
                        ) : null}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
                      {formatDate(verse.last_activity_at)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            style={{
              background: `linear-gradient(180deg, ${PAPER} 0%, ${PANEL} 100%)`,
              border: `1px solid ${LINE}`,
              borderRadius: 24,
              padding: 14,
              boxShadow:
                "0 1px 2px rgba(42, 31, 22, 0.05), 0 16px 36px rgba(42, 31, 22, 0.08)",
              minHeight: 320,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  margin: 0,
                  fontFamily:
                    'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                  color: INK,
                }}
              >
                {selectedVerse ? displayReference(selectedVerse) : "Карточки стиха"}
              </h2>

              {selectedVerse ? (
                <span style={{ fontSize: 13, color: MUTED }}>
                  {formatDate(selectedVerse.last_activity_at)}
                </span>
              ) : null}
            </div>

            {cardsSummary ? (
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <Badge text={`${cardsSummary.featured} ${shortStatusLabel("featured")}`} strong />
                  {cardsSummary.reserve > 0 ? (
                    <Badge text={`${cardsSummary.reserve} ${shortStatusLabel("reserve")}`} />
                  ) : null}
                  {cardsSummary.hidden > 0 ? (
                    <Badge text={`${cardsSummary.hidden} ${shortStatusLabel("hidden")}`} />
                  ) : null}
                  {cardsSummary.rejected > 0 ? (
                    <Badge text={`${cardsSummary.rejected} ${shortStatusLabel("rejected")}`} />
                  ) : null}
                  {cardsSummary.best_score !== null ? (
                    <Badge text={`лучшая оценка: ${cardsSummary.best_score}`} />
                  ) : null}

                  {hiddenRejectedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowRejected((value) => !value)}
                      style={getToggleRejectedButtonStyle(showRejected)}
                    >
                      {showRejected
                        ? "Скрыть отклонённые"
                        : `Показать отклонённые (${hiddenRejectedCount})`}
                    </button>
                  ) : null}
                </div>

                {cardsSummary.sources.length > 0 ? (
                  <div
                    style={{
                      border: `1px solid ${LINE_SOFT}`,
                      borderRadius: 16,
                      background: CARD_ALT,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: WARM_ACCENT,
                        marginBottom: 8,
                      }}
                    >
                      Источники набора
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {cardsSummary.sources.map((source) => (
                        <MiniSourceChip key={source} text={source} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {!showRejected && hiddenRejectedCount > 0 ? (
                  <MessageBox
                    kind="success"
                    text={`Отклонённые карточки скрыты: ${hiddenRejectedCount}. Их можно открыть кнопкой “Показать отклонённые” и восстановить при необходимости.`}
                  />
                ) : null}
              </div>
            ) : null}

            {selectedVerse ? (
              <section
                className="studio-card-enter"
                style={{
                  border: `1px solid ${LINE_SOFT}`,
                  borderRadius: 18,
                  padding: 14,
                  background: `linear-gradient(180deg, ${SLATE_SOFT_2} 0%, ${CARD_ALT} 100%)`,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: WARM_ACCENT,
                    marginBottom: 8,
                  }}
                >
                  Память стиха
                </div>

                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    lineHeight: 1.18,
                    letterSpacing: "-0.02em",
                    fontFamily:
                      'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                    color: INK,
                  }}
                >
                  Озеро Scriptura
                </h3>

                <p
                  style={{
                    margin: "0 0 12px",
                    color: MUTED,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Здесь видно, какие материалы и наблюдения уже накоплены по этому стиху:
                  статьи, линзы, находки, заметки и будущий deep research.
                </p>

                {loadingResearchMemory ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <Skeleton width="72%" />
                    <Skeleton width="88%" />
                  </div>
                ) : null}

                {researchMemoryError ? (
                  <MessageBox kind="error" text={researchMemoryError} />
                ) : null}

                {!loadingResearchMemory && !researchMemoryError && researchMemory?.summary ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      <Badge
                        text={`Источников: ${researchMemory.summary.sources_count}`}
                        strong
                      />
                      <Badge
                        text={`Заметок: ${researchMemory.summary.notes_count}`}
                        strong
                      />
                    </div>

                    {Object.keys(researchMemory.summary.source_kinds).length > 0 ? (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: WARM_ACCENT,
                            marginBottom: 7,
                          }}
                        >
                          Типы источников
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {Object.entries(researchMemory.summary.source_kinds).map(
                            ([kind, count]) => (
                              <MiniSourceChip key={kind} text={`${kind}: ${count}`} />
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    {Object.keys(researchMemory.summary.note_kinds).length > 0 ? (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: WARM_ACCENT,
                            marginBottom: 7,
                          }}
                        >
                          Типы заметок
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {Object.entries(researchMemory.summary.note_kinds).map(
                            ([kind, count]) => (
                              <MiniSourceChip key={kind} text={`${kind}: ${count}`} />
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    {researchMemory.latest_sources && researchMemory.latest_sources.length > 0 ? (
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: SLATE_DARK,
                            fontSize: 13,
                            fontWeight: 900,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 12 }}>▼</span>
                          Последние источники
                        </summary>

                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {researchMemory.latest_sources.slice(0, 5).map((source) => (
                            <div
                              key={source.id}
                              style={{
                                border: `1px solid ${LINE_SOFT}`,
                                borderRadius: 12,
                                background: CARD,
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color: INK,
                                  lineHeight: 1.35,
                                  marginBottom: 5,
                                }}
                              >
                                {source.title || source.source_type || source.source_kind}
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                <Badge text={source.source_kind} />
                                {source.source_type ? <Badge text={source.source_type} /> : null}
                                <Badge text={`extraction: ${source.extraction_status}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    {researchMemory.latest_notes && researchMemory.latest_notes.length > 0 ? (
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: SLATE_DARK,
                            fontSize: 13,
                            fontWeight: 900,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 12 }}>▼</span>
                          Последние заметки
                        </summary>

                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {researchMemory.latest_notes.slice(0, 5).map((note) => (
                            <div
                              key={note.id}
                              style={{
                                border: `1px solid ${LINE_SOFT}`,
                                borderRadius: 12,
                                background: CARD,
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color: INK,
                                  lineHeight: 1.35,
                                  marginBottom: 5,
                                }}
                              >
                                {note.title || note.kicker || note.note_kind}
                              </div>

                              {note.body_preview ? (
                                <p
                                  style={{
                                    margin: "0 0 7px",
                                    color: MUTED,
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  {note.body_preview}
                                </p>
                              ) : null}

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                <Badge text={note.note_kind} />
                                {note.lens_id ? <Badge text={note.lens_id} /> : null}
                                {note.score !== null ? <Badge text={`score: ${note.score}`} /> : null}
                                <Badge text={note.candidate_status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}

                {!loadingResearchMemory &&
                !researchMemoryError &&
                researchMemory?.summary &&
                researchMemory.summary.sources_count === 0 &&
                researchMemory.summary.notes_count === 0 ? (
                  <EmptyBox text="В Озере пока нет материалов по этому стиху." />
                ) : null}
              </section>
            ) : null}

            {selectedVerse ? (
              <section
                className="studio-card-enter"
                style={{
                  border: `1px solid ${LINE_SOFT}`,
                  borderRadius: 18,
                  padding: 14,
                  background: CARD,
                  marginBottom: 14,
                  boxShadow: "0 1px 2px rgba(42, 31, 22, 0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: WARM_ACCENT,
                    marginBottom: 8,
                  }}
                >
                  Редакторские предложения
                </div>

                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    lineHeight: 1.18,
                    letterSpacing: "-0.02em",
                    fontFamily:
                      'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                    color: INK,
                  }}
                >
                  Очередь решений
                </h3>

                <p
                  style={{
                    margin: "0 0 12px",
                    color: MUTED,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Здесь будут появляться только спорные случаи: возможные замены,
                  сильные кандидаты с риском, неясные дубли и предложения системы.
                  Обычные безопасные углы должны добавляться автоматически.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <button
                    type="button"
                    disabled={loadingEditorialSuggestions}
                    onClick={() =>
                      selectedVerse
                        ? void loadEditorialSuggestions(selectedVerse)
                        : undefined
                    }
                    style={getSmallButtonStyle(loadingEditorialSuggestions)}
                  >
                    {loadingEditorialSuggestions ? "Обновляю..." : "Обновить очередь"}
                  </button>
                </div>

                {loadingEditorialSuggestions ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <Skeleton width="70%" />
                    <Skeleton width="86%" />
                  </div>
                ) : null}

                {editorialSuggestionsError ? (
                  <MessageBox kind="error" text={editorialSuggestionsError} />
                ) : null}

                {!loadingEditorialSuggestions &&
                !editorialSuggestionsError &&
                editorialSuggestions ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      <Badge text={`Pending: ${visibleEditorialSuggestions.length}`} strong />
                      {locallyResolvedSuggestionCount > 0 ? (
                        <MiniSourceChip text={`закрыто в этом просмотре: ${locallyResolvedSuggestionCount}`} />
                      ) : null}
                      {editorialSuggestions.summary?.suggestion_types
                        ? Object.entries(editorialSuggestions.summary.suggestion_types).map(
                            ([kind, count]) => (
                              <MiniSourceChip
                                key={kind}
                                text={`${readableSuggestionType(kind)}: ${count}`}
                              />
                            ),
                          )
                        : null}
                    </div>

                    {visibleEditorialSuggestions.length > 0 ? (
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: SLATE_DARK,
                            fontSize: 13,
                            fontWeight: 900,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 12 }}>▼</span>
                          Показать предложения
                        </summary>

                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {visibleEditorialSuggestions.slice(0, 5).map((suggestion) => {
                            const candidatePreview = getSuggestionCandidatePreview(suggestion);
                            const relationship = readableAngleRelationship(
                              suggestion.angle_relationship,
                            );
                            const localResolution = queueResolutions[suggestion.id];
                            const actionFeedback = queueActionFeedback[suggestion.id];
                            const targetCard = findSuggestionTargetCard(suggestion);

                            return (
                              <div
                                key={suggestion.id}
                                style={{
                                  border: `1px solid ${LINE_SOFT}`,
                                  borderRadius: 12,
                                  background: SLATE_SOFT_2,
                                  padding: 10,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    alignItems: "flex-start",
                                    marginBottom: 6,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 900,
                                      color: INK,
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    {getSuggestionCandidateTitle(suggestion)}
                                  </div>

                                  {suggestion.score_candidate !== null ? (
                                    <span
                                      style={{
                                        minWidth: 38,
                                        height: 34,
                                        borderRadius: 999,
                                        background: `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`,
                                        color: "#fff",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 13,
                                        fontWeight: 900,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {suggestion.score_candidate}
                                    </span>
                                  ) : null}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 6,
                                    marginBottom: candidatePreview || suggestion.reason ? 7 : 0,
                                  }}
                                >
                                  <Badge text={readableSuggestionType(suggestion.suggestion_type)} strong />
                                  {relationship ? <Badge text={relationship} /> : null}
                                  {suggestion.score_existing !== null ? (
                                    <Badge text={`старая: ${suggestion.score_existing}`} />
                                  ) : null}
                                  {suggestion.score_delta !== null ? (
                                    <Badge
                                      text={`delta: ${
                                        suggestion.score_delta > 0 ? "+" : ""
                                      }${suggestion.score_delta}`}
                                    />
                                  ) : null}
                                  {suggestion.risk_level ? (
                                    <Badge text={`risk: ${suggestion.risk_level}`} />
                                  ) : null}
                                  {targetCard ? (
                                    <Badge text="карточка найдена" />
                                  ) : null}
                                  {localResolution === "deferred" ? (
                                    <Badge text="отложено" strong />
                                  ) : null}
                                </div>

                                {candidatePreview ? (
                                  <p
                                    style={{
                                      margin: "0 0 7px",
                                      color: TEXT,
                                      fontSize: 12,
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {candidatePreview}
                                  </p>
                                ) : null}

                                {suggestion.reason ? (
                                  <p
                                    style={{
                                      margin: 0,
                                      color: MUTED,
                                      fontSize: 12,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    <strong style={{ color: SLATE_DARK }}>Причина: </strong>
                                    {suggestion.reason}
                                  </p>
                                ) : null}

                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 7,
                                    marginTop: 10,
                                    paddingTop: 10,
                                    borderTop: `1px solid ${LINE_SOFT}`,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEditorialSuggestionAction(suggestion, "accept")
                                    }
                                    title={getAcceptRecommendationLabel(suggestion)}
                                    style={getApplyButtonStyle(false)}
                                  >
                                    Принять рекомендацию
                                  </button>

                                  <button
                                    type="button"
                                    disabled={!targetCard}
                                    onClick={() =>
                                      handleEditorialSuggestionAction(suggestion, "soft_rewrite")
                                    }
                                    style={getRepairButtonStyle(!targetCard)}
                                  >
                                    Попросить мягкую правку
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEditorialSuggestionAction(suggestion, "keep")
                                    }
                                    style={getSmallButtonStyle(false)}
                                  >
                                    Оставить как есть
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEditorialSuggestionAction(suggestion, "defer")
                                    }
                                    style={getSmallButtonStyle(false)}
                                  >
                                    Отложить
                                  </button>
                                </div>

                                {actionFeedback ? (
                                  <div
                                    style={{
                                      marginTop: 10,
                                      padding: 10,
                                      borderRadius: 12,
                                      border: `1px solid ${
                                        actionFeedback.kind === "warning"
                                          ? "rgba(139, 62, 46, 0.22)"
                                          : "rgba(95, 120, 144, 0.20)"
                                      }`,
                                      background:
                                        actionFeedback.kind === "warning"
                                          ? ERROR_BG
                                          : "rgba(95, 120, 144, 0.08)",
                                      color: TEXT,
                                      fontSize: 12,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    <div style={{ fontWeight: 900, color: SLATE_DARK, marginBottom: 4 }}>
                                      {actionFeedback.action === "soft_rewrite" || actionFeedback.action === "accept"
                                        ? "Действие подготовлено"
                                        : actionFeedback.action === "keep"
                                          ? "Оставлено без изменений"
                                          : "Отложено"}
                                    </div>
                                    <div>{actionFeedback.message}</div>

                                    {actionFeedback.instruction ? (
                                      <details style={{ marginTop: 8 }}>
                                        <summary
                                          style={{
                                            cursor: "pointer",
                                            color: SLATE_DARK,
                                            fontWeight: 900,
                                          }}
                                        >
                                          Показать инструкцию для правки
                                        </summary>
                                        <pre
                                          style={{
                                            whiteSpace: "pre-wrap",
                                            margin: "8px 0 0",
                                            padding: 9,
                                            borderRadius: 10,
                                            background: "rgba(255, 255, 255, 0.58)",
                                            border: `1px solid ${LINE_SOFT}`,
                                            color: MUTED,
                                            fontFamily:
                                              'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
                                            fontSize: 11.5,
                                            lineHeight: 1.45,
                                          }}
                                        >
                                          {actionFeedback.instruction}
                                        </pre>
                                      </details>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ) : (
                      <EmptyBox text="Пока нет редакторских предложений по этому стиху." />
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}

            {loadingCards ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Skeleton width="75%" />
                <Skeleton width="95%" />
                <Skeleton width="62%" />
              </div>
            ) : null}

            {cardsError ? (
              <MessageBox kind="error" text={cardsError} />
            ) : null}

            {!loadingCards && !cardsError && !selectedReference ? (
              <EmptyBox text="Выбери стих слева, чтобы увидеть карточки." />
            ) : null}

            {!loadingCards && !cardsError && selectedReference && cards.length === 0 ? (
              <EmptyBox text="По этому стиху карточки не найдены." />
            ) : null}

            {!loadingCards &&
            !cardsError &&
            selectedReference &&
            cards.length > 0 &&
            visibleCards.length === 0 ? (
              <EmptyBox text="Все карточки этого стиха сейчас скрыты как отклонённые. Нажми “Показать отклонённые”, чтобы открыть их." />
            ) : null}

            {selectedVerse && cards.length > 0 ? (
              <section
                className="studio-card-enter"
                style={{
                  border: `1px solid ${LINE}`,
                  borderRadius: 20,
                  padding: 16,
                  background: `linear-gradient(180deg, ${CARD} 0%, ${PANEL} 100%)`,
                  boxShadow:
                    "0 1px 2px rgba(42, 31, 22, 0.04), 0 12px 26px rgba(42, 31, 22, 0.06)",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: WARM_ACCENT,
                    fontWeight: 900,
                    marginBottom: 8,
                  }}
                >
                  Автоматическая обработка
                </div>

                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 20,
                    lineHeight: 1.18,
                    letterSpacing: "-0.02em",
                    fontFamily:
                      'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                    color: INK,
                  }}
                >
                  Автокуратор
                </h3>

                <p
                  style={{
                    margin: "0 0 12px",
                    color: MUTED,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Автокуратор читает Озеро Scriptura, ищет новые сильные углы,
                  проверяет их через evaluator и принимает безопасное решение:
                  добавить новый самостоятельный угол в активные, сохранить хороший
                  не первослойный вариант в запас, отправить спорный случай в очередь
                  решений или отклонить слабый кандидат. Активные карточки не
                  заменяются без модератора, а решения пишутся в audit log.
                </p>

                <div
                  style={{
                    border: `1px solid rgba(111, 123, 136, 0.24)`,
                    borderRadius: 18,
                    padding: 14,
                    background: `linear-gradient(180deg, ${SLATE_SOFT} 0%, ${SLATE_SOFT_2} 100%)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 950,
                      color: SLATE_DARK,
                      marginBottom: 7,
                    }}
                  >
                    Контур: Озеро → Claude → GPT-5.5 → решение
                  </div>

                  <p
                    style={{
                      margin: "0 0 10px",
                      color: MUTED,
                      fontSize: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    Claude 4.6 генерирует кандидатов из накопленных материалов,
                    GPT-5.5 проверяет качество, риск и близость к существующим
                    карточкам. V2 раскладывает решения на active / reserve / queue / reject:
                    сильное и безопасное идёт в активные, хорошее — в запас,
                    спорное — в очередь, слабое и дубли — в reject log.
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      disabled={runningAutoCuratorPreview || applyingRunAutoCurator || loadingCards}
                      onClick={() => runAutoCuratorEngine(false)}
                      style={getSmallButtonStyle(
                        runningAutoCuratorPreview || applyingRunAutoCurator || loadingCards,
                      )}
                    >
                      {runningAutoCuratorPreview ? "Смотрю..." : "Проверить Озеро"}
                    </button>

                    <button
                      type="button"
                      disabled={runningAutoCuratorPreview || applyingRunAutoCurator || loadingCards}
                      onClick={() => runAutoCuratorEngine(true)}
                      style={getApplyButtonStyle(
                        runningAutoCuratorPreview || applyingRunAutoCurator || loadingCards,
                      )}
                    >
                      {applyingRunAutoCurator ? "Применяю..." : "Запустить автокуратора"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        runningAutoCuratorPreview ||
                        applyingRunAutoCurator ||
                        runningAutoModeratorReport ||
                        applyingAutoModeratorRouting ||
                        loadingCards
                      }
                      onClick={() => runAutoModeratorReport(false)}
                      style={getRepairButtonStyle(
                        runningAutoCuratorPreview ||
                          applyingRunAutoCurator ||
                          runningAutoModeratorReport ||
                          applyingAutoModeratorRouting ||
                          loadingCards,
                      )}
                    >
                      {runningAutoModeratorReport ? "Проверяю..." : "Проверить набор"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        runningAutoCuratorPreview ||
                        applyingRunAutoCurator ||
                        runningAutoModeratorReport ||
                        applyingAutoModeratorRouting ||
                        loadingCards
                      }
                      onClick={() => runAutoModeratorReport(true)}
                      style={getRepairButtonStyle(
                        runningAutoCuratorPreview ||
                          applyingRunAutoCurator ||
                          runningAutoModeratorReport ||
                          applyingAutoModeratorRouting ||
                          loadingCards,
                      )}
                    >
                      {applyingAutoModeratorRouting
                        ? "Маршрутизирую..."
                        : "Создать очередь исключений"}
                    </button>
                  </div>

                  {runAutoCuratorError ? (
                    <MessageBox kind="error" text={runAutoCuratorError} style={{ marginTop: 10 }} />
                  ) : null}

                  {runAutoCuratorResult ? (
                    <>
                      <div
                        style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: CARD,
                        border: `1px solid ${LINE}`,
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 9 }}>
                        <Badge text={`Режим: ${runAutoCuratorResult.mode ?? "—"}`} strong />
                        <Badge text={`Claude: ${runAutoCuratorResult.generator_model ?? "—"}`} />
                        <Badge text={`Evaluator: ${runAutoCuratorResult.evaluator_model ?? "—"}`} />
                        <Badge text={`Источников: ${runAutoCuratorResult.source_count ?? 0}`} />
                        <Badge text={`Заметок: ${runAutoCuratorResult.note_count ?? 0}`} />
                        {runAutoCuratorResult.run_id ? (
                          <Badge text={`run: ${runAutoCuratorResult.run_id.slice(0, 8)}`} strong />
                        ) : null}
                        <Badge
                          text={`active: ${
                            runAutoCuratorResult.auto_add_active_count ??
                            runAutoCuratorResult.auto_add_count ??
                            0
                          }`}
                          strong
                        />
                        <Badge text={`reserve: ${runAutoCuratorResult.auto_add_reserve_count ?? 0}`} strong />
                        <Badge text={`queue: ${runAutoCuratorResult.editorial_suggestion_count ?? 0}`} strong />
                        <Badge text={`reject: ${runAutoCuratorResult.auto_reject_count ?? 0}`} />
                        {runAutoCuratorResult.mode === "apply" ? (
                          <Badge text={`applied/logged: ${runAutoCuratorResult.applied_count ?? 0}`} strong />
                        ) : null}
                      </div>

                      {runAutoCuratorResult.summary ? (
                        <p
                          style={{
                            margin: "0 0 10px",
                            color: MUTED,
                            fontSize: 13,
                            lineHeight: 1.55,
                          }}
                        >
                          {runAutoCuratorResult.summary}
                        </p>
                      ) : null}

                      {runAutoCuratorResult.decisions && runAutoCuratorResult.decisions.length > 0 ? (
                        <div style={{ display: "grid", gap: 9 }}>
                          {runAutoCuratorResult.decisions.map((decision, index) => (
                            <div
                              key={`${decision.candidate.title}-${index}`}
                              style={{
                                border: `1px solid ${decision.error ? "rgba(139, 62, 46, 0.22)" : LINE_SOFT}`,
                                borderRadius: 12,
                                background: decision.error ? ERROR_BG : SLATE_SOFT_2,
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  alignItems: "flex-start",
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 900,
                                    color: INK,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {decision.candidate.title}
                                </div>

                                <span
                                  style={{
                                    minWidth: 38,
                                    height: 34,
                                    borderRadius: 999,
                                    background: getRunDecisionScoreBackground(
                                      decision.recommended_action,
                                    ),
                                    color: "#fff",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 13,
                                    fontWeight: 900,
                                    flexShrink: 0,
                                  }}
                                >
                                  {decision.score_total}
                                </span>
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
                                <Badge text={readableRunAction(decision.recommended_action)} strong />
                                <Badge text={readableAngleRelationship(decision.angle_relationship) ?? "угол: —"} />
                                <Badge text={readableRiskLevel(decision.risk_level)} />
                                {decision.suggestion_type ? (
                                  <Badge text={readableSuggestionType(decision.suggestion_type)} />
                                ) : null}
                                {decision.applied ? <Badge text="applied/logged" strong /> : null}
                                {decision.applied_action ? <Badge text={decision.applied_action} /> : null}
                                {decision.inserted_card_id ? <Badge text="card saved" /> : null}
                                {decision.inserted_suggestion_id ? <Badge text="suggestion saved" /> : null}
                                {decision.audit_decision_id ? (
                                  <Badge text={`audit: ${decision.audit_decision_id.slice(0, 8)}`} />
                                ) : null}
                              </div>

                              {decision.candidate.anchor ? (
                                <p
                                  style={{
                                    margin: "0 0 7px",
                                    color: WARM_ACCENT,
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                    fontStyle: "italic",
                                  }}
                                >
                                  “{decision.candidate.anchor}”
                                </p>
                              ) : null}

                              <p
                                style={{
                                  margin: "0 0 7px",
                                  color: TEXT,
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                }}
                              >
                                {decision.candidate.teaser}
                              </p>

                              <p
                                style={{
                                  margin: "0 0 7px",
                                  color: MUTED,
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                }}
                              >
                                <strong style={{ color: SLATE_DARK }}>
                                  {readableRunActionLong(decision.recommended_action)}:{" "}
                                </strong>
                                {decision.decision_reason}
                              </p>

                              <p
                                style={{
                                  margin: 0,
                                  color: MUTED,
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                }}
                              >
                                <strong style={{ color: SLATE_DARK }}>Evaluator: </strong>
                                {decision.reason}
                              </p>

                              {decision.error ? (
                                <p
                                  style={{
                                    margin: "7px 0 0",
                                    color: ERROR_TEXT,
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                    fontWeight: 800,
                                  }}
                                >
                                  Ошибка: {decision.error}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyBox text="Автокуратор не нашёл новых решений для этого стиха." />
                      )}

                      {runAutoCuratorResult.raw_generation ? (
                        <details style={{ marginTop: 10 }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              color: SLATE_DARK,
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            Показать raw generation
                          </summary>
                          <pre
                            style={{
                              margin: "8px 0 0",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              color: MUTED,
                              fontSize: 11,
                              lineHeight: 1.45,
                            }}
                          >
                            {runAutoCuratorResult.raw_generation}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                    </>
                  ) : null}

                  {autoModeratorReportError ? (
                    <MessageBox
                      kind="error"
                      text={autoModeratorReportError}
                      style={{ marginTop: 10 }}
                    />
                  ) : null}

                  {autoModeratorReport?.report ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: CARD,
                        border: `1px solid ${LINE}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                          marginBottom: 9,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 950,
                              color: SLATE_DARK,
                              marginBottom: 5,
                            }}
                          >
                            Auto Moderator Report
                          </div>

                          <p
                            style={{
                              margin: 0,
                              color: MUTED,
                              fontSize: 13,
                              lineHeight: 1.55,
                            }}
                          >
                            {autoModeratorReport.report.moderator_brief ??
                              autoModeratorReport.report.summary}
                          </p>
                        </div>

                        <span
                          style={{
                            minWidth: 46,
                            height: 42,
                            borderRadius: 999,
                            background: getReportHealthBackground(
                              autoModeratorReport.report.set_status,
                            ),
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 950,
                            flexShrink: 0,
                            boxShadow: "0 10px 20px rgba(91, 102, 114, 0.18)",
                          }}
                        >
                          {autoModeratorReport.report.health_score}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                        {autoModeratorReport.run_id ? (
                          <Badge text={`run: ${autoModeratorReport.run_id.slice(0, 8)}`} strong />
                        ) : null}
                        <Badge
                          text={readableReportStatus(autoModeratorReport.report.set_status)}
                          strong
                        />
                        <Badge text={`active: ${autoModeratorReport.report.active_count}`} />
                        <Badge text={`reserve: ${autoModeratorReport.report.reserve_count}`} />
                        <Badge text={`findings: ${autoModeratorReport.report.findings.length}`} />
                        <Badge text={`audit: ${autoModeratorReport.report.audit_only_count ?? 0}`} />
                        <Badge
                          text={`queue: ${
                            autoModeratorReport.report.create_editorial_suggestion_count ?? 0
                          }`}
                          strong
                        />
                        <Badge text={`human: ${autoModeratorReport.report.human_required_count ?? 0}`} strong />
                        <Badge text={`safe: ${autoModeratorReport.report.auto_apply_safe_count ?? 0}`} />
                        {autoModeratorReport.mode === "apply" ? (
                          <Badge
                            text={`created: ${
                              autoModeratorReport.inserted_editorial_suggestion_count ?? 0
                            }`}
                            strong
                          />
                        ) : null}
                        <Badge text={`Evaluator: ${autoModeratorReport.evaluator_model ?? "—"}`} />
                      </div>

                      {autoModeratorReport.report.findings.length > 0 ? (
                        <div style={{ display: "grid", gap: 9 }}>
                          {autoModeratorReport.report.findings.map((finding, index) => (
                            <div
                              key={`${finding.title}-${index}`}
                              style={{
                                border: `1px solid ${LINE_SOFT}`,
                                borderRadius: 12,
                                background: SLATE_SOFT_2,
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  alignItems: "flex-start",
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 900,
                                    color: INK,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {finding.title}
                                </div>

                                <Badge text={readableFindingSeverity(finding.severity)} strong />
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
                                <Badge text={readableReportFindingType(finding.finding_type)} strong />
                                <Badge text={readableAutomationClass(finding.automation_class)} strong />
                                <Badge text={readableReportAction(finding.recommended_action)} />
                                <Badge text={readableAngleRelationship(finding.angle_relationship) ?? "угол: —"} />
                                <Badge text={readableRiskLevel(finding.risk_level)} />
                                {finding.score_total !== null ? (
                                  <Badge text={`score: ${finding.score_total}`} />
                                ) : null}
                                {finding.audit_decision_id ? (
                                  <Badge text={`audit: ${finding.audit_decision_id.slice(0, 8)}`} />
                                ) : null}
                                {finding.inserted_suggestion_id ? (
                                  <Badge text={`queue: ${finding.inserted_suggestion_id.slice(0, 8)}`} strong />
                                ) : null}
                                {finding.applied_action ? (
                                  <Badge text={finding.applied_action} />
                                ) : null}
                              </div>

                              <p
                                style={{
                                  margin: "0 0 7px",
                                  color: TEXT,
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                }}
                              >
                                {finding.reason}
                              </p>

                              {finding.human_question ? (
                                <p
                                  style={{
                                    margin: "0 0 7px",
                                    color: SLATE_DARK,
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                    fontWeight: 800,
                                  }}
                                >
                                  <strong>Вопрос: </strong>
                                  {finding.human_question}
                                </p>
                              ) : null}

                              {finding.suggested_note ? (
                                <p
                                  style={{
                                    margin: 0,
                                    color: WARM_ACCENT,
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  <strong>Заметка: </strong>
                                  {finding.suggested_note}
                                </p>
                              ) : null}

                              {finding.error ? (
                                <p
                                  style={{
                                    margin: "7px 0 0",
                                    color: "#9f3a2f",
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  <strong>Ошибка: </strong>
                                  {finding.error}
                                </p>
                              ) : null}

                              {finding.primary_card_id || finding.related_card_ids.length > 0 ? (
                                <p
                                  style={{
                                    margin: "7px 0 0",
                                    color: MUTED_2,
                                    fontSize: 11,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  {finding.primary_card_id
                                    ? `primary: ${finding.primary_card_id.slice(0, 8)}`
                                    : ""}
                                  {finding.related_card_ids.length > 0
                                    ? ` related: ${finding.related_card_ids
                                        .map((id) => id.slice(0, 8))
                                        .join(", ")}`
                                    : ""}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyBox text="Auto Moderator не нашёл проблем в текущем наборе." />
                      )}
                    </div>
                  ) : null}

                </div>
              </section>
            ) : null}

            <ManualMaterialBuilder
              selectedVerse={selectedVerse}
              lang={lang}
              adminSecret={adminSecret}
              onNotice={setNotice}
              onError={setCardsError}
            />

            <div style={{ display: "grid", gap: 14 }}>
              {visibleCards.map((card) => {
                const reEval = reEvaluations[card.id] ?? createEmptyReEvaluateState();
                const retranslation = retranslations[card.id] ?? createEmptyRetranslateState();
                const rewrite = rewrites[card.id] ?? createEmptyRewriteState();
                const queueFeedbackForCard = Object.values(queueActionFeedback).find(
                  (item) => item.targetCardId === card.id,
                );

                const newScore = getEvaluationScore(reEval.result);
                const newPlacement = getEvaluationPlacement(reEval.result);
                const reason = getEvaluationReason(reEval.result);
                const risk = getEvaluationRisk(reEval.result);
                const canApply = Boolean(reEval.result?.evaluation && !reEval.applied);

                const rewriteScore = getEvaluationScore(rewrite.result);
                const rewritePlacement = getEvaluationPlacement(rewrite.result);
                const rewriteReason = getEvaluationReason(rewrite.result);
                const rewriteRisk = getEvaluationRisk(rewrite.result);
                const canApplyRewrite = Boolean(
                  rewrite.result?.rewritten_card &&
                    rewrite.result.evaluation &&
                    !rewrite.applied,
                );

                const boost = getModeratorBoost(card);
                const effectiveScore = getEffectiveScore(card);
                const editorialBusy = Boolean(updatingEditorial[card.id]);

                return (
                  <article
                    key={card.id}
                    id={`studio-card-${card.id}`}
                    className="studio-card-enter"
                    style={{
                      border: `1px solid ${
                        queueFeedbackForCard
                          ? "rgba(95, 120, 144, 0.42)"
                          : card.status === "rejected"
                            ? "rgba(139, 62, 46, 0.22)"
                            : LINE
                      }`,
                      borderRadius: 20,
                      padding: 16,
                      background: queueFeedbackForCard
                        ? `linear-gradient(180deg, rgba(95, 120, 144, 0.08) 0%, ${PANEL} 100%)`
                        : card.status === "rejected"
                          ? `linear-gradient(180deg, ${ERROR_BG} 0%, ${PANEL} 100%)`
                          : `linear-gradient(180deg, ${CARD} 0%, ${PANEL} 100%)`,
                      boxShadow: queueFeedbackForCard
                        ? "0 1px 2px rgba(42, 31, 22, 0.04), 0 16px 34px rgba(95, 120, 144, 0.16)"
                        : "0 1px 2px rgba(42, 31, 22, 0.04), 0 12px 26px rgba(42, 31, 22, 0.06)",
                    }}
                  >
                    {queueFeedbackForCard ? (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: 10,
                          borderRadius: 12,
                          border: `1px solid rgba(95, 120, 144, 0.22)`,
                          background: "rgba(95, 120, 144, 0.08)",
                          color: TEXT,
                          fontSize: 12,
                          lineHeight: 1.45,
                        }}
                      >
                        <strong style={{ color: SLATE_DARK }}>Мягкая правка подготовлена. </strong>
                        Инструкция уже вставлена в блок доработки этой карточки ниже.
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        marginBottom: 10,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 17,
                          lineHeight: 1.22,
                          letterSpacing: "-0.01em",
                          fontFamily:
                            'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                          color: INK,
                          maxWidth: "calc(100% - 58px)",
                        }}
                      >
                        {card.title}
                      </h3>

                      {effectiveScore !== null ? (
                        <span
                          title={`AI: ${card.score_total ?? "—"} / boost: ${boost > 0 ? "+" : ""}${boost}`}
                          style={{
                            background:
                              boost !== 0
                                ? `linear-gradient(180deg, ${WARM_ACCENT} 0%, #7f674c 100%)`
                                : `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`,
                            color: "#fff",
                            borderRadius: 999,
                            minWidth: 42,
                            height: 42,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 900,
                            flexShrink: 0,
                            boxShadow: "0 10px 20px rgba(91, 102, 114, 0.18)",
                          }}
                        >
                          {effectiveScore}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
                      <Badge text={statusLabel(card.status)} strong />
                      {coverageLabel(card.coverage_type) ? (
                        <Badge text={coverageLabel(card.coverage_type) ?? ""} />
                      ) : null}
                      {boost !== 0 ? (
                        <Badge text={`буст: ${boost > 0 ? "+" : ""}${boost}`} />
                      ) : null}
                      {card.is_locked ? <Badge text="защищена" /> : null}
                    </div>

                    <div
                      style={{
                        marginBottom: 12,
                        border: `1px solid ${LINE_SOFT}`,
                        borderRadius: 14,
                        background: SLATE_SOFT_2,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: WARM_ACCENT,
                          marginBottom: 6,
                        }}
                      >
                        Источник
                      </div>
                      <div
                        style={{
                          color: SLATE_DARK,
                          fontSize: 13,
                          fontWeight: 800,
                          lineHeight: 1.4,
                        }}
                      >
                        {getCardSource(card)}
                      </div>
                    </div>

                    {card.anchor ? (
                      <div
                        style={{
                          marginBottom: 12,
                          border: `1px solid ${LINE_SOFT}`,
                          borderRadius: 14,
                          background: WARM_SOFT,
                          padding: "11px 12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: WARM_ACCENT,
                            marginBottom: 6,
                          }}
                        >
                          Опора
                        </div>
                        <p
                          style={{
                            margin: 0,
                            color: MUTED,
                            fontSize: 13,
                            lineHeight: 1.55,
                            fontStyle: "italic",
                          }}
                        >
                          "{card.anchor}"
                        </p>
                      </div>
                    ) : null}

                    <div
                      style={{
                        color: TEXT,
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      {card.teaser}
                    </div>

                    {card.why_it_matters ? (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: `1px solid ${LINE_SOFT}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: WARM_ACCENT,
                            marginBottom: 6,
                          }}
                        >
                          Почему это важно
                        </div>
                        <p
                          style={{
                            margin: 0,
                            color: MUTED,
                            fontSize: 13,
                            lineHeight: 1.62,
                          }}
                        >
                          {card.why_it_matters}
                        </p>
                      </div>
                    ) : null}

                    <details style={{ marginTop: 14 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: SLATE_DARK,
                          fontSize: 13,
                          fontWeight: 900,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12 }}>▼</span>
                        Оценка / угол
                      </summary>

                      <div
                        style={{
                          marginTop: 12,
                          padding: 13,
                          borderRadius: 16,
                          border: `1px solid rgba(111, 123, 136, 0.16)`,
                          background: `linear-gradient(180deg, ${SLATE_SOFT} 0%, ${SLATE_SOFT_2} 100%)`,
                        }}
                      >
                        <div
                          style={{
                            marginBottom: 12,
                            padding: 12,
                            borderRadius: 14,
                            background: CARD,
                            border: `1px solid ${LINE}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 900,
                              color: SLATE_DARK,
                              marginBottom: 9,
                            }}
                          >
                            Редакторский приоритет
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                            <Badge
                              text={`AI: ${card.score_total === null ? "—" : card.score_total}`}
                              strong
                            />
                            <Badge text={`Буст: ${boost > 0 ? "+" : ""}${boost}`} />
                            <Badge
                              text={`Итог: ${effectiveScore === null ? "—" : effectiveScore}`}
                              strong
                            />
                            {card.is_locked ? <Badge text="Lock: включён" /> : <Badge text="Lock: выключен" />}
                          </div>

                          <p
                            style={{
                              margin: "0 0 10px",
                              color: MUTED,
                              fontSize: 13,
                              lineHeight: 1.55,
                            }}
                          >
                            AI-оценка остаётся справочной. Буст меняет рабочий приоритет
                            карточки в выдаче и в Studio. Читатель эти цифры не видит.
                          </p>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 9 }}>
                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() => adjustModeratorBoost(card, -5)}
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              -5
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() => setModeratorBoost(card, 0)}
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              0
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() => adjustModeratorBoost(card, 5)}
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              +5
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() => adjustModeratorBoost(card, 10)}
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              +10
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() => adjustModeratorBoost(card, 15)}
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              +15
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() => updateModeratorNote(card)}
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              Заметка
                            </button>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() =>
                                updateAngleCardEditorial(card, {
                                  status: "featured",
                                  moderator_decision: "force_featured",
                                })
                              }
                              style={getApplyButtonStyle(editorialBusy)}
                            >
                              В активные
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() =>
                                updateAngleCardEditorial(card, {
                                  status: "reserve",
                                  moderator_decision: "move_reserve",
                                })
                              }
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              В запас
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() =>
                                updateAngleCardEditorial(card, {
                                  status: "hidden",
                                  moderator_decision: "hide_card",
                                })
                              }
                              style={getRepairButtonStyle(editorialBusy)}
                            >
                              Скрыть
                            </button>

                            <button
                              type="button"
                              disabled={editorialBusy}
                              onClick={() =>
                                updateAngleCardEditorial(card, {
                                  is_locked: !(card.is_locked ?? false),
                                  moderator_decision: card.is_locked ? "unlock_card" : "lock_card",
                                })
                              }
                              style={getSmallButtonStyle(editorialBusy)}
                            >
                              {card.is_locked ? "Unlock" : "Lock"}
                            </button>
                          </div>

                          <GroupCardActions
                            card={{
                              id: card.id,
                              title: card.title,
                              status: card.status,
                            }}
                            adminSecret={adminSecret}
                            disabled={editorialBusy}
                            onBusyChange={(busy) =>
                              setUpdatingEditorial((prev) => ({
                                ...prev,
                                [card.id]: busy,
                              }))
                            }
                            onUpdated={(status, message) =>
                              void applyGroupStatusLocally(card, status, message)
                            }
                            onError={setCardsError}
                          />

                          {card.moderator_note ? (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "9px 10px",
                                borderRadius: 12,
                                background: WARM_SOFT,
                                color: MUTED,
                                fontSize: 13,
                                lineHeight: 1.5,
                                border: `1px solid ${LINE_SOFT}`,
                              }}
                            >
                              <strong style={{ color: WARM_ACCENT }}>Заметка: </strong>
                              {card.moderator_note}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                          <Badge
                            text={`Текущая оценка: ${
                              card.score_total === null ? "—" : card.score_total
                            }`}
                            strong
                          />
                          <Badge text={statusLabel(card.status)} />
                          {coverageLabel(card.coverage_type) ? (
                            <Badge text={coverageLabel(card.coverage_type) ?? ""} />
                          ) : null}
                        </div>

                        <p
                          style={{
                            margin: "0 0 10px",
                            color: MUTED,
                            fontSize: 13,
                            lineHeight: 1.55,
                          }}
                        >
                          Нажми «Переоценить», чтобы проверить карточку новым редакционным
                          стандартом. Если карточка сохранена не на том языке, нажми
                          «Перевести заново».
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            disabled={
                              reEval.loading ||
                              reEval.applying ||
                              retranslation.loading ||
                              rewrite.loading ||
                              rewrite.applying ||
                              editorialBusy
                            }
                            onClick={() => reEvaluateCard(card)}
                            style={getSmallButtonStyle(
                              reEval.loading ||
                                reEval.applying ||
                                retranslation.loading ||
                                rewrite.loading ||
                                rewrite.applying ||
                                editorialBusy,
                            )}
                          >
                            {reEval.loading ? "Оцениваю..." : "Переоценить"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              retranslation.loading ||
                              reEval.loading ||
                              reEval.applying ||
                              rewrite.loading ||
                              rewrite.applying ||
                              editorialBusy
                            }
                            onClick={() => retranslateCard(card)}
                            style={getRepairButtonStyle(
                              retranslation.loading ||
                                reEval.loading ||
                                reEval.applying ||
                                rewrite.loading ||
                                rewrite.applying ||
                                editorialBusy,
                            )}
                          >
                            {retranslation.loading ? "Перевожу..." : "Перевести заново"}
                          </button>
                        </div>

                        {retranslation.error ? (
                          <MessageBox kind="error" text={retranslation.error} style={{ marginTop: 10 }} />
                        ) : null}

                        {retranslation.applied ? (
                          <MessageBox
                            kind="success"
                            text="Карточка переведена заново. Текст обновлён."
                            style={{ marginTop: 10 }}
                          />
                        ) : null}

                        {reEval.error ? (
                          <MessageBox kind="error" text={reEval.error} style={{ marginTop: 10 }} />
                        ) : null}

                        {reEval.result ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 12,
                              borderRadius: 14,
                              background: CARD,
                              border: `1px solid ${LINE}`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 7,
                                marginBottom: 9,
                              }}
                            >
                              <Badge
                                text={`Новая оценка: ${newScore === null ? "—" : newScore}`}
                                strong
                              />
                              {newPlacement ? <Badge text={`Предложение: ${newPlacement}`} /> : null}
                              {reEval.result.verse_text_source ? (
                                <Badge text={`Текст стиха: ${reEval.result.verse_text_source}`} />
                              ) : null}
                            </div>

                            {reason ? (
                              <p
                                style={{
                                  margin: "0 0 8px",
                                  color: MUTED,
                                  fontSize: 13,
                                  lineHeight: 1.55,
                                }}
                              >
                                <strong style={{ color: SLATE_DARK }}>Причина: </strong>
                                {reason}
                              </p>
                            ) : null}

                            {risk ? (
                              <p
                                style={{
                                  margin: "0 0 8px",
                                  color: WARNING_TEXT,
                                  fontSize: 13,
                                  lineHeight: 1.55,
                                }}
                              >
                                <strong>Риск: </strong>
                                {risk}
                              </p>
                            ) : null}

                            {reEval.applied ? (
                              <MessageBox
                                kind="success"
                                text="Оценка применена. База обновлена."
                                style={{ marginTop: 10 }}
                              />
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                                <button
                                  type="button"
                                  disabled={!canApply || reEval.applying}
                                  onClick={() => applyEvaluation(card)}
                                  style={getApplyButtonStyle(!canApply || reEval.applying)}
                                >
                                  {reEval.applying ? "Применяю..." : "Применить новую оценку"}
                                </button>
                              </div>
                            )}

                            {reEval.applyError ? (
                              <MessageBox
                                kind="error"
                                text={reEval.applyError}
                                style={{ marginTop: 10 }}
                              />
                            ) : null}
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 14,
                            background: CARD,
                            border: `1px solid ${LINE}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 900,
                              color: SLATE_DARK,
                              marginBottom: 9,
                            }}
                          >
                            Доработать карточку
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                              marginBottom: 9,
                            }}
                          >
                            <button
                              type="button"
                              disabled={rewrite.loading || rewrite.applying}
                              onClick={() => updateRewriteMode(card.id, "polish")}
                              style={getModeButtonStyle(
                                rewrite.rewriteMode === "polish",
                                rewrite.loading || rewrite.applying,
                              )}
                            >
                              Улучшить этот угол
                            </button>

                            <button
                              type="button"
                              disabled={rewrite.loading || rewrite.applying}
                              onClick={() => updateRewriteMode(card.id, "from_idea")}
                              style={getModeButtonStyle(
                                rewrite.rewriteMode === "from_idea",
                                rewrite.loading || rewrite.applying,
                              )}
                            >
                              Сделать из моей мысли
                            </button>
                          </div>

                          <p
                            style={{
                              margin: "0 0 9px",
                              color: MUTED,
                              fontSize: 12,
                              lineHeight: 1.5,
                            }}
                          >
                            {rewrite.rewriteMode === "from_idea"
                              ? "В этом режиме твоя мысль главнее старой карточки. Старая карточка используется только как контекст."
                              : "В этом режиме главный угол сохраняется, а AI усиливает ясность, текстовую опору и эффект открытия."}
                          </p>

                          <textarea
                            value={rewrite.instruction}
                            onChange={(event) =>
                              updateRewriteInstruction(card.id, event.target.value)
                            }
                            placeholder={
                              rewrite.rewriteMode === "from_idea"
                                ? "Опиши мысль, которую нужно сохранить. Например: главная идея такая-то; нельзя потерять такой-то образ; не уводи мысль в такую-то сторону..."
                                : "Например: сохрани этот угол, но усили вау-эффект, сделай менее очевидно, точнее привяжи к словам стиха..."
                            }
                            rows={3}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              border: `1px solid ${LINE}`,
                              borderRadius: 14,
                              padding: "11px 12px",
                              background: CARD_ALT,
                              color: INK,
                              fontSize: 13,
                              lineHeight: 1.5,
                              fontFamily: "inherit",
                              resize: "vertical",
                              outlineColor: SLATE,
                              marginBottom: 8,
                            }}
                          />

                          <textarea
                            value={rewrite.extraMaterial}
                            onChange={(event) =>
                              updateRewriteExtraMaterial(card.id, event.target.value)
                            }
                            placeholder={
                              rewrite.rewriteMode === "from_idea"
                                ? "Текстовая опора / цитата / лексическая заметка / материал для аргументации."
                                : "Дополнительный материал необязательно: можно вставить цитату, заметку или мысль, которую надо учесть."
                            }
                            rows={2}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              border: `1px solid ${LINE}`,
                              borderRadius: 14,
                              padding: "11px 12px",
                              background: CARD_ALT,
                              color: INK,
                              fontSize: 13,
                              lineHeight: 1.5,
                              fontFamily: "inherit",
                              resize: "vertical",
                              outlineColor: SLATE,
                              marginBottom: 9,
                            }}
                          />

                          <button
                            type="button"
                            disabled={
                              rewrite.loading ||
                              rewrite.applying ||
                              reEval.loading ||
                              reEval.applying ||
                              retranslation.loading ||
                              editorialBusy
                            }
                            onClick={() => previewRewrite(card)}
                            style={getSmallButtonStyle(
                              rewrite.loading ||
                                rewrite.applying ||
                                reEval.loading ||
                                reEval.applying ||
                                retranslation.loading ||
                                editorialBusy,
                            )}
                          >
                            {rewrite.loading ? "Готовлю..." : "Сделать вариант"}
                          </button>

                          {rewrite.error ? (
                            <MessageBox kind="error" text={rewrite.error} style={{ marginTop: 10 }} />
                          ) : null}

                          {rewrite.result?.rewritten_card ? (
                            <div
                              style={{
                                marginTop: 10,
                                padding: 12,
                                borderRadius: 14,
                                background: SLATE_SOFT,
                                border: `1px solid rgba(111, 123, 136, 0.16)`,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color: SLATE_DARK,
                                  marginBottom: 8,
                                }}
                              >
                                Новый вариант
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
                                <Badge
                                  text={
                                    rewrite.rewriteMode === "from_idea"
                                      ? "Режим: из моей мысли"
                                      : rewrite.preserveOriginalMeta
                                        ? "Режим: мягкий patch"
                                        : "Режим: улучшение угла"
                                  }
                                  strong
                                />
                              </div>

                              <h4
                                style={{
                                  margin: "0 0 8px",
                                  fontSize: 16,
                                  lineHeight: 1.25,
                                  fontFamily:
                                    'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                                  color: INK,
                                }}
                              >
                                {rewrite.result.rewritten_card.title}
                              </h4>

                              {rewrite.result.rewritten_card.anchor ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: MUTED,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    fontStyle: "italic",
                                  }}
                                >
                                  "{rewrite.result.rewritten_card.anchor}"
                                </p>
                              ) : null}

                              <p
                                style={{
                                  margin: "0 0 8px",
                                  color: TEXT,
                                  fontSize: 13,
                                  lineHeight: 1.6,
                                }}
                              >
                                {rewrite.result.rewritten_card.teaser}
                              </p>

                              {rewrite.result.rewritten_card.why_it_matters ? (
                                <p
                                  style={{
                                    margin: "0 0 10px",
                                    color: MUTED,
                                    fontSize: 13,
                                    lineHeight: 1.55,
                                  }}
                                >
                                  <strong style={{ color: SLATE_DARK }}>Почему важно: </strong>
                                  {rewrite.result.rewritten_card.why_it_matters}
                                </p>
                              ) : null}

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 7,
                                  marginBottom: 9,
                                }}
                              >
                                {rewrite.preserveOriginalMeta ? (
                                  <>
                                    <Badge
                                      text={`Исходная оценка сохраняется: ${card.score_total ?? "—"}`}
                                      strong
                                    />
                                    <Badge text={`Статус сохраняется: ${readableCardStatus(card.status)}`} />
                                    <Badge
                                      text={`Risk-check после правки: ${
                                        rewriteScore === null ? "—" : rewriteScore
                                      }`}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <Badge
                                      text={`Новая оценка: ${
                                        rewriteScore === null ? "—" : rewriteScore
                                      }`}
                                      strong
                                    />
                                    {rewritePlacement ? (
                                      <Badge text={`Предложение: ${rewritePlacement}`} />
                                    ) : null}
                                  </>
                                )}
                              </div>

                              {rewriteReason ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: MUTED,
                                    fontSize: 13,
                                    lineHeight: 1.55,
                                  }}
                                >
                                  <strong style={{ color: SLATE_DARK }}>Причина: </strong>
                                  {rewriteReason}
                                </p>
                              ) : null}

                              {rewriteRisk ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: WARNING_TEXT,
                                    fontSize: 13,
                                    lineHeight: 1.55,
                                  }}
                                >
                                  <strong>Риск: </strong>
                                  {rewriteRisk}
                                </p>
                              ) : null}

                              {rewrite.preserveOriginalMeta && !rewrite.applied ? (
                                <MessageBox
                                  kind="success"
                                  text="Это мягкий patch: при применении меняется только текст карточки, а исходные оценка и статус сохраняются. Оценка выше — только справочная проверка риска."
                                  style={{ marginTop: 10 }}
                                />
                              ) : null}

                              {rewrite.applied ? (
                                <MessageBox
                                  kind="success"
                                  text={
                                    rewrite.preserveOriginalMeta
                                      ? "Мягкая правка применена. RU/EN/ES версии обновлены, исходные score/status сохранены."
                                      : "Доработка применена. RU/EN/ES версии обновлены."
                                  }
                                  style={{ marginTop: 10 }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canApplyRewrite || rewrite.applying}
                                  onClick={() => applyRewrite(card)}
                                  style={getApplyButtonStyle(!canApplyRewrite || rewrite.applying)}
                                >
                                  {rewrite.applying
                                    ? "Применяю..."
                                    : rewrite.preserveOriginalMeta
                                      ? `Применить мягкую правку, сохранив ${card.score_total ?? "—"} / ${readableCardStatus(card.status)}`
                                      : "Применить доработку RU/EN/ES"}
                                </button>
                              )}

                              {rewrite.applyError ? (
                                <MessageBox
                                  kind="error"
                                  text={rewrite.applyError}
                                  style={{ marginTop: 10 }}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <p
          style={{
            margin: "20px 0 0",
            color: MUTED_2,
            fontSize: 12,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          MVP Studio: Озеро, Автокуратор v2, Auto Moderator Report, audit log,
          очередь решений с 4 действиями, переоценка, доработка карточек,
          ручной редакторский приоритет и ручной материал RU/EN/ES.
        </p>
      </div>
    </main>
  );
}

function Badge({ text, strong = false }: { text: string; strong?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 9px",
        background: strong ? SLATE_SOFT : "#f0eee8",
        color: strong ? SLATE_DARK : MUTED,
        fontSize: 12,
        fontWeight: strong ? 850 : 750,
        lineHeight: 1,
        border: `1px solid ${strong ? "rgba(111,123,136,0.08)" : "rgba(217,208,194,0.7)"}`,
      }}
    >
      {text}
    </span>
  );
}

function MiniSourceChip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 9px",
        background: SLATE_SOFT_2,
        color: SLATE_DARK,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        border: "1px solid rgba(111,123,136,0.10)",
      }}
    >
      {text}
    </span>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 15,
        borderRadius: 16,
        background: CARD,
        border: `1px dashed ${LINE}`,
        color: MUTED,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  );
}

function MessageBox({
  kind,
  text,
  style,
}: {
  kind: "error" | "success";
  text: string;
  style?: CSSProperties;
}) {
  const isError = kind === "error";

  return (
    <div
      className="studio-card-enter"
      style={{
        padding: "10px 11px",
        borderRadius: 12,
        background: isError ? ERROR_BG : SUCCESS_BG,
        color: isError ? ERROR_TEXT : SUCCESS_TEXT,
        fontSize: 13,
        fontWeight: 800,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

function Skeleton({ width }: { width: string }) {
  return (
    <div
      style={{
        width,
        height: 14,
        borderRadius: 999,
        background:
          "linear-gradient(90deg, rgba(233,228,220,0.9), rgba(255,253,250,0.96), rgba(233,228,220,0.9))",
        backgroundSize: "220% 100%",
        animation: "studio-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
