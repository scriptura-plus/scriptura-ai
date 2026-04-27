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

type SourceMeta = {
  key: string;
  label: string;
  bg: string;
  border: string;
  text: string;
};

const BG = "#f5efe4";
const PAPER = "#fffaf1";
const PAPER_SOFT = "#fcf6eb";
const CARD = "#fffdf8";
const LINE = "#dfcfb0";
const LINE_SOFT = "#eadfca";
const INK = "#2a241d";
const MUTED = "#6f6150";
const MUTED_2 = "#857565";
const BLUE = "#58718a";
const BLUE_DARK = "#40596f";
const BLUE_PALE = "#ecf2f7";
const BLUE_SOFT = "#d8e4ee";
const WARNING_BG = "#f8ecd2";
const WARNING_BORDER = "#e7c98b";
const WARNING_TEXT = "#8b6733";
const ERROR_BG = "#f8e1d9";
const ERROR_BORDER = "#e4b4a4";
const ERROR_TEXT = "#8e3f27";
const SUCCESS_BG = "#e6f0df";
const SUCCESS_BORDER = "#bfd3ae";
const SUCCESS_TEXT = "#4e6b3d";

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

function getSourceMeta(source: string): SourceMeta {
  const cleaned = cleanSource(source);

  if (cleaned === "word") {
    return {
      key: cleaned,
      label: "Word Lens",
      bg: "#e6f1ff",
      border: "#bdd6f4",
      text: "#4b6785",
    };
  }

  if (cleaned === "context") {
    return {
      key: cleaned,
      label: "Context Lens",
      bg: "#edf4ea",
      border: "#c9dec0",
      text: "#58724c",
    };
  }

  if (cleaned === "intertext" || cleaned === "scripture_links") {
    return {
      key: cleaned,
      label: "Связь с другими стихами",
      bg: "#f0ebfb",
      border: "#d4c7ef",
      text: "#675691",
    };
  }

  if (cleaned === "socio") {
    return {
      key: cleaned,
      label: "Социально-историческая линза",
      bg: "#f8efe1",
      border: "#e7d2b3",
      text: "#856442",
    };
  }

  if (cleaned === "genre") {
    return {
      key: cleaned,
      label: "Текстовые находки",
      bg: "#edf4f8",
      border: "#cadce6",
      text: "#4b697b",
    };
  }

  if (cleaned === "rhetoric") {
    return {
      key: cleaned,
      label: "Риторическая линза",
      bg: "#f7ecf3",
      border: "#e5c8db",
      text: "#8a5575",
    };
  }

  if (cleaned === "structure") {
    return {
      key: cleaned,
      label: "Структурная линза",
      bg: "#eef1fa",
      border: "#cad2ee",
      text: "#5e6891",
    };
  }

  if (cleaned === "historical_scene") {
    return {
      key: cleaned,
      label: "Историческая сцена",
      bg: "#fbf0e5",
      border: "#ebd3b8",
      text: "#8b6542",
    };
  }

  if (cleaned.startsWith("initial_angles:gemini")) {
    return {
      key: cleaned,
      label: "Первичная генерация Gemini",
      bg: "#eef5eb",
      border: "#cedfc4",
      text: "#5f7b4e",
    };
  }

  if (cleaned.startsWith("initial_angles:claude")) {
    return {
      key: cleaned,
      label: "Первичная генерация Claude",
      bg: "#f4efe8",
      border: "#dfd0bd",
      text: "#72604d",
    };
  }

  if (cleaned.startsWith("initial_angles:openai") || cleaned.startsWith("initial_angles:gpt")) {
    return {
      key: cleaned,
      label: "Первичная генерация OpenAI",
      bg: "#eaf2ef",
      border: "#c7ddd2",
      text: "#4d7565",
    };
  }

  if (cleaned === "generated_candidates_v2") {
    return {
      key: cleaned,
      label: "Ручная генерация кандидатов",
      bg: "#eef4fb",
      border: "#cbd8ea",
      text: "#4f6985",
    };
  }

  if (cleaned === "generated_candidates_v1") {
    return {
      key: cleaned,
      label: "Старая генерация кандидатов",
      bg: "#f4f0e8",
      border: "#ddd2bf",
      text: "#756853",
    };
  }

  if (cleaned === "manual") {
    return {
      key: cleaned,
      label: "Ручная обработка",
      bg: "#f3f1ec",
      border: "#ddd6c9",
      text: "#706657",
    };
  }

  if (cleaned === "manual_test") {
    return {
      key: cleaned,
      label: "Ручной тест",
      bg: "#f3f1ec",
      border: "#ddd6c9",
      text: "#706657",
    };
  }

  if (cleaned === "studio_rewrite") {
    return {
      key: cleaned,
      label: "Доработка в Studio",
      bg: "#edf1fb",
      border: "#cbd3ea",
      text: "#586888",
    };
  }

  if (cleaned === "extra") {
    return {
      key: cleaned,
      label: "Explore deeper",
      bg: "#eef4f6",
      border: "#cfe0e4",
      text: "#4f6d75",
    };
  }

  return {
    key: cleaned,
    label: cleaned === "unknown" ? "Неизвестный источник" : cleaned,
    bg: "#f3f1ec",
    border: "#ddd6c9",
    text: "#706657",
  };
}

function getUniqueSourceMeta(sources: string[]): SourceMeta[] {
  const seen = new Set<string>();
  const result: SourceMeta[] = [];

  for (const source of sources) {
    const meta = getSourceMeta(source);
    if (seen.has(meta.label)) continue;
    seen.add(meta.label);
    result.push(meta);
  }

  return result;
}

function sourceLabel(sources: string[]): string {
  const labels = getUniqueSourceMeta(sources).map((item) => item.label);
  if (!labels.length) return "Неизвестный источник";
  return labels.join(" · ");
}

function statusLabel(status: string): string {
  if (status === "featured") return "Активная";
  if (status === "reserve") return "Запас";
  if (status === "hidden") return "Скрыта";
  if (status === "rejected") return "Отклонена";
  if (status === "rewrite") return "На доработку";
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

function coverageLabel(type: string | null): string | null {
  if (!type) return null;

  if (type === "lexical") return "Слово / лексика";
  if (type === "grammatical") return "Грамматика";
  if (type === "structural") return "Структура";
  if (type === "contextual") return "Контекст";
  if (type === "translation") return "Перевод";
  if (type === "rhetorical") return "Риторика";
  if (type === "historical") return "История";
  if (type === "conceptual") return "Идея";
  if (type === "other") return "Другое";

  return type;
}

function getCardSource(card: StudioCard): string {
  return getSourceMeta(card.source_model || card.source_type || "unknown").label;
}

function getButtonStyle(active = false, disabled = false) {
  return {
    border: `1px solid ${active ? BLUE : "#cfd8e0"}`,
    borderRadius: 999,
    background: active ? BLUE : "#f3f6f9",
    color: active ? "#ffffff" : BLUE_DARK,
    padding: "10px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    transform: active ? "translateY(-1px)" : "translateY(0)",
    boxShadow: active ? "0 10px 24px rgba(88, 113, 138, 0.18)" : "none",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getSmallButtonStyle(disabled = false) {
  return {
    border: "1px solid #d7dde3",
    borderRadius: 999,
    background: "#f4f7fa",
    color: BLUE_DARK,
    padding: "8px 11px",
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
    border: `1px solid ${disabled ? "#d7dde3" : BLUE}`,
    borderRadius: 999,
    background: disabled ? "#eef1f4" : BLUE,
    color: disabled ? BLUE_DARK : "#ffffff",
    padding: "8px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: disabled ? "none" : "0 10px 24px rgba(88, 113, 138, 0.18)",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getRepairButtonStyle(disabled = false) {
  return {
    border: `1px solid ${disabled ? "#e2d7bf" : WARNING_BORDER}`,
    borderRadius: 999,
    background: disabled ? "#f3eee4" : WARNING_BG,
    color: WARNING_TEXT,
    padding: "8px 11px",
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
    border: `1px solid ${active ? BLUE : "#d8dde4"}`,
    borderRadius: 14,
    background: active ? BLUE : CARD,
    color: active ? "#ffffff" : BLUE_DARK,
    padding: "10px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 850,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: active ? "0 8px 18px rgba(88, 113, 138, 0.16)" : "none",
  } as const;
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
          "radial-gradient(circle at top, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, #f8f2e8 0%, #f4ede1 100%)",
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
          grid-template-columns: minmax(320px, 0.88fr) minmax(0, 1.12fr);
          gap: 16px;
          align-items: start;
        }

        .studio-panel {
          background: linear-gradient(180deg, rgba(255,253,248,0.98), rgba(255,250,241,0.98));
          border: 1px solid ${LINE_SOFT};
          border-radius: 22px;
          box-shadow:
            0 1px 2px rgba(60, 40, 20, 0.04),
            0 12px 28px rgba(80, 60, 30, 0.08);
          backdrop-filter: blur(10px);
        }

        .studio-scroll {
          display: grid;
          gap: 12px;
        }

        @media (max-width: 900px) {
          .studio-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: "#f0f4f7",
              border: "1px solid #d9e1e8",
              color: BLUE_DARK,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 900,
              marginBottom: 10,
            }}
          >
            Scriptura Studio
          </div>

          <h1
            style={{
              fontFamily:
                'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
              fontSize: 36,
              lineHeight: 1.08,
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Редакторская панель
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: MUTED,
              fontSize: 15,
              lineHeight: 1.6,
              maxWidth: 780,
            }}
          >
            Здесь видно, какие стихи недавно получили жемчужины, откуда они пришли
            и какие карточки уже сохранены. Интерфейс очищен от технического шума,
            чтобы с ним было приятно работать как с настоящей редакторской панелью.
          </p>
        </header>

        <section
          className="studio-panel"
          style={{
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 14,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: MUTED_2,
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
                  background: CARD,
                  color: INK,
                  fontSize: 15,
                  boxSizing: "border-box",
                  outlineColor: BLUE,
                  boxShadow: "inset 0 1px 2px rgba(40, 30, 20, 0.03)",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
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
                  border: "1px solid #d7dde3",
                  borderRadius: 999,
                  background: "#f4f7fa",
                  color: BLUE_DARK,
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
              <InlineNotice type="info">{notice}</InlineNotice>
            ) : null}

            {versesError ? (
              <InlineNotice type="error">{versesError}</InlineNotice>
            ) : null}
          </div>
        </section>

        <div className="studio-layout">
          <section
            className="studio-panel"
            style={{
              padding: 16,
              minHeight: 320,
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
              <div>
                <h2
                  style={{
                    fontSize: 22,
                    lineHeight: 1.15,
                    margin: 0,
                    fontFamily:
                      'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                  }}
                >
                  Недавние стихи
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: MUTED,
                    fontSize: 13,
                  }}
                >
                  Стихи с новой редакторской активностью
                </p>
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: MUTED_2,
                  fontWeight: 800,
                  background: PAPER_SOFT,
                  border: `1px solid ${LINE_SOFT}`,
                  borderRadius: 999,
                  padding: "6px 10px",
                }}
              >
                {verses.length} найдено
              </div>
            </div>

            {loadingVerses ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Skeleton width="72%" />
                <Skeleton width="92%" />
                <Skeleton width="60%" />
              </div>
            ) : null}

            {!loadingVerses && verses.length === 0 ? (
              <EmptyState text='Пока нет загруженной активности. Нажми "Обновить".' />
            ) : null}

            <div className="studio-scroll">
              {verses.map((verse) => {
                const active = verse.reference === selectedReference;
                const sourceMetas = getUniqueSourceMeta(verse.sources);

                return (
                  <button
                    key={`${verse.lang}-${verse.canonical_ref ?? verse.reference}`}
                    type="button"
                    onClick={() => loadCards(verse)}
                    disabled={loadingCards && active}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${active ? "#bfd0df" : LINE_SOFT}`,
                      background: active
                        ? "linear-gradient(180deg, #f4f8fb 0%, #eef4f8 100%)"
                        : CARD,
                      borderRadius: 18,
                      padding: 14,
                      cursor: "pointer",
                      color: INK,
                      fontFamily: "inherit",
                      boxShadow: active ? "0 12px 26px rgba(88, 113, 138, 0.12)" : "none",
                      transform: active ? "translateY(-1px)" : "translateY(0)",
                      transition:
                        "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 18,
                          lineHeight: 1.2,
                          color: active ? BLUE_DARK : INK,
                        }}
                      >
                        {displayReference(verse)}
                      </div>

                      {!verse.canonical_ref ? (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 900,
                            color: WARNING_TEXT,
                            background: WARNING_BG,
                            border: `1px solid ${WARNING_BORDER}`,
                            borderRadius: 999,
                            padding: "4px 8px",
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
                        marginBottom: 10,
                      }}
                    >
                      <MetricPill text={`${verse.featured_count} ${shortStatusLabel("featured")}`} strong />
                      {verse.reserve_count > 0 ? (
                        <MetricPill text={`${verse.reserve_count} ${shortStatusLabel("reserve")}`} />
                      ) : null}
                      {verse.best_score !== null ? (
                        <MetricPill text={`лучшая оценка: ${verse.best_score}`} />
                      ) : null}
                    </div>

                    {sourceMetas.length > 0 ? (
                      <div style={{ marginBottom: 10 }}>
                        <SourcePillList sources={verse.sources} limit={3} />
                      </div>
                    ) : null}

                    <div
                      style={{
                        fontSize: 13,
                        color: MUTED,
                        lineHeight: 1.45,
                      }}
                    >
                      Последняя активность: {formatDate(verse.last_activity_at)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="studio-panel"
            style={{
              padding: 16,
              minHeight: 320,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 28,
                    lineHeight: 1.08,
                    margin: 0,
                    fontFamily:
                      'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                  }}
                >
                  {selectedVerse ? displayReference(selectedVerse) : "Карточки стиха"}
                </h2>

                {selectedVerse ? (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 13,
                      color: MUTED,
                    }}
                  >
                    Последняя активность: {formatDate(selectedVerse.last_activity_at)}
                  </p>
                ) : null}
              </div>

              {selectedVerse ? (
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 800,
                    color: MUTED_2,
                    background: PAPER_SOFT,
                    border: `1px solid ${LINE_SOFT}`,
                    borderRadius: 999,
                    padding: "6px 10px",
                  }}
                >
                  {cards.length} карточек
                </div>
              ) : null}
            </div>

            {cardsSummary ? (
              <div
                style={{
                  background: PAPER_SOFT,
                  border: `1px solid ${LINE_SOFT}`,
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <MetricPill text={`${cardsSummary.featured} ${shortStatusLabel("featured")}`} strong />
                  {cardsSummary.reserve > 0 ? (
                    <MetricPill text={`${cardsSummary.reserve} ${shortStatusLabel("reserve")}`} />
                  ) : null}
                  {cardsSummary.hidden > 0 ? (
                    <MetricPill text={`${cardsSummary.hidden} ${shortStatusLabel("hidden")}`} />
                  ) : null}
                  {cardsSummary.best_score !== null ? (
                    <MetricPill text={`лучшая оценка: ${cardsSummary.best_score}`} />
                  ) : null}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: MUTED_2,
                      marginBottom: 8,
                    }}
                  >
                    Источники
                  </div>
                  <SourcePillList sources={cardsSummary.sources} limit={8} />
                </div>
              </div>
            ) : null}

            {loadingCards ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Skeleton width="75%" />
                <Skeleton width="95%" />
                <Skeleton width="62%" />
              </div>
            ) : null}

            {cardsError ? (
              <InlineNotice type="error">{cardsError}</InlineNotice>
            ) : null}

            {!loadingCards && !cardsError && !selectedReference ? (
              <EmptyState text="Выбери стих слева, чтобы увидеть карточки." />
            ) : null}

            {!loadingCards && !cardsError && selectedReference && cards.length === 0 ? (
              <EmptyState text="По этому стиху карточки не найдены." />
            ) : null}

            <div className="studio-scroll">
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

                return (
                  <article
                    key={card.id}
                    style={{
                      border: `1px solid ${LINE_SOFT}`,
                      borderRadius: 20,
                      padding: 16,
                      background: CARD,
                      boxShadow: "0 2px 8px rgba(50, 35, 20, 0.03)",
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
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 26,
                            lineHeight: 1.1,
                            letterSpacing: "-0.02em",
                            fontFamily:
                              'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                          }}
                        >
                          {card.title}
                        </h3>
                      </div>

                      {card.score_total !== null ? (
                        <div
                          style={{
                            flexShrink: 0,
                            minWidth: 44,
                            height: 44,
                            display: "grid",
                            placeItems: "center",
                            background: BLUE,
                            color: "#fff",
                            borderRadius: 999,
                            fontSize: 15,
                            fontWeight: 900,
                            boxShadow: "0 10px 20px rgba(88, 113, 138, 0.2)",
                          }}
                        >
                          {card.score_total}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <MetricPill text={statusLabel(card.status)} strong />
                      {coverageLabel(card.coverage_type) ? (
                        <MetricPill text={coverageLabel(card.coverage_type) ?? ""} />
                      ) : null}
                      <MetricPill text={getCardSource(card)} />
                    </div>

                    {card.anchor ? (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: "11px 12px",
                          borderRadius: 14,
                          background: "#faf6ee",
                          border: `1px solid ${LINE_SOFT}`,
                          color: MUTED,
                          fontSize: 14,
                          lineHeight: 1.5,
                          fontStyle: "italic",
                        }}
                      >
                        “{card.anchor}”
                      </div>
                    ) : null}

                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: 17,
                        lineHeight: 1.72,
                        color: INK,
                      }}
                    >
                      {card.teaser}
                    </p>

                    {card.why_it_matters ? (
                      <div
                        style={{
                          borderTop: `1px solid ${LINE_SOFT}`,
                          paddingTop: 12,
                          marginBottom: 6,
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            color: MUTED,
                            fontSize: 14,
                            lineHeight: 1.62,
                          }}
                        >
                          <strong style={{ color: BLUE_DARK }}>Почему важно: </strong>
                          {card.why_it_matters}
                        </p>
                      </div>
                    ) : null}

                    <details
                      style={{
                        marginTop: 12,
                        borderTop: `1px solid ${LINE_SOFT}`,
                        paddingTop: 12,
                      }}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          color: BLUE_DARK,
                          fontSize: 14,
                          fontWeight: 900,
                          listStyle: "none",
                        }}
                      >
                        Редакторские действия
                      </summary>

                      <div
                        style={{
                          marginTop: 12,
                          display: "grid",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            padding: 13,
                            borderRadius: 16,
                            border: "1px solid #dae3eb",
                            background: "#f6f9fc",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 10,
                            }}
                          >
                            <MetricPill
                              text={`Текущая оценка: ${
                                card.score_total === null ? "—" : card.score_total
                              }`}
                              strong
                            />
                            <MetricPill text={statusLabel(card.status)} />
                            {coverageLabel(card.coverage_type) ? (
                              <MetricPill text={coverageLabel(card.coverage_type) ?? ""} />
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
                            Здесь можно проверить карточку новым редакционным стандартом
                            или перегенерировать текст на текущем языке.
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
                            <div style={{ marginTop: 10 }}>
                              <InlineNotice type="error">{retranslation.error}</InlineNotice>
                            </div>
                          ) : null}

                          {retranslation.applied ? (
                            <div style={{ marginTop: 10 }}>
                              <InlineNotice type="success">
                                Карточка переведена заново. Текст обновлён.
                              </InlineNotice>
                            </div>
                          ) : null}

                          {reEval.error ? (
                            <div style={{ marginTop: 10 }}>
                              <InlineNotice type="error">{reEval.error}</InlineNotice>
                            </div>
                          ) : null}

                          {reEval.result ? (
                            <div
                              style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 16,
                                background: CARD,
                                border: `1px solid ${LINE_SOFT}`,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                  marginBottom: 10,
                                }}
                              >
                                <MetricPill
                                  text={`Новая оценка: ${newScore === null ? "—" : newScore}`}
                                  strong
                                />
                                {newPlacement ? (
                                  <MetricPill text={`Предложение: ${newPlacement}`} />
                                ) : null}
                                {reEval.result.verse_text_source ? (
                                  <MetricPill text={`Текст стиха: ${reEval.result.verse_text_source}`} />
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
                                  <strong style={{ color: BLUE_DARK }}>Причина: </strong>
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
                                <InlineNotice type="success">
                                  Оценка применена. База обновлена.
                                </InlineNotice>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    marginTop: 10,
                                  }}
                                >
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
                                <div style={{ marginTop: 10 }}>
                                  <InlineNotice type="error">{reEval.applyError}</InlineNotice>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            padding: 13,
                            borderRadius: 16,
                            border: `1px solid ${LINE_SOFT}`,
                            background: "#fcfaf4",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 900,
                              color: BLUE_DARK,
                              marginBottom: 10,
                            }}
                          >
                            Доработать карточку
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                              marginBottom: 10,
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
                              margin: "0 0 10px",
                              color: MUTED,
                              fontSize: 12,
                              lineHeight: 1.5,
                            }}
                          >
                            {rewrite.rewriteMode === "from_idea"
                              ? "В этом режиме твоя мысль главнее старой карточки. Старая карточка используется только как контекст."
                              : "В этом режиме сохраняется главный угол карточки, а AI усиливает ясность, опору на текст и эффект открытия."}
                          </p>

                          <textarea
                            value={rewrite.instruction}
                            onChange={(event) =>
                              updateRewriteInstruction(card.id, event.target.value)
                            }
                            placeholder={
                              rewrite.rewriteMode === "from_idea"
                                ? "Опиши мысль, которую нужно собрать в новую карточку."
                                : "Например: сохрани угол, но усили текстовую опору, сделай мысль точнее и интереснее."
                            }
                            rows={3}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              border: `1px solid ${LINE}`,
                              borderRadius: 14,
                              padding: "11px 12px",
                              background: CARD,
                              color: INK,
                              fontSize: 13,
                              lineHeight: 1.5,
                              fontFamily: "inherit",
                              resize: "vertical",
                              outlineColor: BLUE,
                              marginBottom: 8,
                            }}
                          />

                          <textarea
                            value={rewrite.extraMaterial}
                            onChange={(event) =>
                              updateRewriteExtraMaterial(card.id, event.target.value)
                            }
                            placeholder="Дополнительный материал: цитата, заметка, наблюдение, лексическая опора."
                            rows={2}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              border: `1px solid ${LINE}`,
                              borderRadius: 14,
                              padding: "11px 12px",
                              background: CARD,
                              color: INK,
                              fontSize: 13,
                              lineHeight: 1.5,
                              fontFamily: "inherit",
                              resize: "vertical",
                              outlineColor: BLUE,
                              marginBottom: 10,
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
                            <div style={{ marginTop: 10 }}>
                              <InlineNotice type="error">{rewrite.error}</InlineNotice>
                            </div>
                          ) : null}

                          {rewrite.result?.rewritten_card ? (
                            <div
                              style={{
                                marginTop: 12,
                                padding: 13,
                                borderRadius: 16,
                                background: BLUE_PALE,
                                border: "1px solid #cddae7",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color: BLUE_DARK,
                                  marginBottom: 8,
                                }}
                              >
                                Новый вариант
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                  marginBottom: 10,
                                }}
                              >
                                <MetricPill
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
                                  fontSize: 20,
                                  lineHeight: 1.2,
                                  fontFamily:
                                    'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
                                }}
                              >
                                {rewrite.result.rewritten_card.title}
                              </h4>

                              {rewrite.result.rewritten_card.anchor ? (
                                <div
                                  style={{
                                    marginBottom: 8,
                                    color: MUTED,
                                    fontSize: 13,
                                    lineHeight: 1.45,
                                    fontStyle: "italic",
                                  }}
                                >
                                  “{rewrite.result.rewritten_card.anchor}”
                                </div>
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
                                    color: MUTED,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  <strong style={{ color: BLUE_DARK }}>Почему важно: </strong>
                                  {rewrite.result.rewritten_card.why_it_matters}
                                </p>
                              ) : null}

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                  marginBottom: 10,
                                }}
                              >
                                <MetricPill
                                  text={`Новая оценка: ${rewriteScore === null ? "—" : rewriteScore}`}
                                  strong
                                />
                                {rewritePlacement ? (
                                  <MetricPill text={`Предложение: ${rewritePlacement}`} />
                                ) : null}
                              </div>

                              {rewriteReason ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: MUTED,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  <strong style={{ color: BLUE_DARK }}>Причина: </strong>
                                  {rewriteReason}
                                </p>
                              ) : null}

                              {rewriteRisk ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: WARNING_TEXT,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  <strong>Риск: </strong>
                                  {rewriteRisk}
                                </p>
                              ) : null}

                              {rewrite.applied ? (
                                <InlineNotice type="success">
                                  Доработка применена. RU/EN/ES версии обновлены.
                                </InlineNotice>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canApplyRewrite || rewrite.applying}
                                  onClick={() => applyRewrite(card)}
                                  style={getApplyButtonStyle(!canApplyRewrite || rewrite.applying)}
                                >
                                  {rewrite.applying
                                    ? "Применяю..."
                                    : "Применить доработку RU/EN/ES"}
                                </button>
                              )}

                              {rewrite.applyError ? (
                                <div style={{ marginTop: 10 }}>
                                  <InlineNotice type="error">{rewrite.applyError}</InlineNotice>
                                </div>
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
            color: MUTED,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Studio MVP: переоценка, перевод, редакторская доработка и применение изменений
          в RU / EN / ES.
        </p>
      </div>
    </main>
  );
}

function MetricPill({ text, strong = false }: { text: string; strong?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 10px",
        background: strong ? BLUE_SOFT : "#f2eee7",
        border: `1px solid ${strong ? "#c6d6e2" : "#dfd5c5"}`,
        color: strong ? BLUE_DARK : "#6f6150",
        fontSize: 12,
        fontWeight: strong ? 850 : 750,
        lineHeight: 1,
      }}
    >
      {text}
    </span>
  );
}

function SourcePillList({
  sources,
  limit = 4,
}: {
  sources: string[];
  limit?: number;
}) {
  const metas = getUniqueSourceMeta(sources);
  const visible = metas.slice(0, limit);
  const hiddenCount = Math.max(0, metas.length - visible.length);

  if (!metas.length) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 7,
      }}
    >
      {visible.map((item) => (
        <span
          key={item.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "6px 10px",
            background: item.bg,
            border: `1px solid ${item.border}`,
            color: item.text,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {item.label}
        </span>
      ))}

      {hiddenCount > 0 ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "6px 10px",
            background: "#f3f1ec",
            border: "1px solid #ddd6c9",
            color: "#706657",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function InlineNotice({
  children,
  type,
}: {
  children: React.ReactNode;
  type: "info" | "error" | "success";
}) {
  const styles =
    type === "error"
      ? {
          background: ERROR_BG,
          border: ERROR_BORDER,
          color: ERROR_TEXT,
        }
      : type === "success"
        ? {
            background: SUCCESS_BG,
            border: SUCCESS_BORDER,
            color: SUCCESS_TEXT,
          }
        : {
            background: BLUE_SOFT,
            border: "#c7d6e2",
            color: BLUE_DARK,
          };

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        background: styles.background,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: PAPER_SOFT,
        border: `1px dashed ${LINE}`,
        color: MUTED,
        fontSize: 14,
        lineHeight: 1.55,
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
          "linear-gradient(90deg, rgba(216,228,238,0.85), rgba(255,250,240,0.95), rgba(216,228,238,0.85))",
        backgroundSize: "220% 100%",
        animation: "studio-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
