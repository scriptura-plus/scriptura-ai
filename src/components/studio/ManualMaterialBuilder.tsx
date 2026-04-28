"use client";

import { useState, type CSSProperties } from "react";

type Lang = "ru" | "en" | "es";
type Provider = "openai" | "claude" | "gemini";
type ForceStatus = "reserve" | "featured";

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
  preview_only?: boolean;
  changed_database?: boolean;
  would_save?: boolean;
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
  final_evaluation?: {
    placement?: string;
    reason?: string | null;
    risk?: string | null;
    score_total?: number | null;
  };
};

type CandidateState = {
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
  message: string;
  duplicate: DuplicatePayload | null;
  preview: ProcessCandidateResponse | null;
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

function dangerButtonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid rgba(138, 99, 48, 0.28)",
    borderRadius: 999,
    background: disabled ? "#eee8de" : WARNING_BG,
    color: WARNING_TEXT,
    padding: "9px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
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

function createEmptyCandidateState(previous?: CandidateState): CandidateState {
  return {
    loading: false,
    saving: false,
    saved: previous?.saved ?? false,
    error: "",
    message: previous?.message ?? "",
    duplicate: previous?.duplicate ?? null,
    preview: previous?.preview ?? null,
  };
}

function getPreviewMessage(data: ProcessCandidateResponse): string {
  if (data.duplicate) {
    return "Найден похожий угол. Ничего не сохранено. Сравни старую и новую карточку ниже.";
  }

  if (data.skipped) {
    if (data.skip_reason === "score_below_save_threshold") {
      return "Кандидат оценён, но ниже порога сохранения. Можно не сохранять или сохранить вручную в запас.";
    }

    if (data.skip_reason === "placement_not_savable") {
      return "Кандидат оценён, но evaluator предлагает не сохранять.";
    }

    return `Кандидат оценён: ${data.skip_reason ?? "требуется решение модератора"}.`;
  }

  const score =
    typeof data.score_total === "number" && Number.isFinite(data.score_total)
      ? ` Оценка: ${data.score_total}.`
      : "";

  return `Оценка готова.${score} Ничего ещё не сохранено. Выбери действие.`;
}

function getSavedMessage(data: ProcessCandidateResponse, status: ForceStatus): string {
  const score =
    typeof data.score_total === "number" && Number.isFinite(data.score_total)
      ? ` Оценка: ${data.score_total}.`
      : "";

  return `Карточка сохранена в RU/EN/ES как ${
    status === "featured" ? "активная" : "запасная"
  }.${score}`;
}

function statusLabel(status?: string | null): string {
  if (!status) return "—";
  if (status === "featured") return "активная";
  if (status === "reserve") return "запас";
  if (status === "hidden") return "скрыта";
  if (status === "rejected") return "отклонена";
  if (status === "rewrite") return "на доработку";
  if (status === "manual") return "новый кандидат";
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
  if (cleaned === "manual_force_duplicate") return "Принудительно сохранённый дубль";
  if (cleaned.startsWith("initial_angles:gemini")) return "Первичная генерация Gemini";
  if (cleaned.startsWith("initial_angles:claude")) return "Первичная генерация Claude";
  if (cleaned.startsWith("initial_angles:openai")) return "Первичная генерация OpenAI";
  if (cleaned === "manual") return "Ручная обработка";
  if (cleaned === "manual_test") return "Ручной тест";
  if (cleaned === "studio_rewrite") return "Доработка в Studio";

  return cleaned;
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

      <p
        style={{
          margin: 0,
          color: TEXT,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {card.teaser}
      </p>

      {card.why_it_matters ? (
        <p
          style={{
            margin: "9px 0 0",
            color: MUTED,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: SLATE_DARK }}>Почему важно: </strong>
          {card.why_it_matters}
        </p>
      ) : null}
    </div>
  );
}

function DuplicateBattleView({
  duplicate,
  busy,
  onKeepOld,
  onSaveReserve,
  onSaveFeatured,
}: {
  duplicate: DuplicatePayload;
  busy: boolean;
  onKeepOld: () => void;
  onSaveReserve: () => void;
  onSaveFeatured: () => void;
}) {
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
    typeof duplicate.candidate_score === "number"
      ? duplicate.candidate_score
      : null;

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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button type="button" disabled={busy} onClick={onKeepOld} style={buttonStyle(false, busy)}>
          Оставить старую
        </button>

        <button type="button" disabled={busy} onClick={onSaveReserve} style={buttonStyle(false, busy)}>
          Сохранить нового в запас
        </button>

        <button type="button" disabled={busy} onClick={onSaveFeatured} style={dangerButtonStyle(busy)}>
          Сделать нового активным
        </button>
      </div>
    </div>
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
  const [provider, setProvider] = useState<Provider>("openai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [verseText, setVerseText] = useState("");
  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [rejected, setRejected] = useState<RejectedIdea[]>([]);
  const [candidateStates, setCandidateStates] = useState<Record<string, CandidateState>>({});

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
      onError?.("Вставь материал или мысль, из которой нужно сделать карточку.");
      return;
    }

    setLoading(true);
    setError("");
    setSummary("");
    setVerseText("");
    setCandidates([]);
    setRejected([]);
    setCandidateStates({});
    onNotice?.("Ищу кандидаты в материале...");

    try {
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
          direction,
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

  function buildCandidatePayload(candidate: ExtractedCandidate) {
    return {
      id: candidate.id,
      title: candidate.title,
      anchor: candidate.anchor,
      teaser: candidate.teaser,
      why_it_matters: candidate.why_it_matters,
      body: candidate.teaser,
    };
  }

  async function evaluateCandidate(candidate: ExtractedCandidate) {
    if (!selectedVerse) {
      onError?.("Сначала выбери стих.");
      return;
    }

    if (!adminSecret.trim()) {
      onError?.("Вставь Admin Secret.");
      return;
    }

    if (!verseText.trim()) {
      const message =
        "Не могу оценить: не найден текст стиха после извлечения кандидатов. Нажми «Найти кандидаты» ещё раз.";
      setCandidateStates((prev) => ({
        ...prev,
        [candidate.id]: {
          ...createEmptyCandidateState(prev[candidate.id]),
          error: message,
        },
      }));
      onError?.(message);
      return;
    }

    setCandidateStates((prev) => ({
      ...prev,
      [candidate.id]: {
        ...createEmptyCandidateState(prev[candidate.id]),
        loading: true,
        saved: false,
        error: "",
        message: "",
        duplicate: null,
        preview: null,
      },
    }));

    onNotice?.(`Оцениваю кандидата: ${candidate.title}`);

    try {
      const response = await fetch("/api/admin/process-angle-candidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          preview_only: true,
          reference: selectedVerse.reference,
          verseText,
          lang,
          provider,
          source_provider: provider,
          source_model: `manual_material:${provider}`,
          editor_provider: provider,
          targetFeaturedCount: 12,
          sourceArticle: material,
          candidate: buildCandidatePayload(candidate),
        }),
      });

      const data = (await response.json()) as ProcessCandidateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось оценить кандидата.");
      }

      const message = getPreviewMessage(data);

      setCandidateStates((prev) => ({
        ...prev,
        [candidate.id]: {
          loading: false,
          saving: false,
          saved: false,
          error: "",
          message,
          duplicate: data.duplicate ?? null,
          preview: data,
        },
      }));

      onNotice?.(message);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось оценить кандидата.";

      setCandidateStates((prev) => ({
        ...prev,
        [candidate.id]: {
          ...createEmptyCandidateState(prev[candidate.id]),
          loading: false,
          saved: false,
          error: message,
          duplicate: null,
          preview: null,
        },
      }));

      onError?.(message);
    }
  }

  async function saveCandidate(
    candidate: ExtractedCandidate,
    status: ForceStatus,
    forceDuplicate: boolean,
  ) {
    if (!selectedVerse) {
      onError?.("Сначала выбери стих.");
      return;
    }

    if (!adminSecret.trim()) {
      onError?.("Вставь Admin Secret.");
      return;
    }

    if (!verseText.trim()) {
      onError?.("Не найден текст стиха. Нажми «Найти кандидаты» ещё раз.");
      return;
    }

    setCandidateStates((prev) => ({
      ...prev,
      [candidate.id]: {
        ...createEmptyCandidateState(prev[candidate.id]),
        saving: true,
        error: "",
      },
    }));

    onNotice?.(
      status === "featured"
        ? `Сохраняю кандидата как активного: ${candidate.title}`
        : `Сохраняю кандидата в запас: ${candidate.title}`,
    );

    try {
      const response = await fetch("/api/admin/process-angle-candidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          force_save_duplicate: forceDuplicate,
          force_status: status,
          reference: selectedVerse.reference,
          verseText,
          lang,
          provider,
          source_provider: provider,
          source_model: `manual_material:${provider}`,
          editor_provider: provider,
          targetFeaturedCount: 12,
          sourceArticle: material,
          candidate: buildCandidatePayload(candidate),
        }),
      });

      const data = (await response.json()) as ProcessCandidateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось сохранить кандидата.");
      }

      if (data.skipped && !forceDuplicate) {
        const message = getPreviewMessage(data);
        setCandidateStates((prev) => ({
          ...prev,
          [candidate.id]: {
            loading: false,
            saving: false,
            saved: false,
            error: "",
            message,
            duplicate: data.duplicate ?? null,
            preview: data,
          },
        }));
        onNotice?.(message);
        return;
      }

      const message = getSavedMessage(data, status);

      setCandidateStates((prev) => ({
        ...prev,
        [candidate.id]: {
          loading: false,
          saving: false,
          saved: true,
          error: "",
          message,
          duplicate: data.duplicate ?? prev[candidate.id]?.duplicate ?? null,
          preview: prev[candidate.id]?.preview ?? data,
        },
      }));

      onNotice?.(message);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сохранить кандидата.";

      setCandidateStates((prev) => ({
        ...prev,
        [candidate.id]: {
          ...createEmptyCandidateState(prev[candidate.id]),
          saving: false,
          saved: false,
          error: message,
        },
      }));

      onError?.(message);
    }
  }

  function keepOld(candidate: ExtractedCandidate) {
    setCandidateStates((prev) => ({
      ...prev,
      [candidate.id]: {
        ...createEmptyCandidateState(prev[candidate.id]),
        saved: false,
        message: "Оставили существующую карточку. Новый кандидат не сохранён.",
      },
    }));
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
        Ручной материал
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
        Новая карточка из материала
      </h3>

      <p
        style={{
          margin: "0 0 12px",
          color: MUTED,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Вставь найденную мысль, длинную статью, заметку из линзы или свой угол.
        Система предложит кандидатов, но не сохранит их без отдельного решения модератора.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as Provider)}
          disabled={loading}
          style={{
            border: `1px solid ${LINE}`,
            borderRadius: 999,
            background: CARD_ALT,
            color: SLATE_DARK,
            padding: "9px 12px",
            fontWeight: 850,
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <option value="openai">OpenAI / GPT</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
        </select>

        <button
          type="button"
          disabled={loading}
          onClick={extractManualCandidates}
          style={buttonStyle(true, loading)}
        >
          {loading ? "Ищу..." : "Найти кандидаты"}
        </button>
      </div>

      <textarea
        value={direction}
        onChange={(event) => setDirection(event.target.value)}
        placeholder="Направление необязательно: какой угол важен, что сохранить, чего избегать..."
        rows={2}
        disabled={loading}
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
        placeholder="Вставь сюда статью, фрагмент из линзы, свою мысль или заметку модератора..."
        rows={6}
        disabled={loading}
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

      {summary ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            background: SLATE_SOFT,
            border: `1px solid rgba(111, 123, 136, 0.16)`,
            color: SLATE_DARK,
            fontSize: 13,
            lineHeight: 1.55,
            fontWeight: 750,
          }}
        >
          {summary}
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {candidates.map((candidate) => {
            const state =
              candidateStates[candidate.id] ?? createEmptyCandidateState();

            const busy = state.loading || state.saving;
            const hasPreview = Boolean(state.preview);
            const hasDuplicate = Boolean(state.duplicate);

            return (
              <div
                key={candidate.id}
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: CARD,
                  border: `1px solid ${LINE}`,
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

                <p
                  style={{
                    margin: "9px 0 0",
                    color: TEXT,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
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
                      <strong>Сила: </strong>
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
                    disabled={busy}
                    onClick={() => evaluateCandidate(candidate)}
                    style={buttonStyle(true, busy)}
                  >
                    {state.loading ? "Оцениваю..." : "Оценить кандидата"}
                  </button>

                  {hasPreview && !hasDuplicate && !state.saved ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveCandidate(candidate, "reserve", false)}
                        style={buttonStyle(false, busy)}
                      >
                        Сохранить в запас
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveCandidate(candidate, "featured", false)}
                        style={dangerButtonStyle(busy)}
                      >
                        Сделать активной
                      </button>
                    </>
                  ) : null}

                  {state.saved ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "9px 12px",
                        background: SUCCESS_BG,
                        color: SUCCESS_TEXT,
                        fontSize: 13,
                        fontWeight: 850,
                      }}
                    >
                      Уже сохранено
                    </span>
                  ) : null}
                </div>

                {state.error ? (
                  <MessageBox kind="error" text={state.error} style={{ marginTop: 10 }} />
                ) : null}

                {state.message ? (
                  <MessageBox
                    kind={state.saved ? "success" : hasDuplicate ? "warning" : "info"}
                    text={state.message}
                    style={{ marginTop: 10 }}
                  />
                ) : null}

                {state.duplicate ? (
                  <DuplicateBattleView
                    duplicate={state.duplicate}
                    busy={busy}
                    onKeepOld={() => keepOld(candidate)}
                    onSaveReserve={() => saveCandidate(candidate, "reserve", true)}
                    onSaveFeatured={() => saveCandidate(candidate, "featured", true)}
                  />
                ) : null}
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
