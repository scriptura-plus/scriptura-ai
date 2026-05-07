"use client";

import { useMemo, useState, type CSSProperties } from "react";

type Lang = "ru" | "en" | "es";
type Provider = "openai" | "claude" | "gemini";
type MaterialMode = "material" | "deep_report" | "ready_json";

type VerseSummary = {
  reference: string;
  lang: Lang;
  book_key: string | null;
  canonical_ref: string | null;
};

type ExtractedCandidate = {
  id: string;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  estimated_score: number | null;
  strength_reason: string | null;
  risk: string | null;
  source_excerpt: string | null;
};

type RejectedIdea = {
  idea: string;
  reason: string;
};

type DuplicateCard = {
  id: string | null;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
  angle_summary?: string | null;
  coverage_type?: string | null;
  score_total: number | null;
  status?: string | null;
  is_locked?: boolean | null;
  source_type?: string | null;
  source_provider?: string | null;
  source_model?: string | null;
  editor_model?: string | null;
  moderator_boost?: number | null;
};

type DuplicatePayload = {
  reason?: string | null;
  matched_card_id?: string | null;
  existing_card?: DuplicateCard | null;
  candidate_card?: {
    id?: string | null;
    title: string;
    anchor: string | null;
    teaser: string;
    why_it_matters: string | null;
    original_candidate?: unknown;
  } | null;
  existing_score?: number | null;
  candidate_score?: number | null;
  same_angle?: boolean | null;
  similarity_confidence?: number | null;
  battle?: {
    required?: boolean;
    old_card_id?: string | null;
    old_score?: number;
    new_score?: number;
    winner?: string | null;
    score_delta?: number;
    battle_action?: string | null;
    battle_reason?: string | null;
  } | null;
  evaluation?: unknown;
};

type ReferenceMismatchPayload = {
  expected_reference?: string;
  expected_canonical_ref?: string | null;
  detected_reference?: string;
  detected_canonical_ref?: string | null;
  detected_references?: Array<{
    raw: string;
    canonical_ref: string | null;
    book_key: string | null;
    book: string | null;
    chapter: number | null;
    verse: number | null;
  }>;
};

type ManualExtractResponse = {
  ok?: boolean;
  error?: string;
  reference?: string;
  lang?: Lang;
  provider?: string;
  verseText?: string;
  verse_text?: string;
  verse_text_source?: "request" | "getVerseText";
  summary?: string;
  candidates?: ExtractedCandidate[];
  rejected?: RejectedIdea[];
};

type ProcessCandidateResponse = {
  ok?: boolean;
  error?: string;
  skipped?: boolean;
  skip_reason?: string;
  saved_id?: string | null;
  saved_ids?: Array<{
    ok: boolean;
    id: string | null;
    lang: Lang;
    error: string | null;
  }>;
  translation_group_id?: string;
  rewritten?: boolean;
  status?: string;
  score_total?: number | null;
  canonical_ref?: string | null;
  book_key?: string | null;
  editor_provider?: string;
  editor_model?: string;
  duplicate?: DuplicatePayload | null;
  reference_mismatch?: ReferenceMismatchPayload | null;
  first_evaluation?: unknown;
  final_evaluation?: unknown;
  final_card?: unknown;
};

type SaveState = {
  loading: boolean;
  saved: boolean;
  error: string;
  message: string;
  duplicate: DuplicatePayload | null;
  referenceMismatch: ReferenceMismatchPayload | null;
  response: ProcessCandidateResponse | null;
};

type BatchSummary = {
  total: number;
  processed: number;
  saved: number;
  active: number;
  reserve: number;
  duplicates: number;
  rejected: number;
  mismatches: number;
  errors: number;
};

type Props = {
  selectedVerse: VerseSummary | null;
  lang: Lang;
  adminSecret: string;
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
};

const CARD = "#fffdfa";
const CARD_ALT = "#f7f3ec";
const PANEL = "#f9f5ee";
const LINE = "#d9d0c2";
const LINE_SOFT = "#e7e0d4";
const INK = "#2f2923";
const TEXT = "#40372f";
const MUTED = "#6d645b";
const SLATE = "#6f7b88";
const SLATE_DARK = "#5b6672";
const SLATE_SOFT = "#eef2f5";
const WARM_ACCENT = "#9a8061";
const WARNING_BG = "#f5ebd5";
const WARNING_TEXT = "#8a6330";
const ERROR_BG = "#f5dfd7";
const ERROR_TEXT = "#8b3e2e";
const SUCCESS_BG = "#e4ecde";
const SUCCESS_TEXT = "#4f6b3d";

function buttonStyle(primary = false, disabled = false): CSSProperties {
  return {
    border: `1px solid ${primary ? SLATE : "rgba(111, 123, 136, 0.24)"}`,
    borderRadius: 999,
    background: primary
      ? disabled
        ? "#eceff2"
        : `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`
      : "#f5f7f9",
    color: primary && !disabled ? "#ffffff" : SLATE_DARK,
    padding: "9px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 850,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow:
      primary && !disabled ? "0 8px 18px rgba(91, 102, 114, 0.16)" : "none",
  };
}

function smallButtonStyle(active = false, disabled = false): CSSProperties {
  return {
    border: `1px solid ${active ? SLATE : "rgba(111, 123, 136, 0.22)"}`,
    borderRadius: 999,
    background: active ? SLATE_SOFT : CARD_ALT,
    color: active ? SLATE_DARK : MUTED,
    padding: "8px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 850,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
  };
}

function scorePill(score: number | null) {
  if (score === null || !Number.isFinite(score)) return null;

  return (
    <span
      style={{
        background: `linear-gradient(180deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`,
        color: "#fff",
        borderRadius: 999,
        minWidth: 38,
        height: 38,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      {score}
    </span>
  );
}

function MessageBox({
  kind,
  text,
  style,
}: {
  kind: "error" | "success" | "info" | "warning";
  text: string;
  style?: CSSProperties;
}) {
  const isError = kind === "error";
  const isSuccess = kind === "success";
  const isWarning = kind === "warning";

  return (
    <div
      style={{
        padding: "10px 11px",
        borderRadius: 12,
        background: isError
          ? ERROR_BG
          : isSuccess
            ? SUCCESS_BG
            : isWarning
              ? WARNING_BG
              : SLATE_SOFT,
        color: isError
          ? ERROR_TEXT
          : isSuccess
            ? SUCCESS_TEXT
            : isWarning
              ? WARNING_TEXT
              : SLATE_DARK,
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1.45,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

function createEmptySaveState(previous?: SaveState): SaveState {
  return {
    loading: false,
    saved: previous?.saved ?? false,
    error: "",
    message: previous?.message ?? "",
    duplicate: previous?.duplicate ?? null,
    referenceMismatch: previous?.referenceMismatch ?? null,
    response: previous?.response ?? null,
  };
}

function getCandidateSaveMessage(data: ProcessCandidateResponse): string {
  if (data.skipped) {
    if (data.skip_reason === "reference_mismatch") {
      const detected = data.reference_mismatch?.detected_reference ?? "другой стих";
      const expected = data.reference_mismatch?.expected_reference ?? "выбранный стих";
      return `Не сохранено: карточка явно относится к ${detected}, а выбран ${expected}.`;
    }

    if (data.skip_reason === "matched_duplicate") {
      return "Найден похожий угол. Ниже показано сравнение старой и новой карточки.";
    }

    if (data.skip_reason === "matched_duplicate_after_rewrite") {
      return "После доработки система всё равно нашла похожий угол. Ниже показано сравнение.";
    }

    if (data.skip_reason === "score_below_save_threshold") {
      return "Не сохранено: оценка ниже порога сохранения.";
    }

    if (data.skip_reason === "placement_not_savable") {
      return "Не сохранено: evaluator предложил скрыть или отклонить карточку.";
    }

    if (data.skip_reason === "battle_hide_candidate") {
      return "Не сохранено: duplicate battle предложил скрыть нового кандидата.";
    }

    return `Не сохранено: ${data.skip_reason ?? "кандидат не прошёл фильтр"}.`;
  }

  const score =
    typeof data.score_total === "number" && Number.isFinite(data.score_total)
      ? ` Оценка: ${data.score_total}.`
      : "";

  const status = data.status ? ` Статус: ${statusLabel(data.status)}.` : "";

  return `Карточка сохранена в RU/EN/ES.${score}${status}`;
}

function statusLabel(status?: string | null): string {
  if (!status) return "—";
  if (status === "featured") return "активная";
  if (status === "featured_new") return "активная";
  if (status === "reserve") return "запас";
  if (status === "hidden") return "скрыта";
  if (status === "rejected") return "отклонена";
  if (status === "rewrite") return "на доработку";
  if (status === "skipped_duplicate") return "дубль";
  if (status === "skipped_reference_mismatch") return "чужой стих";
  if (status === "replace_existing") return "замена";
  return status;
}

function readableSourceLabel(source?: string | null): string {
  if (!source) return "Неизвестно";

  const cleaned = source
    .replace("article_extractor_v1:", "")
    .replace("admin_process_candidate", "manual")
    .replace("extra_analysis_article", "extra")
    .replace("context_card_article", "context")
    .replace("word_card_article", "word");

  if (cleaned === "word") return "Word Lens";
  if (cleaned === "context") return "Context Lens";
  if (cleaned === "intertext") return "Связи с другими стихами";
  if (cleaned === "historical_scene") return "Историческая сцена";
  if (cleaned === "text_findings") return "Текстовые находки";
  if (cleaned === "scripture_links") return "Связи с другими стихами";
  if (cleaned.startsWith("manual_material:")) return "Ручной материал";
  if (cleaned.startsWith("initial_angles:gemini")) return "Первичная генерация Gemini";
  if (cleaned.startsWith("initial_angles:claude")) return "Первичная генерация Claude";
  if (cleaned.startsWith("initial_angles:openai")) return "Первичная генерация OpenAI";
  if (cleaned === "manual") return "Ручная обработка";
  if (cleaned === "manual_test") return "Ручной тест";
  if (cleaned === "studio_rewrite") return "Доработка в Studio";
  if (cleaned === "ready_candidate_cards_json") return "Ready candidate cards JSON";
  if (cleaned === "deep_search_report") return "Deep Search report";

  return cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): unknown {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }

    throw new Error("Не удалось распознать JSON.");
  }
}

function normalizeReadyCandidate(value: unknown, index: number): ExtractedCandidate | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title ?? value["заголовок"]);
  const teaser = getString(
    value.teaser ??
      value.body ??
      value.text ??
      value["текст"] ??
      value["суть"] ??
      value["core_discovery"],
  );

  if (!title || !teaser) return null;

  const rawScore = getNumber(value.estimated_score ?? value.score ?? value.discovery_score);
  const estimatedScore =
    rawScore === null ? null : Math.max(0, Math.min(100, Math.round(rawScore)));

  const risk = getString(value.risk ?? value.risk_note ?? value["риск"]);
  const sourceBasis = getString(value.source_basis ?? value.evidence ?? value["источник"]);
  const sourceExcerpt = getString(value.source_excerpt) ?? sourceBasis;

  return {
    id: getString(value.id) ?? `ready_candidate_${index + 1}`,
    title,
    anchor: getString(value.anchor ?? value.textual_anchor ?? value["опора"]),
    teaser,
    why_it_matters: getString(value.why_it_matters ?? value.why ?? value["почему_важно"]),
    estimated_score: estimatedScore,
    strength_reason: getString(value.strength_reason ?? value.reason ?? value["сила"]) ?? sourceBasis,
    risk,
    source_excerpt: sourceExcerpt,
  };
}

function normalizeReadyJson(text: string): ExtractedCandidate[] {
  const parsed = extractJsonObject(text);

  const rawCards = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.cards)
      ? parsed.cards
      : isRecord(parsed) && Array.isArray(parsed.candidates)
        ? parsed.candidates
        : [];

  return rawCards
    .map((item, index) => normalizeReadyCandidate(item, index))
    .filter((item): item is ExtractedCandidate => item !== null);
}

function getSourceModelForMode(mode: MaterialMode, provider: Provider): string {
  if (mode === "ready_json") return "ready_candidate_cards_json";
  if (mode === "deep_report") return `deep_search_report:${provider}`;
  return `manual_material:${provider}`;
}

function getSourceTypeForMode(mode: MaterialMode): string {
  if (mode === "ready_json") return "ready_candidate_cards_json";
  if (mode === "deep_report") return "deep_search_report";
  return "manual_material";
}

function getModeLabel(mode: MaterialMode): string {
  if (mode === "ready_json") return "Готовые карточки JSON";
  if (mode === "deep_report") return "Deep Search report";
  return "Обычный материал";
}

function getModeDirection(mode: MaterialMode, direction: string): string {
  const trimmed = direction.trim();

  if (mode === "deep_report") {
    return [
      "Это внешний Deep Search / исследовательский отчёт. Найди только сильные net-new углы для карточек.",
      "Не пересказывай отчёт. Извлекай карточки с конкретной текстовой опорой, вау-эффектом и осторожными формулировками.",
      "Отбрасывай дубли, общие морали, слабые параллели, overclaim и всё, что не даёт зрелому читателю ощущения открытия.",
      trimmed ? `Дополнительное направление модератора: ${trimmed}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (mode === "material") {
    return [
      "Это обычный исследовательский материал / заметки модератора. Найди card-worthy открытия и напиши их как готовые Scriptura-карточки.",
      "Стиль: коротко, дорого, с крючком, конкретным якорем и discovery-эффектом.",
      trimmed ? `Дополнительное направление модератора: ${trimmed}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return trimmed;
}

function CardPreview({
  label,
  card,
  score,
  accent,
}: {
  label: string;
  card: {
    title: string;
    anchor: string | null;
    teaser: string;
    why_it_matters: string | null;
    status?: string | null;
    source_model?: string | null;
  };
  score: number | null;
  accent: "old" | "new";
}) {
  const isNew = accent === "new";

  return (
    <div
      style={{
        border: `1px solid ${isNew ? "rgba(111, 123, 136, 0.30)" : LINE}`,
        borderRadius: 16,
        background: isNew ? SLATE_SOFT : CARD,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: isNew ? SLATE_DARK : WARM_ACCENT,
              marginBottom: 6,
            }}
          >
            {label}
          </div>

          <h5
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.25,
              fontFamily:
                'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
              color: INK,
            }}
          >
            {card.title}
          </h5>
        </div>

        {scorePill(score)}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
        {card.status ? (
          <span
            style={{
              borderRadius: 999,
              background: isNew ? CARD : SLATE_SOFT,
              color: SLATE_DARK,
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {statusLabel(card.status)}
          </span>
        ) : null}

        {card.source_model ? (
          <span
            style={{
              borderRadius: 999,
              background: isNew ? CARD : SLATE_SOFT,
              color: SLATE_DARK,
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {readableSourceLabel(card.source_model)}
          </span>
        ) : null}
      </div>

      {card.anchor ? (
        <p
          style={{
            margin: "0 0 8px",
            color: MUTED,
            fontSize: 13,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          "{card.anchor}"
        </p>
      ) : null}

      <p style={{ margin: 0, color: TEXT, fontSize: 13, lineHeight: 1.6 }}>
        {card.teaser}
      </p>

      {card.why_it_matters ? (
        <p style={{ margin: "9px 0 0", color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
          <strong style={{ color: SLATE_DARK }}>Почему важно: </strong>
          {card.why_it_matters}
        </p>
      ) : null}
    </div>
  );
}

function DuplicateBattleView({ duplicate }: { duplicate: DuplicatePayload }) {
  const existing = duplicate.existing_card;
  const candidate = duplicate.candidate_card;

  if (!existing || !candidate) {
    return (
      <MessageBox
        kind="info"
        text="Система нашла похожий угол, но не вернула полные данные для сравнения."
        style={{ marginTop: 10 }}
      />
    );
  }

  const battleReason =
    duplicate.battle?.battle_reason ||
    duplicate.reason ||
    "Система считает, что обе карточки раскрывают один и тот же угол.";

  const existingScore =
    typeof duplicate.existing_score === "number"
      ? duplicate.existing_score
      : existing.score_total;

  const candidateScore =
    typeof duplicate.candidate_score === "number" ? duplicate.candidate_score : null;

  return (
    <div
      style={{
        marginTop: 12,
        border: `1px solid rgba(138, 99, 48, 0.22)`,
        borderRadius: 18,
        background: `linear-gradient(180deg, ${WARNING_BG} 0%, #fff8eb 100%)`,
        padding: 13,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: WARNING_TEXT,
          fontWeight: 900,
          marginBottom: 8,
        }}
      >
        Похожий угол найден
      </div>

      <p
        style={{
          margin: "0 0 12px",
          color: WARNING_TEXT,
          fontSize: 13,
          lineHeight: 1.55,
          fontWeight: 750,
        }}
      >
        {battleReason}
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <CardPreview
          label="Существующая карточка"
          card={{
            title: existing.title,
            anchor: existing.anchor,
            teaser: existing.teaser,
            why_it_matters: existing.why_it_matters,
            status: existing.status,
            source_model: existing.source_model,
          }}
          score={existingScore}
          accent="old"
        />

        <CardPreview
          label="Новый кандидат"
          card={{
            title: candidate.title,
            anchor: candidate.anchor,
            teaser: candidate.teaser,
            why_it_matters: candidate.why_it_matters,
            status: "manual",
            source_model: "manual_material",
          }}
          score={candidateScore}
          accent="new"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 7,
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid rgba(138, 99, 48, 0.18)`,
          color: WARNING_TEXT,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {typeof duplicate.similarity_confidence === "number" ? (
          <div>
            <strong>Уверенность сходства: </strong>
            {duplicate.similarity_confidence}
          </div>
        ) : null}

        {duplicate.battle?.winner ? (
          <div>
            <strong>Выбор AI: </strong>
            {duplicate.battle.winner === "matched"
              ? "оставить существующую"
              : duplicate.battle.winner === "candidate"
                ? "выбрать нового кандидата"
                : duplicate.battle.winner}
          </div>
        ) : null}

        {duplicate.battle?.score_delta !== undefined ? (
          <div>
            <strong>Разница оценки: </strong>
            {duplicate.battle.score_delta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReferenceMismatchView({ mismatch }: { mismatch: ReferenceMismatchPayload }) {
  return (
    <MessageBox
      kind="warning"
      text={`Защита остановила сохранение: карточка явно ссылается на ${
        mismatch.detected_reference ?? "другой стих"
      }, а выбран ${mismatch.expected_reference ?? "текущий стих"}.`}
      style={{ marginTop: 10 }}
    />
  );
}

function DebugEvaluationView({ state }: { state: SaveState }) {
  const response = state.response;
  if (!response) return null;

  const extendedResponse = response as ProcessCandidateResponse & {
    json_repaired?: boolean | null;
    json_parse_error?: string | null;
    replacement_needed?: boolean | null;
    replacement_target_id?: string | null;
    replacement_result?: {
      ok?: boolean;
      hidden_count?: number;
      hidden_ids?: string[];
      used_translation_group?: boolean;
      error?: string | null;
    } | null;
  };

  const evaluation = response.final_evaluation ?? response.first_evaluation;
  const evaluationRecord = isRecord(evaluation) ? evaluation : null;

  const score =
    getNumber(response.score_total) ??
    getNumber(evaluationRecord?.score_total) ??
    null;

  const placement =
    getString(response.status) ??
    getString(evaluationRecord?.placement) ??
    null;

  const coverageType =
    getString(evaluationRecord?.coverage_type) ??
    getString(evaluationRecord?.["тип_охвата"]) ??
    null;

  const angleSummary =
    getString(evaluationRecord?.angle_summary) ??
    getString(evaluationRecord?.["краткое_описание_угла"]) ??
    null;

  const reason =
    getString(evaluationRecord?.reason) ??
    getString(evaluationRecord?.["причина"]) ??
    null;

  const risk =
    getString(evaluationRecord?.risk) ??
    getString(evaluationRecord?.["риск"]) ??
    null;

  const matchedCardId =
    getString(evaluationRecord?.matched_card_id) ??
    getString(evaluationRecord?.replace_card_id) ??
    null;

  const battle = isRecord(evaluationRecord?.battle) ? evaluationRecord.battle : null;

  const battleWinner = getString(battle?.winner);
  const battleAction = getString(battle?.battle_action);
  const battleReason = getString(battle?.battle_reason);
  const oldScore = getNumber(battle?.old_score);
  const newScore = getNumber(battle?.new_score);
  const scoreDelta = getNumber(battle?.score_delta);

  const sameAngle =
    typeof evaluationRecord?.same_angle === "boolean"
      ? evaluationRecord.same_angle
      : null;

  const similarityConfidence = getNumber(evaluationRecord?.similarity_confidence);

  const replacementHidden =
    extendedResponse.replacement_result?.ok === true &&
    typeof extendedResponse.replacement_result.hidden_count === "number" &&
    extendedResponse.replacement_result.hidden_count > 0;

  const replacementNeeded =
    extendedResponse.replacement_needed === true ||
    placement === "replace_existing" ||
    battleAction === "replace_existing";

  function readableCoverage(value: string | null): string {
    if (!value) return "—";
    if (value === "lexical") return "слово / лексика";
    if (value === "grammatical") return "грамматика";
    if (value === "structural") return "структура";
    if (value === "contextual") return "контекст";
    if (value === "translation") return "перевод";
    if (value === "rhetorical") return "риторика";
    if (value === "historical") return "история";
    if (value === "conceptual") return "концепт";
    if (value === "other") return "другое";
    return value;
  }

  function readableBattleWinner(value: string | null): string {
    if (!value) return "—";
    if (value === "candidate") return "новый кандидат";
    if (value === "matched") return "существующая карточка";
    return value;
  }

  function readableBattleAction(value: string | null): string {
    if (!value || value === "none") return "без замены";
    if (value === "replace_existing") return "заменить старую карточку";
    if (value === "keep_existing_hide_candidate") return "оставить старую, скрыть новую";
    if (value === "keep_existing_send_candidate_to_reserve") {
      return "оставить старую, нового кандидата в запас";
    }
    return value;
  }

  const showReplacementBox = replacementNeeded || replacementHidden;
  const showBattleBox =
    Boolean(battleWinner) ||
    Boolean(battleAction) ||
    Boolean(battleReason) ||
    typeof oldScore === "number" ||
    typeof newScore === "number" ||
    typeof scoreDelta === "number" ||
    sameAngle !== null ||
    typeof similarityConfidence === "number";

  return (
    <details
      style={{
        marginTop: 10,
        border: `1px solid ${LINE_SOFT}`,
        borderRadius: 14,
        padding: 10,
        background: "#f8fafc",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          color: SLATE_DARK,
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        Оценка / решение evaluator
      </summary>

      <div
        style={{
          display: "grid",
          gap: 9,
          marginTop: 10,
          color: TEXT,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          <span
            style={{
              borderRadius: 999,
              background: CARD,
              color: SLATE_DARK,
              padding: "6px 9px",
              fontSize: 12,
              fontWeight: 850,
              border: `1px solid ${LINE_SOFT}`,
            }}
          >
            Оценка: {score ?? "—"}
          </span>

          <span
            style={{
              borderRadius: 999,
              background: CARD,
              color: SLATE_DARK,
              padding: "6px 9px",
              fontSize: 12,
              fontWeight: 850,
              border: `1px solid ${LINE_SOFT}`,
            }}
          >
            Решение: {statusLabel(placement)}
          </span>

          <span
            style={{
              borderRadius: 999,
              background: CARD,
              color: SLATE_DARK,
              padding: "6px 9px",
              fontSize: 12,
              fontWeight: 850,
              border: `1px solid ${LINE_SOFT}`,
            }}
          >
            Тип: {readableCoverage(coverageType)}
          </span>

          {extendedResponse.json_repaired ? (
            <span
              style={{
                borderRadius: 999,
                background: WARNING_BG,
                color: WARNING_TEXT,
                padding: "6px 9px",
                fontSize: 12,
                fontWeight: 850,
                border: `1px solid rgba(138, 99, 48, 0.18)`,
              }}
            >
              JSON исправлен автоматически
            </span>
          ) : null}
        </div>

        {angleSummary ? (
          <div>
            <strong style={{ color: SLATE_DARK }}>Краткий угол: </strong>
            {angleSummary}
          </div>
        ) : null}

        {reason ? (
          <div>
            <strong style={{ color: SLATE_DARK }}>Причина: </strong>
            {reason}
          </div>
        ) : null}

        {risk ? (
          <div style={{ color: WARNING_TEXT }}>
            <strong>Риск: </strong>
            {risk}
          </div>
        ) : null}

        {showBattleBox ? (
          <div
            style={{
              borderTop: `1px solid ${LINE_SOFT}`,
              paddingTop: 9,
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: WARM_ACCENT,
              }}
            >
              Сравнение с существующими карточками
            </div>

            {sameAngle !== null ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Тот же угол: </strong>
                {sameAngle ? "да" : "нет"}
              </div>
            ) : null}

            {matchedCardId ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Совпавшая карточка: </strong>
                {matchedCardId}
              </div>
            ) : null}

            {typeof similarityConfidence === "number" ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Уверенность сходства: </strong>
                {similarityConfidence}
              </div>
            ) : null}

            {battleWinner ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Победитель: </strong>
                {readableBattleWinner(battleWinner)}
              </div>
            ) : null}

            {battleAction ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Действие: </strong>
                {readableBattleAction(battleAction)}
              </div>
            ) : null}

            {typeof oldScore === "number" || typeof newScore === "number" ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Сравнение оценок: </strong>
                старая {typeof oldScore === "number" ? oldScore : "—"} → новая{" "}
                {typeof newScore === "number" ? newScore : "—"}
                {typeof scoreDelta === "number" ? `, разница: ${scoreDelta}` : ""}
              </div>
            ) : null}

            {battleReason ? (
              <div>
                <strong style={{ color: SLATE_DARK }}>Почему: </strong>
                {battleReason}
              </div>
            ) : null}
          </div>
        ) : null}

        {showReplacementBox ? (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: replacementHidden ? SUCCESS_BG : WARNING_BG,
              color: replacementHidden ? SUCCESS_TEXT : WARNING_TEXT,
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.45,
            }}
          >
            {replacementHidden
              ? `Замена выполнена: старая группа карточек скрыта (${extendedResponse.replacement_result?.hidden_count ?? 0}).`
              : "Evaluator предложил заменить старую карточку. Проверь, скрылась ли старая группа после сохранения."}
          </div>
        ) : null}

        {response.reference_mismatch ? (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: WARNING_BG,
              color: WARNING_TEXT,
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.45,
            }}
          >
            Защита от чужого стиха: найдено{" "}
            {response.reference_mismatch.detected_reference ?? "другое место"}, выбран{" "}
            {response.reference_mismatch.expected_reference ?? "текущий стих"}.
          </div>
        ) : null}

        <details
          style={{
            borderTop: `1px solid ${LINE_SOFT}`,
            paddingTop: 8,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              color: MUTED,
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            Raw JSON
          </summary>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              margin: "10px 0 0",
              color: TEXT,
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            {JSON.stringify(
              {
                skipped: response.skipped,
                skip_reason: response.skip_reason,
                status: response.status,
                score_total: response.score_total,
                reference_mismatch: response.reference_mismatch ?? null,
                json_repaired: extendedResponse.json_repaired ?? false,
                json_parse_error: extendedResponse.json_parse_error ?? null,
                replacement_needed: extendedResponse.replacement_needed ?? null,
                replacement_target_id: extendedResponse.replacement_target_id ?? null,
                replacement_result: extendedResponse.replacement_result ?? null,
                evaluation,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </div>
    </details>
  );
}

export function ManualMaterialBuilder({
  selectedVerse,
  lang,
  adminSecret,
  onNotice,
  onError,
}: Props) {
  const [material, setMaterial] = useState("");
  const [direction, setDirection] = useState("");
  const [provider, setProvider] = useState<Provider>("claude");
  const [mode, setMode] = useState<MaterialMode>("material");

  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [verseText, setVerseText] = useState("");
  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [rejected, setRejected] = useState<RejectedIdea[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => !excludedIds.has(candidate.id)),
    [candidates, excludedIds],
  );

  function resetResults() {
    setSummary("");
    setVerseText("");
    setCandidates([]);
    setRejected([]);
    setSaveStates({});
    setExcludedIds(new Set());
    setBatchSummary(null);
  }

  function toggleExcluded(candidateId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  }

  function removeCandidate(candidateId: string) {
    setCandidates((prev) => prev.filter((candidate) => candidate.id !== candidateId));
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(candidateId);
      return next;
    });
    setSaveStates((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
  }

  async function extractManualCandidates() {
    if (!selectedVerse) {
      onError?.("Сначала выбери стих.");
      return;
    }

    if (!adminSecret.trim()) {
      onError?.("Вставь Admin Secret.");
      return;
    }

    if (!material.trim()) {
      onError?.("Вставь материал, Deep Search report или JSON карточек.");
      return;
    }

    setLoading(true);
    setError("");
    resetResults();
    onNotice?.(mode === "ready_json" ? "Распознаю готовые карточки..." : "Ищу кандидаты в материале...");

    try {
      if (mode === "ready_json") {
        const parsedCandidates = normalizeReadyJson(material);

        if (parsedCandidates.length === 0) {
          throw new Error("В JSON не найдено карточек с title и teaser.");
        }

        setVerseText("");
        setSummary(
          `Готовые JSON-карточки распознаны: ${parsedCandidates.length}. Теперь их можно отправить в обычную проверку и сохранение.`,
        );
        setCandidates(parsedCandidates);
        onNotice?.(`Распознано карточек: ${parsedCandidates.length}.`);
        return;
      }

      const response = await fetch("/api/admin/studio/extract-cards-from-material", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: selectedVerse.reference,
          canonical_ref: selectedVerse.canonical_ref,
          lang,
          provider,
          material,
          direction: getModeDirection(mode, direction),
          mode,
        }),
      });

      const data = (await response.json()) as ManualExtractResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось извлечь кандидатов.");
      }

      const extractedVerseText =
        typeof data.verseText === "string" && data.verseText.trim()
          ? data.verseText.trim()
          : typeof data.verse_text === "string" && data.verse_text.trim()
            ? data.verse_text.trim()
            : "";

      setVerseText(extractedVerseText);
      setSummary(data.summary ?? "");
      setCandidates(data.candidates ?? []);
      setRejected(data.rejected ?? []);
      onNotice?.(`Найдено кандидатов: ${data.candidates?.length ?? 0}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось извлечь кандидатов.";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }

  async function saveCandidate(candidate: ExtractedCandidate): Promise<ProcessCandidateResponse | null> {
    if (!selectedVerse) {
      onError?.("Сначала выбери стих.");
      return null;
    }

    if (!adminSecret.trim()) {
      onError?.("Вставь Admin Secret.");
      return null;
    }

    const effectiveVerseText = verseText.trim() || selectedVerse.reference;

    setSaveStates((prev) => ({
      ...prev,
      [candidate.id]: {
        ...createEmptySaveState(prev[candidate.id]),
        loading: true,
        saved: false,
        error: "",
        message: "",
        duplicate: null,
        referenceMismatch: null,
        response: null,
      },
    }));

    onNotice?.(`Оцениваю и сохраняю: ${candidate.title}`);

    try {
      const response = await fetch("/api/admin/process-angle-candidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: selectedVerse.reference,
          verseText: effectiveVerseText,
          lang,
          provider,
          source_provider: provider,
          source_model: getSourceModelForMode(mode, provider),
          source_type: getSourceTypeForMode(mode),
          source_title: getModeLabel(mode),
          editor_provider: provider,
          targetFeaturedCount: 12,
          sourceArticle: material,
          candidate: {
            id: candidate.id,
            title: candidate.title,
            anchor: candidate.anchor,
            teaser: candidate.teaser,
            why_it_matters: candidate.why_it_matters,
            body: candidate.teaser,
          },
        }),
      });

      const data = (await response.json()) as ProcessCandidateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось оценить и сохранить кандидата.");
      }

      const message = getCandidateSaveMessage(data);

      setSaveStates((prev) => ({
        ...prev,
        [candidate.id]: {
          loading: false,
          saved: !data.skipped,
          error: "",
          message,
          duplicate: data.duplicate ?? null,
          referenceMismatch: data.reference_mismatch ?? null,
          response: data,
        },
      }));

      onNotice?.(message);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось оценить и сохранить кандидата.";

      setSaveStates((prev) => ({
        ...prev,
        [candidate.id]: {
          ...createEmptySaveState(prev[candidate.id]),
          loading: false,
          saved: false,
          error: message,
          duplicate: null,
          referenceMismatch: null,
          response: null,
        },
      }));

      onError?.(message);
      return null;
    }
  }

  async function saveSelectedCandidates() {
    if (batchLoading || loading) return;

    if (selectedCandidates.length === 0) {
      onError?.("Нет выбранных кандидатов для проверки.");
      return;
    }

    setBatchLoading(true);
    setBatchSummary({
      total: selectedCandidates.length,
      processed: 0,
      saved: 0,
      active: 0,
      reserve: 0,
      duplicates: 0,
      rejected: 0,
      mismatches: 0,
      errors: 0,
    });

    let summaryDraft: BatchSummary = {
      total: selectedCandidates.length,
      processed: 0,
      saved: 0,
      active: 0,
      reserve: 0,
      duplicates: 0,
      rejected: 0,
      mismatches: 0,
      errors: 0,
    };

    try {
      for (const candidate of selectedCandidates) {
        const result = await saveCandidate(candidate);

        summaryDraft = {
          ...summaryDraft,
          processed: summaryDraft.processed + 1,
        };

        if (!result) {
          summaryDraft.errors += 1;
        } else if (result.skipped) {
          if (
            result.skip_reason === "matched_duplicate" ||
            result.skip_reason === "matched_duplicate_after_rewrite"
          ) {
            summaryDraft.duplicates += 1;
          } else if (result.skip_reason === "reference_mismatch") {
            summaryDraft.mismatches += 1;
          } else {
            summaryDraft.rejected += 1;
          }
        } else {
          summaryDraft.saved += 1;

          if (result.status === "featured" || result.status === "featured_new") {
            summaryDraft.active += 1;
          } else if (result.status === "reserve") {
            summaryDraft.reserve += 1;
          }
        }

        setBatchSummary({ ...summaryDraft });
      }

      onNotice?.(
        `Готово. Сохранено: ${summaryDraft.saved}. Дубли: ${summaryDraft.duplicates}. Отклонено: ${summaryDraft.rejected}.`,
      );
    } finally {
      setBatchLoading(false);
    }
  }

  if (!selectedVerse) return null;

  return (
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
        Исследовательский материал
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
        Материал для новых углов
      </h3>

      <p style={{ margin: "0 0 12px", color: MUTED, fontSize: 13, lineHeight: 1.6 }}>
        Сюда можно вставить обычную заметку, статью, внешний Deep Search report
        или готовый JSON карточек. Claude распознает кандидатов, затем система
        сравнит их с уже сохранёнными углами.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          disabled={loading || batchLoading}
          onClick={() => {
            setMode("material");
            resetResults();
          }}
          style={smallButtonStyle(mode === "material", loading || batchLoading)}
        >
          Обычный материал
        </button>

        <button
          type="button"
          disabled={loading || batchLoading}
          onClick={() => {
            setMode("deep_report");
            resetResults();
          }}
          style={smallButtonStyle(mode === "deep_report", loading || batchLoading)}
        >
          Deep Search report
        </button>

        <button
          type="button"
          disabled={loading || batchLoading}
          onClick={() => {
            setMode("ready_json");
            resetResults();
          }}
          style={smallButtonStyle(mode === "ready_json", loading || batchLoading)}
        >
          Готовые карточки JSON
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as Provider)}
          disabled={loading || batchLoading}
          style={{
            border: `1px solid ${LINE}`,
            borderRadius: 999,
            background: CARD_ALT,
            color: SLATE_DARK,
            padding: "9px 12px",
            fontWeight: 850,
            fontFamily: "inherit",
            cursor: loading || batchLoading ? "not-allowed" : "pointer",
          }}
        >
          <option value="claude">Claude Sonnet 4.6</option>
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI / GPT</option>
        </select>

        <button
          type="button"
          disabled={loading || batchLoading}
          onClick={extractManualCandidates}
          style={buttonStyle(true, loading || batchLoading)}
        >
          {loading
            ? mode === "ready_json"
              ? "Распознаю..."
              : "Ищу..."
            : mode === "ready_json"
              ? "Распознать карточки"
              : "Создать карточки"}
        </button>

        {candidates.length > 0 ? (
          <button
            type="button"
            disabled={loading || batchLoading || selectedCandidates.length === 0}
            onClick={saveSelectedCandidates}
            style={buttonStyle(true, loading || batchLoading || selectedCandidates.length === 0)}
          >
            {batchLoading
              ? `Проверяю ${batchSummary?.processed ?? 0}/${batchSummary?.total ?? selectedCandidates.length}`
              : `Проверить и сохранить выбранные (${selectedCandidates.length})`}
          </button>
        ) : null}
      </div>

      <textarea
        value={direction}
        onChange={(event) => setDirection(event.target.value)}
        placeholder={
          mode === "ready_json"
            ? "Направление необязательно: что особенно проверить при оценке карточек..."
            : "Направление необязательно: какой угол важен, что сохранить, чего избегать..."
        }
        rows={2}
        disabled={loading || batchLoading}
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
        value={material}
        onChange={(event) => setMaterial(event.target.value)}
        placeholder={
          mode === "ready_json"
            ? 'Вставь сюда JSON: { "cards": [...] }'
            : mode === "deep_report"
              ? "Вставь сюда внешний Deep Search report..."
              : "Вставь сюда статью, фрагмент из линзы, свою мысль или заметку модератора..."
        }
        rows={7}
        disabled={loading || batchLoading}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${LINE}`,
          borderRadius: 14,
          padding: "12px 13px",
          background: "#fffaf3",
          color: INK,
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: "inherit",
          resize: "vertical",
          outlineColor: SLATE,
        }}
      />

      {error ? <MessageBox kind="error" text={error} style={{ marginTop: 10 }} /> : null}

      {summary ? <MessageBox kind="info" text={summary} style={{ marginTop: 12 }} /> : null}

      {batchSummary ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 7,
            marginTop: 12,
            padding: 11,
            borderRadius: 14,
            background: SLATE_SOFT,
            border: `1px solid rgba(111, 123, 136, 0.16)`,
          }}
        >
          {[
            `Всего: ${batchSummary.total}`,
            `Проверено: ${batchSummary.processed}`,
            `Сохранено: ${batchSummary.saved}`,
            `Активные: ${batchSummary.active}`,
            `Запас: ${batchSummary.reserve}`,
            `Дубли: ${batchSummary.duplicates}`,
            `Отклонено: ${batchSummary.rejected}`,
            `Чужой стих: ${batchSummary.mismatches}`,
            `Ошибки: ${batchSummary.errors}`,
          ].map((item) => (
            <span
              key={item}
              style={{
                borderRadius: 999,
                background: CARD,
                color: SLATE_DARK,
                padding: "6px 9px",
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <MessageBox
            kind="info"
            text={`Кандидатов: ${candidates.length}. Выбрано для проверки: ${selectedCandidates.length}. Ненужные можно исключить или удалить до массового сохранения.`}
          />

          {candidates.map((candidate) => {
            const saveState = saveStates[candidate.id] ?? createEmptySaveState();
            const excluded = excludedIds.has(candidate.id);

            return (
              <div
                key={candidate.id}
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: excluded ? "#f3f0ea" : CARD,
                  border: `1px solid ${excluded ? LINE_SOFT : LINE}`,
                  opacity: excluded ? 0.62 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 16,
                      lineHeight: 1.25,
                      fontFamily:
                        'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                      color: INK,
                    }}
                  >
                    {candidate.title}
                  </h4>

                  {scorePill(candidate.estimated_score)}
                </div>

                {candidate.anchor ? (
                  <p
                    style={{
                      margin: "8px 0 0",
                      color: MUTED,
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    "{candidate.anchor}"
                  </p>
                ) : null}

                <p style={{ margin: "9px 0 0", color: TEXT, fontSize: 13, lineHeight: 1.6 }}>
                  {candidate.teaser}
                </p>

                {candidate.why_it_matters ? (
                  <p
                    style={{
                      margin: "9px 0 0",
                      color: MUTED,
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    <strong style={{ color: SLATE_DARK }}>Почему важно: </strong>
                    {candidate.why_it_matters}
                  </p>
                ) : null}

                <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
                  {candidate.strength_reason ? (
                    <div style={{ color: SUCCESS_TEXT, fontSize: 12, lineHeight: 1.45 }}>
                      <strong>Сила / источник: </strong>
                      {candidate.strength_reason}
                    </div>
                  ) : null}

                  {candidate.risk ? (
                    <div style={{ color: WARNING_TEXT, fontSize: 12, lineHeight: 1.45 }}>
                      <strong>Риск: </strong>
                      {candidate.risk}
                    </div>
                  ) : null}

                  {candidate.source_excerpt ? (
                    <div
                      style={{
                        color: MUTED,
                        fontSize: 12,
                        lineHeight: 1.45,
                        paddingTop: 8,
                        borderTop: `1px solid ${LINE_SOFT}`,
                        fontStyle: "italic",
                      }}
                    >
                      “{candidate.source_excerpt}”
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
                  <button
                    type="button"
                    disabled={saveState.loading || batchLoading || excluded}
                    onClick={() => saveCandidate(candidate)}
                    style={buttonStyle(true, saveState.loading || batchLoading || excluded)}
                  >
                    {saveState.loading
                      ? "Оцениваю..."
                      : saveState.saved
                        ? "Сохранить ещё раз"
                        : "Оценить и сохранить"}
                  </button>

                  <button
                    type="button"
                    disabled={saveState.loading || batchLoading}
                    onClick={() => toggleExcluded(candidate.id)}
                    style={smallButtonStyle(excluded, saveState.loading || batchLoading)}
                  >
                    {excluded ? "Вернуть в выбранные" : "Исключить"}
                  </button>

                  <button
                    type="button"
                    disabled={saveState.loading || batchLoading}
                    onClick={() => removeCandidate(candidate.id)}
                    style={{
                      ...smallButtonStyle(false, saveState.loading || batchLoading),
                      color: ERROR_TEXT,
                      background: "#fff6f3",
                      borderColor: "rgba(139, 62, 46, 0.20)",
                    }}
                  >
                    Удалить кандидата
                  </button>
                </div>

                {excluded ? (
                  <MessageBox
                    kind="warning"
                    text="Кандидат исключён из массового сохранения."
                    style={{ marginTop: 10 }}
                  />
                ) : null}

                {saveState.error ? (
                  <MessageBox kind="error" text={saveState.error} style={{ marginTop: 10 }} />
                ) : null}

                {saveState.message ? (
                  <MessageBox
                    kind={saveState.saved ? "success" : "info"}
                    text={saveState.message}
                    style={{ marginTop: 10 }}
                  />
                ) : null}

                {saveState.referenceMismatch ? (
                  <ReferenceMismatchView mismatch={saveState.referenceMismatch} />
                ) : null}

                {saveState.duplicate ? <DuplicateBattleView duplicate={saveState.duplicate} /> : null}

                {saveState.response ? <DebugEvaluationView state={saveState} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {rejected.length > 0 ? (
        <details style={{ marginTop: 12 }}>
          <summary
            style={{
              cursor: "pointer",
              color: MUTED,
              fontSize: 13,
              fontWeight: 850,
            }}
          >
            Отклонённые слабые идеи: {rejected.length}
          </summary>

          <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
            {rejected.map((item, index) => (
              <div
                key={`${item.idea}-${index}`}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  background: WARNING_BG,
                  color: WARNING_TEXT,
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                <strong>{item.idea}</strong>
                <br />
                {item.reason}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
