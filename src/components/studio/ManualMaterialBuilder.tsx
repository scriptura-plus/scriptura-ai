"use client";

import { useState, type CSSProperties } from "react";

type Lang = "ru" | "en" | "es";
type Provider = "openai" | "claude" | "gemini";

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
};

type SaveState = {
  loading: boolean;
  saved: boolean;
  error: string;
  message: string;
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
    boxShadow: primary && !disabled ? "0 8px 18px rgba(91, 102, 114, 0.16)" : "none",
  };
}

function scorePill(score: number | null) {
  if (score === null) return null;

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
  kind: "error" | "success" | "info";
  text: string;
  style?: CSSProperties;
}) {
  const isError = kind === "error";
  const isSuccess = kind === "success";

  return (
    <div
      style={{
        padding: "10px 11px",
        borderRadius: 12,
        background: isError ? ERROR_BG : isSuccess ? SUCCESS_BG : SLATE_SOFT,
        color: isError ? ERROR_TEXT : isSuccess ? SUCCESS_TEXT : SLATE_DARK,
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
  };
}

function getCandidateSaveMessage(data: ProcessCandidateResponse): string {
  if (data.skipped) {
    if (data.skip_reason === "matched_duplicate") {
      return "Не сохранено: система сочла это дублем уже существующей карточки.";
    }

    if (data.skip_reason === "matched_duplicate_after_rewrite") {
      return "Не сохранено: после доработки система всё равно сочла это дублем.";
    }

    if (data.skip_reason === "score_below_save_threshold") {
      return "Не сохранено: оценка ниже порога сохранения.";
    }

    if (data.skip_reason === "placement_not_savable") {
      return "Не сохранено: evaluator предложил скрыть или отклонить карточку.";
    }

    return `Не сохранено: ${data.skip_reason ?? "кандидат не прошёл фильтр"}.`;
  }

  const score =
    typeof data.score_total === "number" && Number.isFinite(data.score_total)
      ? ` Оценка: ${data.score_total}.`
      : "";

  const status = data.status ? ` Статус: ${data.status}.` : "";

  return `Карточка сохранена в RU/EN/ES.${score}${status}`;
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
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

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
    setSaveStates({});
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

  async function saveCandidate(candidate: ExtractedCandidate) {
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
        "Не могу сохранить: не найден текст стиха после извлечения кандидатов. Нажми «Найти кандидаты» ещё раз.";
      setSaveStates((prev) => ({
        ...prev,
        [candidate.id]: {
          ...createEmptySaveState(prev[candidate.id]),
          error: message,
        },
      }));
      onError?.(message);
      return;
    }

    setSaveStates((prev) => ({
      ...prev,
      [candidate.id]: {
        ...createEmptySaveState(prev[candidate.id]),
        loading: true,
        saved: false,
        error: "",
        message: "",
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
          verseText,
          lang,
          provider,
          source_provider: provider,
          source_model: `manual_material:${provider}`,
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
        },
      }));

      onNotice?.(message);
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
        },
      }));

      onError?.(message);
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
        Система предложит 1–5 кандидатов для текущего выбранного стиха.
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
            const saveState = saveStates[candidate.id] ?? createEmptySaveState();

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
                    disabled={saveState.loading}
                    onClick={() => saveCandidate(candidate)}
                    style={buttonStyle(true, saveState.loading)}
                  >
                    {saveState.loading
                      ? "Оцениваю..."
                      : saveState.saved
                        ? "Сохранить ещё раз"
                        : "Оценить и сохранить"}
                  </button>
                </div>

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
