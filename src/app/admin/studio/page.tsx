"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReference } from "@/lib/bible/formatReference";

type Lang = "ru" | "en" | "es";

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

const BLUE = "#5f7890";
const BLUE_DARK = "#4d6478";
const BLUE_SOFT = "#d8e4ee";
const BLUE_PALE = "#edf4f8";
const PAPER = "#fbf6ea";
const BG = "#f6efe1";
const LINE = "#d8c9a8";
const INK = "#2c241b";
const SOFT = "#5a4a37";
const WARNING_BG = "#f5e9c8";
const WARNING_TEXT = "#8a6330";
const ERROR_BG = "#f7ded2";
const ERROR_TEXT = "#8a3a20";
const SUCCESS_BG = "#e4eddc";
const SUCCESS_TEXT = "#4f6b3c";

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

function sourceLabel(sources: string[]): string {
  if (!sources.length) return "unknown";
  return sources.map(cleanSource).join(", ");
}

function statusLabel(status: string): string {
  if (status === "featured") return "featured";
  if (status === "reserve") return "reserve";
  if (status === "hidden") return "hidden";
  if (status === "rejected") return "rejected";
  if (status === "rewrite") return "rewrite";
  return status;
}

function getCardSource(card: StudioCard): string {
  return cleanSource(card.source_model || card.source_type || "unknown");
}

function getButtonStyle(active = false, disabled = false) {
  return {
    border: `1px solid ${active ? BLUE : "rgba(95, 120, 144, 0.28)"}`,
    borderRadius: 999,
    background: active ? BLUE : BLUE_PALE,
    color: active ? "#ffffff" : BLUE_DARK,
    padding: "10px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    transform: active ? "translateY(-1px)" : "translateY(0)",
    boxShadow: active ? "0 6px 16px rgba(95, 120, 144, 0.22)" : "none",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getSmallButtonStyle(disabled = false) {
  return {
    border: `1px solid rgba(95, 120, 144, 0.34)`,
    borderRadius: 999,
    background: disabled ? "#edf0f2" : BLUE_PALE,
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
    border: `1px solid ${disabled ? "rgba(95, 120, 144, 0.28)" : BLUE}`,
    borderRadius: 999,
    background: disabled ? "#edf0f2" : BLUE,
    color: disabled ? BLUE_DARK : "#ffffff",
    padding: "8px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
    boxShadow: disabled ? "none" : "0 6px 16px rgba(95, 120, 144, 0.18)",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
  } as const;
}

function getRepairButtonStyle(disabled = false) {
  return {
    border: `1px solid ${disabled ? "rgba(138, 99, 48, 0.2)" : "rgba(138, 99, 48, 0.38)"}`,
    borderRadius: 999,
    background: disabled ? "#eee8dc" : WARNING_BG,
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

function getEvaluationScore(result: ReEvaluateResponse | null): number | null {
  const score = result?.evaluation?.score_total;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getEvaluationPlacement(result: ReEvaluateResponse | null): string | null {
  const placement = result?.evaluation?.placement;
  return typeof placement === "string" && placement.trim() ? placement.trim() : null;
}

function getEvaluationReason(result: ReEvaluateResponse | null): string | null {
  const reason = result?.evaluation?.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function getEvaluationRisk(result: ReEvaluateResponse | null): string | null {
  const risk = result?.evaluation?.risk;
  return typeof risk === "string" && risk.trim() ? risk.trim() : null;
}

function createEmptyReEvaluateState(
  previous?: ReEvaluateState,
): ReEvaluateState {
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

  const [reEvaluations, setReEvaluations] = useState<
    Record<string, ReEvaluateState>
  >({});

  const [retranslations, setRetranslations] = useState<
    Record<string, RetranslateState>
  >({});

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
        background: BG,
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
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
          gap: 14px;
        }
        @media (max-width: 760px) {
          .studio-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: BLUE_DARK,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            Scriptura Studio
          </div>
          <h1
            style={{
              fontFamily:
                'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif',
              fontSize: 32,
              lineHeight: 1.12,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Живая работа системы
          </h1>
          <p style={{ margin: "8px 0 0", color: SOFT, fontSize: 15, lineHeight: 1.55 }}>
            Здесь видно, какие стихи недавно получили жемчужины, откуда они
            пришли и какие карточки уже сохранены.
          </p>
        </header>

        <section
          style={{
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: 16,
            boxShadow:
              "0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.08)",
            marginBottom: 14,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.09em",
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
              borderRadius: 12,
              padding: "12px 13px",
              background: "#fffaf0",
              color: INK,
              fontSize: 15,
              boxSizing: "border-box",
              outlineColor: BLUE,
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
                border: `1px solid rgba(95, 120, 144, 0.28)`,
                borderRadius: 999,
                background: BLUE_PALE,
                color: BLUE_DARK,
                padding: "10px 12px",
                fontWeight: 700,
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
                padding: "9px 11px",
                borderRadius: 12,
                background: BLUE_SOFT,
                color: BLUE_DARK,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {notice}
            </div>
          ) : null}

          {versesError ? (
            <div
              style={{
                marginTop: 12,
                padding: "9px 11px",
                borderRadius: 12,
                background: ERROR_BG,
                color: ERROR_TEXT,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {versesError}
            </div>
          ) : null}
        </section>

        <div className="studio-layout">
          <section
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 18,
              padding: 14,
              boxShadow:
                "0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.08)",
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
                  borderRadius: 14,
                  background: "#fffaf0",
                  border: `1px dashed ${LINE}`,
                  color: SOFT,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                Пока нет загруженной активности. Нажми "Обновить".
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
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
                      border: `1px solid ${active ? BLUE : "rgba(216, 201, 168, 0.9)"}`,
                      background: active ? BLUE_PALE : "#fffaf0",
                      borderRadius: 15,
                      padding: 13,
                      cursor: "pointer",
                      color: INK,
                      fontFamily: "inherit",
                      boxShadow: active ? "0 6px 16px rgba(95, 120, 144, 0.16)" : "none",
                      transform: active ? "translateY(-1px)" : "translateY(0)",
                      transition:
                        "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                        marginBottom: 6,
                        color: active ? BLUE_DARK : INK,
                      }}
                    >
                      {displayReference(verse)}
                      {!verse.canonical_ref ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 700,
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
                        marginBottom: 7,
                      }}
                    >
                      <Badge text={`${verse.featured_count} featured`} />
                      {verse.reserve_count > 0 ? (
                        <Badge text={`${verse.reserve_count} reserve`} />
                      ) : null}
                      {verse.best_score !== null ? (
                        <Badge text={`best ${verse.best_score}`} />
                      ) : null}
                    </div>
                    <div style={{ fontSize: 13, color: SOFT, lineHeight: 1.45 }}>
                      {sourceLabel(verse.sources)}
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
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 18,
              padding: 14,
              boxShadow:
                "0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.08)",
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 13 }}>
                <Badge text={`${cardsSummary.featured} featured`} strong />
                {cardsSummary.reserve > 0 ? (
                  <Badge text={`${cardsSummary.reserve} reserve`} />
                ) : null}
                {cardsSummary.hidden > 0 ? (
                  <Badge text={`${cardsSummary.hidden} hidden`} />
                ) : null}
                {cardsSummary.best_score !== null ? (
                  <Badge text={`best ${cardsSummary.best_score}`} />
                ) : null}
                <Badge text={sourceLabel(cardsSummary.sources)} />
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
                  fontWeight: 700,
                }}
              >
                {cardsError}
              </div>
            ) : null}

            {!loadingCards && !cardsError && !selectedReference ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#fffaf0",
                  border: `1px dashed ${LINE}`,
                  color: SOFT,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                Выбери стих слева, чтобы увидеть карточки.
              </div>
            ) : null}

            {!loadingCards && !cardsError && selectedReference && cards.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#fffaf0",
                  border: `1px dashed ${LINE}`,
                  color: SOFT,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                По этому стиху карточки не найдены.
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12 }}>
              {cards.map((card) => {
                const reEval = reEvaluations[card.id] ?? createEmptyReEvaluateState();
                const retranslation =
                  retranslations[card.id] ?? createEmptyRetranslateState();

                const newScore = getEvaluationScore(reEval.result);
                const newPlacement = getEvaluationPlacement(reEval.result);
                const reason = getEvaluationReason(reEval.result);
                const risk = getEvaluationRisk(reEval.result);
                const canApply = Boolean(reEval.result?.evaluation && !reEval.applied);

                return (
                  <article
                    key={card.id}
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: 16,
                      padding: 14,
                      background: "#fffaf0",
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
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 17,
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
                            background: BLUE,
                            color: "#fff",
                            borderRadius: 999,
                            padding: "5px 8px",
                            fontSize: 12,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {card.score_total}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 9 }}>
                      <Badge text={statusLabel(card.status)} strong />
                      {card.coverage_type ? <Badge text={card.coverage_type} /> : null}
                      <Badge text={getCardSource(card)} />
                    </div>

                    {card.anchor ? (
                      <p
                        style={{
                          margin: "0 0 9px",
                          color: SOFT,
                          fontSize: 13,
                          lineHeight: 1.5,
                          fontStyle: "italic",
                        }}
                      >
                        "{card.anchor}"
                      </p>
                    ) : null}

                    <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.62 }}>
                      {card.teaser}
                    </p>

                    {card.why_it_matters ? (
                      <p
                        style={{
                          margin: 0,
                          borderTop: `1px solid ${LINE}`,
                          paddingTop: 9,
                          color: SOFT,
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ color: BLUE_DARK }}>Почему важно: </strong>
                        {card.why_it_matters}
                      </p>
                    ) : null}

                    <details style={{ marginTop: 10 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: BLUE_DARK,
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        Оценка / угол
                      </summary>

                      <div
                        style={{
                          marginTop: 10,
                          padding: 11,
                          borderRadius: 13,
                          border: `1px solid rgba(95, 120, 144, 0.18)`,
                          background: BLUE_PALE,
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 9 }}>
                          <Badge
                            text={`текущая: ${
                              card.score_total === null ? "—" : card.score_total
                            }`}
                            strong
                          />
                          <Badge text={`статус: ${statusLabel(card.status)}`} />
                          {card.coverage_type ? <Badge text={`тип: ${card.coverage_type}`} /> : null}
                        </div>

                        <p
                          style={{
                            margin: "0 0 10px",
                            color: SOFT,
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          Нажми «Переоценить», чтобы проверить карточку новым
                          редакционным стандартом. Если карточка сохранена не на том
                          языке, нажми «Перевести заново».
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            disabled={
                              reEval.loading ||
                              reEval.applying ||
                              retranslation.loading
                            }
                            onClick={() => reEvaluateCard(card)}
                            style={getSmallButtonStyle(
                              reEval.loading ||
                                reEval.applying ||
                                retranslation.loading,
                            )}
                          >
                            {reEval.loading ? "Оцениваю..." : "Переоценить"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              retranslation.loading ||
                              reEval.loading ||
                              reEval.applying
                            }
                            onClick={() => retranslateCard(card)}
                            style={getRepairButtonStyle(
                              retranslation.loading ||
                                reEval.loading ||
                                reEval.applying,
                            )}
                          >
                            {retranslation.loading
                              ? "Перевожу..."
                              : "Перевести заново"}
                          </button>
                        </div>

                        {retranslation.error ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "9px 10px",
                              borderRadius: 12,
                              background: ERROR_BG,
                              color: ERROR_TEXT,
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {retranslation.error}
                          </div>
                        ) : null}

                        {retranslation.applied ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "9px 10px",
                              borderRadius: 12,
                              background: SUCCESS_BG,
                              color: SUCCESS_TEXT,
                              fontSize: 13,
                              fontWeight: 800,
                            }}
                          >
                            Карточка переведена заново. Текст обновлён.
                          </div>
                        ) : null}

                        {reEval.error ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "9px 10px",
                              borderRadius: 12,
                              background: ERROR_BG,
                              color: ERROR_TEXT,
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {reEval.error}
                          </div>
                        ) : null}

                        {reEval.result ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 11,
                              borderRadius: 13,
                              background: "#fffaf0",
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
                                text={`новая: ${newScore === null ? "—" : newScore}`}
                                strong
                              />
                              {newPlacement ? <Badge text={`предложение: ${newPlacement}`} /> : null}
                              {reEval.result.verse_text_source ? (
                                <Badge text={`verse: ${reEval.result.verse_text_source}`} />
                              ) : null}
                            </div>

                            {reason ? (
                              <p
                                style={{
                                  margin: "0 0 8px",
                                  color: SOFT,
                                  fontSize: 13,
                                  lineHeight: 1.5,
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
                                  lineHeight: 1.5,
                                }}
                              >
                                <strong>Риск: </strong>
                                {risk}
                              </p>
                            ) : null}

                            {reEval.applied ? (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: "9px 10px",
                                  borderRadius: 12,
                                  background: SUCCESS_BG,
                                  color: SUCCESS_TEXT,
                                  fontSize: 13,
                                  fontWeight: 800,
                                }}
                              >
                                Оценка применена. База обновлена.
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                                <button
                                  type="button"
                                  disabled={!canApply || reEval.applying}
                                  onClick={() => applyEvaluation(card)}
                                  style={getApplyButtonStyle(!canApply || reEval.applying)}
                                >
                                  {reEval.applying
                                    ? "Применяю..."
                                    : "Применить новую оценку"}
                                </button>
                              </div>
                            )}

                            {reEval.applyError ? (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: "9px 10px",
                                  borderRadius: 12,
                                  background: ERROR_BG,
                                  color: ERROR_TEXT,
                                  fontSize: 13,
                                  fontWeight: 700,
                                }}
                              >
                                {reEval.applyError}
                              </div>
                            ) : null}

                            <p
                              style={{
                                margin: "10px 0 0",
                                color: SOFT,
                                fontSize: 12,
                                lineHeight: 1.45,
                              }}
                            >
                              Переоценка меняет score, status, тип угла,
                              evaluation и summary. Перевод заново меняет только
                              текстовые поля карточки.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <p style={{ margin: "18px 0 0", color: SOFT, fontSize: 12, textAlign: "center" }}>
          MVP Studio: переоценка, применение оценки и ремонт перевода. Следующий
          этап — доработать карточку и добавить материал.
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
        padding: "4px 8px",
        background: strong ? BLUE_SOFT : "rgba(95, 120, 144, 0.11)",
        color: BLUE_DARK,
        fontSize: 12,
        fontWeight: strong ? 800 : 700,
        lineHeight: 1,
      }}
    >
      {text}
    </span>
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
          "linear-gradient(90deg, rgba(216,228,238,0.85), rgba(255,250,240,0.9), rgba(216,228,238,0.85))",
        backgroundSize: "220% 100%",
        animation: "studio-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
