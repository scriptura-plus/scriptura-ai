"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReference } from "@/lib/bible/formatReference";

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
  loading: boolean;
  applying: boolean;
  applied: boolean;
  error: string;
  applyError: string;
  result: RewriteCardResponse | null;
};

const ACCENT = "#6d86a0";
const ACCENT_DARK = "#506579";
const ACCENT_SOFT = "#dbe7f1";
const ACCENT_PALE = "#eef4f8";

const PAPER = "#fbf7ef";
const PAPER_2 = "#f7f1e6";
const PAGE = "#f4ede1";
const INK = "#2f271f";
const SOFT = "#685746";
const LINE = "#d8ccb6";
const LINE_SOFT = "#e7dcc9";

const SUCCESS_BG = "#e5efde";
const SUCCESS_TEXT = "#4f6a3b";
const WARNING_BG = "#f6ead0";
const WARNING_TEXT = "#8a6432";
const ERROR_BG = "#f7ddd4";
const ERROR_TEXT = "#8a3e27";

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
    .replace("word_card_article", "word")
    .trim();
}

function readableSourceLabel(source: string): string {
  const cleaned = cleanSource(source);

  if (cleaned === "word") return "Word Lens";
  if (cleaned === "context") return "Context Lens";
  if (cleaned === "intertext") return "Связи с другими стихами";
  if (cleaned === "scripture_links") return "Связи с другими стихами";
  if (cleaned === "socio") return "Социально-историческая линза";
  if (cleaned === "historical_scene") return "Историческая сцена";
  if (cleaned === "genre") return "Жанровая линза";
  if (cleaned === "rhetoric") return "Риторическая линза";
  if (cleaned === "structure") return "Структурная линза";
  if (cleaned === "translation") return "Translation Lens";
  if (cleaned === "tension") return "Tension Lens";
  if (cleaned === "phrase") return "Почему именно эта фраза";
  if (cleaned === "text_findings") return "Текстовые находки";

  if (cleaned.startsWith("initial_angles:gemini")) {
    return "Первичная генерация Gemini";
  }

  if (cleaned.startsWith("initial_angles:claude")) {
    return "Первичная генерация Claude";
  }

  if (
    cleaned.startsWith("initial_angles:openai") ||
    cleaned.startsWith("initial_angles:gpt")
  ) {
    return "Первичная генерация OpenAI";
  }

  if (cleaned === "generated_candidates_v2") {
    return "Ручная генерация кандидатов";
  }

  if (cleaned === "generated_candidates_v1") {
    return "Старая генерация кандидатов";
  }

  if (cleaned === "manual") return "Ручная обработка";
  if (cleaned === "manual_test") return "Ручной тест";
  if (cleaned === "studio_rewrite") return "Доработка в Studio";
  if (cleaned === "unknown") return "Неизвестно";

  return cleaned;
}

function sourceListLabel(sources: string[]): string {
  if (!sources.length) return "Источник: неизвестно";
  return `Источники: ${sources.map(readableSourceLabel).join(", ")}`;
}

function getCardSource(card: StudioCard): string {
  return readableSourceLabel(card.source_model || card.source_type || "unknown");
}

function statusLabel(status: string): string {
  if (status === "featured") return "активная";
  if (status === "reserve") return "запас";
  if (status === "hidden") return "скрыта";
  if (status === "rejected") return "отклонена";
  if (status === "rewrite") return "на доработке";
  return status;
}

function shortStatusLabel(status: string): string {
  if (status === "featured") return "активных";
  if (status === "reserve") return "в запасе";
  if (status === "hidden") return "скрытых";
  if (status === "rejected") return "отклонённых";
  if (status === "rewrite") return "на доработке";
  return status;
}

function statusTone(status: string) {
  if (status === "featured") {
    return {
      bg: "#d9e8f5",
      text: "#47627d",
      border: "rgba(71,98,125,0.14)",
    };
  }

  if (status === "reserve") {
    return {
      bg: "#ece8dd",
      text: "#6c6354",
      border: "rgba(108,99,84,0.14)",
    };
  }

  if (status === "rewrite") {
    return {
      bg: WARNING_BG,
      text: WARNING_TEXT,
      border: "rgba(138,100,50,0.16)",
    };
  }

  if (status === "hidden") {
    return {
      bg: "#ebe6e0",
      text: "#776b5d",
      border: "rgba(119,107,93,0.14)",
    };
  }

  if (status === "rejected") {
    return {
      bg: "#f1e1dc",
      text: "#8a4a36",
      border: "rgba(138,74,54,0.14)",
    };
  }

  return {
    bg: "#ece8dd",
    text: "#6c6354",
    border: "rgba(108,99,84,0.14)",
  };
}

function coverageLabel(type: string | null): string | null {
  if (!type) return null;

  if (type === "lexical") return "слово / лексика";
  if (type === "grammatical") return "грамматика";
  if (type === "structural") return "структура";
  if (type === "contextual") return "контекст";
  if (type === "translation") return "перевод";
  if (type === "rhetorical") return "риторика";
  if (type === "historical") return "история";
  if (type === "conceptual") return "идея";
  if (type === "other") return "другое";

  return type;
}

function getButtonStyle(active = false, disabled = false) {
  return {
    border: `1px solid ${active ? ACCENT : "rgba(109, 134, 160, 0.25)"}`,
    borderRadius: 999,
    background: active ? ACCENT : "#f3f6f8",
    color: active ? "#ffffff" : ACCENT_DARK,
    padding: "10px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: active ? "0 8px 20px rgba(109, 134, 160, 0.22)" : "none",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getSmallButtonStyle(disabled = false) {
  return {
    border: `1px solid rgba(109, 134, 160, 0.28)`,
    borderRadius: 999,
    background: disabled ? "#eef0f2" : ACCENT_PALE,
    color: ACCENT_DARK,
    padding: "8px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
  } as const;
}

function getApplyButtonStyle(disabled = false) {
  return {
    border: `1px solid ${disabled ? "rgba(109, 134, 160, 0.24)" : ACCENT}`,
    borderRadius: 999,
    background: disabled ? "#eef0f2" : ACCENT,
    color: disabled ? ACCENT_DARK : "#ffffff",
    padding: "8px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: disabled ? "none" : "0 8px 18px rgba(109, 134, 160, 0.2)",
  } as const;
}

function getRepairButtonStyle(disabled = false) {
  return {
    border: `1px solid ${
      disabled ? "rgba(138,100,50,0.2)" : "rgba(138,100,50,0.34)"
    }`,
    borderRadius: 999,
    background: disabled ? "#f0ebdf" : WARNING_BG,
    color: WARNING_TEXT,
    padding: "8px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
  } as const;
}

function getModeButtonStyle(active = false, disabled = false) {
  return {
    border: `1px solid ${active ? ACCENT : "rgba(109, 134, 160, 0.22)"}`,
    borderRadius: 12,
    background: active ? ACCENT : "#fffaf3",
    color: active ? "#ffffff" : ACCENT_DARK,
    padding: "9px 10px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 850,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: active ? "0 6px 16px rgba(109, 134, 160, 0.18)" : "none",
  } as const;
}

function getEvaluationScore(
  result: ReEvaluateResponse | RewriteCardResponse | null,
): number | null {
  const score = result?.evaluation?.score_total;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getEvaluationPlacement(
  result: ReEvaluateResponse | RewriteCardResponse | null,
): string | null {
  const placement = result?.evaluation?.placement;
  return typeof placement === "string" && placement.trim() ? placement.trim() : null;
}

function getEvaluationReason(
  result: ReEvaluateResponse | RewriteCardResponse | null,
): string | null {
  const reason = result?.evaluation?.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function getEvaluationRisk(
  result: ReEvaluateResponse | RewriteCardResponse | null,
): string | null {
  const risk = result?.evaluation?.risk;
  return typeof risk === "string" && risk.trim() ? risk.trim() : null;
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

    if (
      typeof card.score_total === "number" &&
      (bestScore === null || card.score_total > bestScore)
    ) {
      bestScore = card.score_total;
    }

    sources.add(getCardSource(card));
  }

  summary.best_score = bestScore;
  summary.sources = Array.from(sources);

  return summary;
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

  const [loadingVerses, setLoadingVerses] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);

  const [versesError, setVersesError] = useState("");
  const [cardsError, setCardsError] = useState("");
  const [notice, setNotice] = useState("");

  const [reEvaluations, setReEvaluations] = useState<Record<string, ReEvaluateState>>({});
  const [retranslations, setRetranslations] = useState<Record<string, RetranslateState>>({});
  const [rewrites, setRewrites] = useState<Record<string, RewriteState>>({});

  const selectedVerse = useMemo(() => {
    return verses.find((verse) => verse.reference === selectedReference) ?? null;
  }, [verses, selectedReference]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secretLoaded, adminSecret]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice("");
    }, 3500);
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

      if (
        selectedReference &&
        !nextVerses.some((v) => v.reference === selectedReference)
      ) {
        setSelectedReference("");
        setCards([]);
        setCardsSummary(null);
      }
    } catch (error) {
      setVersesError(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить активность.",
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

      setCards(data.cards ?? []);
      setCardsSummary(data.summary ?? null);
      setNotice(`Карточки загружены: ${data.cards?.length ?? 0}.`);
    } catch (error) {
      setCards([]);
      setCardsSummary(null);
      setCardsError(
        error instanceof Error ? error.message : "Не удалось загрузить карточки.",
      );
      setNotice("");
    } finally {
      setLoadingCards(false);
    }
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
        const nextCards = prevCards.map((current) => {
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
        });

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
            error instanceof Error
              ? error.message
              : "Не удалось применить оценку.",
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
        `Доработка готова: ${
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
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось подготовить доработку.",
        },
      }));
      setNotice("");
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

    setRewrites((prev) => ({
      ...prev,
      [card.id]: {
        ...createEmptyRewriteState(prev[card.id]),
        rewriteMode: prev[card.id]?.rewriteMode ?? "polish",
        instruction: prev[card.id]?.instruction ?? "",
        extraMaterial: prev[card.id]?.extraMaterial ?? "",
        result: prev[card.id]?.result ?? null,
        applying: true,
      },
    }));

    setNotice(`Применяю доработку RU/EN/ES: ${card.title}`);

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
          evaluation: state.result.evaluation,
        }),
      });

      const data = (await response.json()) as ApplyRewriteResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось применить доработку.");
      }

      setCards((prevCards) => {
        const nextCards = prevCards.map((current) => {
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
        });

        setCardsSummary(summarizeCards(nextCards));
        return nextCards;
      });

      setRewrites((prev) => ({
        ...prev,
        [card.id]: {
          rewriteMode: prev[card.id]?.rewriteMode ?? "polish",
          instruction: prev[card.id]?.instruction ?? "",
          extraMaterial: prev[card.id]?.extraMaterial ?? "",
          loading: false,
          applying: false,
          applied: true,
          error: "",
          applyError: "",
          result: prev[card.id]?.result ?? null,
        },
      }));

      setNotice("Доработка применена. RU/EN/ES версии обновлены.");
    } catch (error) {
      setRewrites((prev) => ({
        ...prev,
        [card.id]: {
          ...createEmptyRewriteState(prev[card.id]),
          rewriteMode: prev[card.id]?.rewriteMode ?? "polish",
          instruction: prev[card.id]?.instruction ?? "",
          extraMaterial: prev[card.id]?.extraMaterial ?? "",
          result: prev[card.id]?.result ?? null,
          applying: false,
          applyError:
            error instanceof Error
              ? error.message
              : "Не удалось применить доработку.",
        },
      }));
      setNotice("");
    }
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
        background:
          "linear-gradient(180deg, #f4eee2 0%, #f6efe4 38%, #f3ecdf 100%)",
        color: INK,
        padding: "22px 14px 80px",
        fontFamily:
          'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes studio-shimmer {
          0% { background-position: 220% 0; }
          100% { background-position: -220% 0; }
        }
        .studio-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 16px;
        }
        @media (max-width: 860px) {
          .studio-layout {
            grid-template-columns: 1fr;
          }
        }
        .studio-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(109, 134, 160, 0.45) transparent;
        }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: ACCENT_DARK,
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
              fontSize: 34,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Живая работа системы
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: SOFT,
              fontSize: 15,
              lineHeight: 1.6,
              maxWidth: 760,
            }}
          >
            Здесь видно, какие стихи недавно получили жемчужины, откуда они
            пришли, какие карточки активны, что лежит в запасе и что уже стоит
            доработать.
          </p>
        </header>

        <section
          style={{
            background:
              "linear-gradient(180deg, rgba(251,247,239,0.96) 0%, rgba(247,241,230,0.98) 100%)",
            border: `1px solid ${LINE}`,
            borderRadius: 22,
            padding: 18,
            boxShadow:
              "0 1px 2px rgba(60,40,20,0.06), 0 14px 34px rgba(60,40,20,0.08)",
            marginBottom: 16,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: SOFT,
              marginBottom: 8,
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
              borderRadius: 14,
              padding: "13px 14px",
              background: "#fffdf8",
              color: INK,
              fontSize: 15,
              boxSizing: "border-box",
              outlineColor: ACCENT,
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
                border: `1px solid rgba(109, 134, 160, 0.28)`,
                borderRadius: 999,
                background: "#f3f6f8",
                color: ACCENT_DARK,
                padding: "10px 12px",
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
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: ACCENT_SOFT,
                color: ACCENT_DARK,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {notice}
            </div>
          ) : null}

          {versesError ? (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: ERROR_BG,
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
              background:
                "linear-gradient(180deg, rgba(251,247,239,0.96) 0%, rgba(247,241,230,0.98) 100%)",
              border: `1px solid ${LINE}`,
              borderRadius: 22,
              padding: 16,
              boxShadow:
                "0 1px 2px rgba(60,40,20,0.06), 0 14px 34px rgba(60,40,20,0.08)",
              minHeight: 340,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  margin: 0,
                  fontFamily:
                    'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                }}
              >
                Недавние стихи
              </h2>
              <span style={{ fontSize: 13, color: SOFT }}>{verses.length} найдено</span>
            </div>

            {loadingVerses ? (
              <div style={{ display: "grid", gap: 9 }}>
                <Skeleton width="80%" />
                <Skeleton width="92%" />
                <Skeleton width="65%" />
              </div>
            ) : null}

            {!loadingVerses && verses.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "#fffcf6",
                  border: `1px dashed ${LINE}`,
                  color: SOFT,
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                Пока нет загруженной активности. Нажми «Обновить».
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12 }}>
              {verses.map((verse) => {
                const active = verse.reference === selectedReference;

                return (
                  <button
                    key={`${verse.lang}-${verse.canonical_ref ?? verse.reference}`}
                    type="button"
                    onClick={() => loadCards(verse)}
                    disabled={loadingCards && active}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${
                        active ? ACCENT : "rgba(216, 204, 182, 0.96)"
                      }`,
                      background: active ? "#edf4fa" : "#fffcf7",
                      borderRadius: 18,
                      padding: 14,
                      cursor: "pointer",
                      color: INK,
                      fontFamily: "inherit",
                      boxShadow: active
                        ? "0 10px 24px rgba(109,134,160,0.16)"
                        : "0 2px 8px rgba(60,40,20,0.03)",
                      transition:
                        "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 16,
                        marginBottom: 8,
                        color: active ? ACCENT_DARK : INK,
                        lineHeight: 1.3,
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

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginBottom: 8,
                      }}
                    >
                      <Badge text={`${verse.featured_count} ${shortStatusLabel("featured")}`} strong />
                      {verse.reserve_count > 0 ? (
                        <Badge text={`${verse.reserve_count} ${shortStatusLabel("reserve")}`} />
                      ) : null}
                      {verse.best_score !== null ? (
                        <Badge text={`лучшая оценка: ${verse.best_score}`} />
                      ) : null}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: SOFT,
                        lineHeight: 1.52,
                      }}
                    >
                      {sourceListLabel(verse.sources)}
                      <br />
                      {formatDate(verse.last_activity_at)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            style={{
              background:
                "linear-gradient(180deg, rgba(251,247,239,0.96) 0%, rgba(247,241,230,0.98) 100%)",
              border: `1px solid ${LINE}`,
              borderRadius: 22,
              padding: 16,
              boxShadow:
                "0 1px 2px rgba(60,40,20,0.06), 0 14px 34px rgba(60,40,20,0.08)",
              minHeight: 340,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  margin: 0,
                  fontFamily:
                    'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                }}
              >
                {selectedVerse ? displayReference(selectedVerse) : "Карточки стиха"}
              </h2>
              {selectedVerse ? (
                <span style={{ fontSize: 13, color: SOFT }}>
                  {formatDate(selectedVerse.last_activity_at)}
                </span>
              ) : null}
            </div>

            {cardsSummary ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <Badge text={`${cardsSummary.featured} ${shortStatusLabel("featured")}`} strong />
                {cardsSummary.reserve > 0 ? (
                  <Badge text={`${cardsSummary.reserve} ${shortStatusLabel("reserve")}`} />
                ) : null}
                {cardsSummary.hidden > 0 ? (
                  <Badge text={`${cardsSummary.hidden} ${shortStatusLabel("hidden")}`} />
                ) : null}
                {cardsSummary.best_score !== null ? (
                  <Badge text={`лучшая оценка: ${cardsSummary.best_score}`} />
                ) : null}
              </div>
            ) : null}

            {cardsSummary?.sources?.length ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "#f4f7fa",
                  border: `1px solid ${LINE_SOFT}`,
                  color: SOFT,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {sourceListLabel(cardsSummary.sources)}
              </div>
            ) : null}

            {loadingCards ? (
              <div style={{ display: "grid", gap: 9 }}>
                <Skeleton width="75%" />
                <Skeleton width="95%" />
                <Skeleton width="62%" />
              </div>
            ) : null}

            {cardsError ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: ERROR_BG,
                  color: ERROR_TEXT,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {cardsError}
              </div>
            ) : null}

            {!loadingCards && !cardsError && !selectedReference ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "#fffcf6",
                  border: `1px dashed ${LINE}`,
                  color: SOFT,
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                Выбери стих слева, чтобы увидеть карточки.
              </div>
            ) : null}

            {!loadingCards && !cardsError && selectedReference && cards.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "#fffcf6",
                  border: `1px dashed ${LINE}`,
                  color: SOFT,
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                По этому стиху карточки не найдены.
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 14 }}>
              {cards.map((card) => {
                const reEval = reEvaluations[card.id] ?? createEmptyReEvaluateState();
                const retranslation =
                  retranslations[card.id] ?? createEmptyRetranslateState();
                const rewrite = rewrites[card.id] ?? createEmptyRewriteState();

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

                const tone = statusTone(card.status);

                return (
                  <article
                    key={card.id}
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: 18,
                      padding: 15,
                      background: "#fffcf7",
                      boxShadow: "0 2px 10px rgba(60,40,20,0.03)",
                    }}
                  >
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
                          fontSize: 18,
                          lineHeight: 1.25,
                          fontFamily:
                            'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                        }}
                      >
                        {card.title}
                      </h3>

                      {card.score_total !== null ? (
                        <span
                          style={{
                            background: ACCENT,
                            color: "#fff",
                            borderRadius: 999,
                            padding: "6px 9px",
                            fontSize: 12,
                            fontWeight: 900,
                            flexShrink: 0,
                            boxShadow: "0 6px 16px rgba(109,134,160,0.2)",
                          }}
                        >
                          {card.score_total}
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginBottom: 10,
                      }}
                    >
                      <StatusPill text={`Статус: ${statusLabel(card.status)}`} tone={tone} />
                      {coverageLabel(card.coverage_type) ? (
                        <Badge text={`Тип: ${coverageLabel(card.coverage_type)}`} />
                      ) : null}
                      <Badge text={`Источник: ${getCardSource(card)}`} />
                    </div>

                    {card.anchor ? (
                      <p
                        style={{
                          margin: "0 0 10px",
                          color: SOFT,
                          fontSize: 13,
                          lineHeight: 1.55,
                          fontStyle: "italic",
                        }}
                      >
                        "{card.anchor}"
                      </p>
                    ) : null}

                    <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.68 }}>
                      {card.teaser}
                    </p>

                    {card.why_it_matters ? (
                      <p
                        style={{
                          margin: 0,
                          borderTop: `1px solid ${LINE_SOFT}`,
                          paddingTop: 10,
                          color: SOFT,
                          fontSize: 13,
                          lineHeight: 1.56,
                        }}
                      >
                        <strong style={{ color: ACCENT_DARK }}>Почему важно: </strong>
                        {card.why_it_matters}
                      </p>
                    ) : null}

                    <details style={{ marginTop: 12 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: ACCENT_DARK,
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        Оценка / угол
                      </summary>

                      <div
                        style={{
                          marginTop: 10,
                          padding: 12,
                          borderRadius: 14,
                          border: `1px solid rgba(109, 134, 160, 0.16)`,
                          background: "#f5f8fb",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 7,
                            marginBottom: 10,
                          }}
                        >
                          <Badge
                            text={`Текущая оценка: ${
                              card.score_total === null ? "—" : card.score_total
                            }`}
                            strong
                          />
                          <Badge text={`Статус: ${statusLabel(card.status)}`} />
                          {coverageLabel(card.coverage_type) ? (
                            <Badge text={`Тип: ${coverageLabel(card.coverage_type)}`} />
                          ) : null}
                        </div>

                        <p
                          style={{
                            margin: "0 0 10px",
                            color: SOFT,
                            fontSize: 13,
                            lineHeight: 1.55,
                          }}
                        >
                          Здесь можно заново оценить карточку по новому стандарту,
                          исправить перевод или подготовить новую редакцию.
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            disabled={
                              reEval.loading ||
                              reEval.applying ||
                              retranslation.loading ||
                              rewrite.loading ||
                              rewrite.applying
                            }
                            onClick={() => reEvaluateCard(card)}
                            style={getSmallButtonStyle(
                              reEval.loading ||
                                reEval.applying ||
                                retranslation.loading ||
                                rewrite.loading ||
                                rewrite.applying,
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
                              rewrite.applying
                            }
                            onClick={() => retranslateCard(card)}
                            style={getRepairButtonStyle(
                              retranslation.loading ||
                                reEval.loading ||
                                reEval.applying ||
                                rewrite.loading ||
                                rewrite.applying,
                            )}
                          >
                            {retranslation.loading ? "Перевожу..." : "Перевести заново"}
                          </button>
                        </div>

                        {retranslation.error ? (
                          <PanelMessage tone="error">{retranslation.error}</PanelMessage>
                        ) : null}

                        {retranslation.applied ? (
                          <PanelMessage tone="success">
                            Карточка переведена заново. Текст обновлён.
                          </PanelMessage>
                        ) : null}

                        {reEval.error ? (
                          <PanelMessage tone="error">{reEval.error}</PanelMessage>
                        ) : null}

                        {reEval.result ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 12,
                              borderRadius: 14,
                              background: "#fffcf7",
                              border: `1px solid ${LINE}`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 7,
                                marginBottom: 10,
                              }}
                            >
                              <Badge
                                text={`Новая оценка: ${newScore === null ? "—" : newScore}`}
                                strong
                              />
                              {newPlacement ? (
                                <Badge text={`Предложение: ${newPlacement}`} />
                              ) : null}
                              {reEval.result.verse_text_source ? (
                                <Badge text={`Текст стиха: ${reEval.result.verse_text_source}`} />
                              ) : null}
                            </div>

                            {reason ? (
                              <p
                                style={{
                                  margin: "0 0 8px",
                                  color: SOFT,
                                  fontSize: 13,
                                  lineHeight: 1.55,
                                }}
                              >
                                <strong style={{ color: ACCENT_DARK }}>Причина: </strong>
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
                              <PanelMessage tone="success">
                                Оценка применена. База обновлена.
                              </PanelMessage>
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
                              <PanelMessage tone="error">{reEval.applyError}</PanelMessage>
                            ) : null}
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 14,
                            background: "#fffcf7",
                            border: `1px solid ${LINE}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              color: ACCENT_DARK,
                              marginBottom: 8,
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
                              color: SOFT,
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
                              borderRadius: 12,
                              padding: "10px 11px",
                              background: "#fffdf8",
                              color: INK,
                              fontSize: 13,
                              lineHeight: 1.5,
                              fontFamily: "inherit",
                              resize: "vertical",
                              outlineColor: ACCENT,
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
                              borderRadius: 12,
                              padding: "10px 11px",
                              background: "#fffdf8",
                              color: INK,
                              fontSize: 13,
                              lineHeight: 1.5,
                              fontFamily: "inherit",
                              resize: "vertical",
                              outlineColor: ACCENT,
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
                              retranslation.loading
                            }
                            onClick={() => previewRewrite(card)}
                            style={getSmallButtonStyle(
                              rewrite.loading ||
                                rewrite.applying ||
                                reEval.loading ||
                                reEval.applying ||
                                retranslation.loading,
                            )}
                          >
                            {rewrite.loading ? "Готовлю..." : "Сделать вариант"}
                          </button>

                          {rewrite.error ? (
                            <PanelMessage tone="error">{rewrite.error}</PanelMessage>
                          ) : null}

                          {rewrite.result?.rewritten_card ? (
                            <div
                              style={{
                                marginTop: 10,
                                padding: 12,
                                borderRadius: 14,
                                background: ACCENT_PALE,
                                border: `1px solid rgba(109, 134, 160, 0.22)`,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color: ACCENT_DARK,
                                  marginBottom: 8,
                                }}
                              >
                                Новый вариант
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 7,
                                  marginBottom: 8,
                                }}
                              >
                                <Badge
                                  text={
                                    rewrite.rewriteMode === "from_idea"
                                      ? "Режим: из моей мысли"
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
                                }}
                              >
                                {rewrite.result.rewritten_card.title}
                              </h4>

                              {rewrite.result.rewritten_card.anchor ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: SOFT,
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
                                  color: INK,
                                  fontSize: 13,
                                  lineHeight: 1.58,
                                }}
                              >
                                {rewrite.result.rewritten_card.teaser}
                              </p>

                              {rewrite.result.rewritten_card.why_it_matters ? (
                                <p
                                  style={{
                                    margin: "0 0 10px",
                                    color: SOFT,
                                    fontSize: 13,
                                    lineHeight: 1.52,
                                  }}
                                >
                                  <strong style={{ color: ACCENT_DARK }}>Почему важно: </strong>
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
                                <Badge
                                  text={`Новая оценка: ${rewriteScore === null ? "—" : rewriteScore}`}
                                  strong
                                />
                                {rewritePlacement ? (
                                  <Badge text={`Предложение: ${rewritePlacement}`} />
                                ) : null}
                              </div>

                              {rewriteReason ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: SOFT,
                                    fontSize: 13,
                                    lineHeight: 1.52,
                                  }}
                                >
                                  <strong style={{ color: ACCENT_DARK }}>Причина: </strong>
                                  {rewriteReason}
                                </p>
                              ) : null}

                              {rewriteRisk ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: WARNING_TEXT,
                                    fontSize: 13,
                                    lineHeight: 1.52,
                                  }}
                                >
                                  <strong>Риск: </strong>
                                  {rewriteRisk}
                                </p>
                              ) : null}

                              {rewrite.applied ? (
                                <PanelMessage tone="success">
                                  Доработка применена. RU/EN/ES версии обновлены.
                                </PanelMessage>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canApplyRewrite || rewrite.applying}
                                  onClick={() => applyRewrite(card)}
                                  style={getApplyButtonStyle(
                                    !canApplyRewrite || rewrite.applying,
                                  )}
                                >
                                  {rewrite.applying
                                    ? "Применяю..."
                                    : "Применить доработку RU/EN/ES"}
                                </button>
                              )}

                              {rewrite.applyError ? (
                                <PanelMessage tone="error">{rewrite.applyError}</PanelMessage>
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
            color: SOFT,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Studio: переоценка, применение оценки, ремонт перевода и доработка
          карточки RU/EN/ES.
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
        background: strong ? ACCENT_SOFT : "rgba(109, 134, 160, 0.11)",
        color: ACCENT_DARK,
        fontSize: 12,
        fontWeight: strong ? 800 : 700,
        lineHeight: 1.1,
        border: `1px solid ${strong ? "rgba(109, 134, 160, 0.14)" : "transparent"}`,
      }}
    >
      {text}
    </span>
  );
}

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: { bg: string; text: string; border: string };
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 9px",
        background: tone.bg,
        color: tone.text,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.1,
        border: `1px solid ${tone.border}`,
      }}
    >
      {text}
    </span>
  );
}

function PanelMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "error";
}) {
  const styles =
    tone === "success"
      ? { background: SUCCESS_BG, color: SUCCESS_TEXT }
      : { background: ERROR_BG, color: ERROR_TEXT };

  return (
    <div
      style={{
        marginTop: 10,
        padding: "9px 10px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        ...styles,
      }}
    >
      {children}
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
          "linear-gradient(90deg, rgba(219,231,241,0.85), rgba(255,250,240,0.95), rgba(219,231,241,0.85))",
        backgroundSize: "220% 100%",
        animation: "studio-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
