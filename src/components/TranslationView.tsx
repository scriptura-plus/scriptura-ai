"use client";

import { useEffect, useMemo, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { extractJSONObject } from "@/lib/ai/parseJSON";

type Quote = {
  label: string;
  text: string;
};

type TranslationDiscoveryCard = {
  kicker: string;
  title: string;
  body: string[];
  quotes: Quote[];
};

type TranslationDiscoveryData = {
  cards: TranslationDiscoveryCard[];
  summary?: string;
};

type ShareStatus = {
  key: string;
  message: string;
} | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toParas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const byNewline = value
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (byNewline.length > 1) return byNewline;

  return [value.trim()].filter(Boolean);
}

function normalizeLabel(label: string): string {
  const cleaned = label.trim();

  if (!cleaned) return "";

  const upper = cleaned.toUpperCase();

  if (upper === "PNM") return "NWT";
  if (upper === "ПНМ") return "NWT";

  return upper;
}

function getTranslationKicker(lang: Lang): string {
  if (lang === "ru") return "Сравнение переводов";
  if (lang === "es") return "Comparación de traducciones";
  return "Translation comparison";
}

function getFallbackDiscoveryKicker(lang: Lang): string {
  if (lang === "ru") return "Переводческое открытие";
  if (lang === "es") return "Descubrimiento de traducción";
  return "Translation discovery";
}

function getSummaryKicker(lang: Lang): string {
  if (lang === "ru") return "Главный сдвиг";
  if (lang === "es") return "Cambio principal";
  return "Main shift";
}

function getShareLabel(lang: Lang): string {
  if (lang === "ru") return "Поделиться";
  if (lang === "es") return "Compartir";
  return "Share";
}

function getShareCopiedMessage(lang: Lang): string {
  if (lang === "ru") return "Скопировано";
  if (lang === "es") return "Copiado";
  return "Copied";
}

function getShareFailedMessage(lang: Lang): string {
  if (lang === "ru") return "Не удалось скопировать";
  if (lang === "es") return "No se pudo copiar";
  return "Could not copy";
}

function buildCardShareText(args: {
  reference: string;
  cardNumber: string;
  card: TranslationDiscoveryCard;
  lang: Lang;
}): string {
  const { reference, cardNumber, card, lang } = args;
  const kicker = card.kicker.trim() || getFallbackDiscoveryKicker(lang);

  const quoteLines = card.quotes
    .map((quote) => {
      const label = normalizeLabel(quote.label);
      const text = quote.text.trim();

      if (!label || !text) return "";

      return `${label}: “${text}”`;
    })
    .filter(Boolean);

  return [
    "Scriptura AI",
    reference,
    "",
    `${cardNumber}. ${kicker}`,
    card.title,
    quoteLines.length ? ["", ...quoteLines].join("\n") : "",
    "",
    ...card.body,
    "",
    "— Scriptura AI",
  ]
    .filter((part) => part !== "")
    .join("\n");
}

function buildSummaryShareText(args: {
  reference: string;
  summary: string;
  lang: Lang;
  verdictLabel: string;
}): string {
  const { reference, summary, lang, verdictLabel } = args;

  return [
    "Scriptura AI",
    reference,
    "",
    getSummaryKicker(lang),
    verdictLabel,
    "",
    summary,
    "",
    "— Scriptura AI",
  ].join("\n");
}

function normalizeQuotes(value: unknown): Quote[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const label = typeof item.label === "string" ? item.label.trim() : "";
      const text = typeof item.text === "string" ? item.text.trim() : "";

      if (!label || !text) return null;

      return { label, text };
    })
    .filter((item): item is Quote => item !== null);
}

function parseNewData(parsed: unknown): TranslationDiscoveryData | null {
  if (!isRecord(parsed) || !Array.isArray(parsed.cards)) return null;

  const cards = parsed.cards
    .map((item, index): TranslationDiscoveryCard | null => {
      if (!isRecord(item)) return null;

      const kicker =
        typeof item.kicker === "string" && item.kicker.trim()
          ? item.kicker.trim()
          : `Card ${index + 1}`;

      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "";

      const body = toParas(item.body);
      const quotes = normalizeQuotes(item.quotes);

      if (!title || body.length === 0) return null;

      return {
        kicker,
        title,
        body,
        quotes,
      };
    })
    .filter((item): item is TranslationDiscoveryCard => item !== null);

  if (cards.length === 0) return null;

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : undefined;

  return { cards, summary };
}

function parseLegacyData(
  parsed: unknown,
  lang: Lang
): TranslationDiscoveryData | null {
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.versions) ||
    !Array.isArray(parsed.divergences) ||
    typeof parsed.verdict !== "string"
  ) {
    return null;
  }

  const kicker = getTranslationKicker(lang);

  const cards = parsed.divergences
    .map((item): TranslationDiscoveryCard | null => {
      if (!isRecord(item)) return null;

      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "";

      const body = toParas(item.analysis);
      const quotes = normalizeQuotes(item.quotes);

      if (!title || body.length === 0) return null;

      return {
        kicker,
        title,
        body,
        quotes,
      };
    })
    .filter((item): item is TranslationDiscoveryCard => item !== null);

  if (cards.length === 0) return null;

  return {
    cards,
    summary: parsed.verdict.trim(),
  };
}

function extractData(raw: string, lang: Lang): TranslationDiscoveryData | null {
  const parsed = extractJSONObject<Record<string, unknown>>(raw);

  return parseNewData(parsed) ?? parseLegacyData(parsed, lang);
}

export function TranslationView({
  reference,
  verseText,
  lang,
  provider,
}: {
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang];

  const [data, setData] = useState<TranslationDiscoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null);

  const shareLabel = useMemo(() => getShareLabel(lang), [lang]);

  useEffect(() => {
    if (!verseText) return;

    let cancelled = false;

    setLoading(true);
    setError("");
    setData(null);
    setShareStatus(null);

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lens",
        id: "translations",
        reference,
        verseText,
        lang,
        provider,
      }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || t.error);
        return j;
      })
      .then((j: { text?: string }) => {
        if (!cancelled) {
          setData(extractData(j.text ?? "", lang));
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message || t.error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, verseText, lang, provider]);

  useEffect(() => {
    if (!shareStatus) return;

    const timeout = window.setTimeout(() => {
      setShareStatus(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  async function handleShare(args: {
    key: string;
    title: string;
    text: string;
  }) {
    const { key, title, text } = args;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareStatus({
          key,
          message: getShareCopiedMessage(lang),
        });
        return;
      }

      throw new Error("Clipboard API is not available.");
    } catch (error) {
      const errorName =
        error instanceof DOMException || error instanceof Error
          ? error.name
          : "";

      if (errorName === "AbortError") return;

      setShareStatus({
        key,
        message: getShareFailedMessage(lang),
      });
    }
  }

  if (loading) {
    return (
      <div className="angle-card angle-card-premium translation-card-shell">
        <style>{translationViewStyles}</style>
        <div className="lens-skeleton-bar" style={{ width: "70%" }} />
        <div className="lens-skeleton-bar" style={{ width: "92%" }} />
        <div className="lens-skeleton-bar" style={{ width: "85%" }} />
      </div>
    );
  }

  if (error) {
    return <div className="card error">{error}</div>;
  }

  if (!data) {
    return <div className="card error">{t.error}</div>;
  }

  return (
    <div className="angle-cards-stack translation-view-stack">
      <style>{translationViewStyles}</style>

      {data.cards.map((card, index) => {
        const cardNumber = String(index + 1).padStart(2, "0");
        const kicker = card.kicker.trim() || getFallbackDiscoveryKicker(lang);
        const shareKey = `translation-card-${index}`;
        const shareText = buildCardShareText({
          reference,
          cardNumber,
          card: {
            ...card,
            kicker,
          },
          lang,
        });

        return (
          <article
            key={`${card.title}-${index}`}
            className="angle-card angle-card-premium translation-card-shell"
          >
            <div className="translation-card-glow" aria-hidden="true" />

            <div className="angle-card-topline translation-card-topline">
              <div className="angle-card-index">{cardNumber}</div>
              <div className="editorial-kicker">{kicker}</div>
            </div>

            <h3 className="angle-card-title">{card.title}</h3>

            {card.quotes.length > 0 && (
              <>
                <div className="angle-card-divider" />

                <div className="translation-lines">
                  {card.quotes.map((q, qIndex) => (
                    <div
                      key={`${q.label}-${qIndex}`}
                      className="translation-line"
                    >
                      <span className="translation-label">
                        {normalizeLabel(q.label)}
                      </span>
                      <span className="translation-text">“{q.text}”</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="angle-card-divider" />

            <div className="editorial-article" style={{ marginTop: 0 }}>
              {card.body.map((paragraph, paragraphIndex) => (
                <p
                  key={`${paragraph.slice(0, 24)}-${paragraphIndex}`}
                  className="editorial-paragraph"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="translation-card-footer">
              <span className="translation-card-brand">Scriptura AI</span>

              <button
                type="button"
                className="translation-share-button"
                onClick={() =>
                  handleShare({
                    key: shareKey,
                    title: `${reference} — ${card.title}`,
                    text: shareText,
                  })
                }
                aria-label={`${shareLabel}: ${card.title}`}
              >
                <span aria-hidden="true">↗</span>
                {shareLabel}
              </button>
            </div>

            {shareStatus?.key === shareKey && (
              <div className="translation-share-status" role="status">
                {shareStatus.message}
              </div>
            )}
          </article>
        );
      })}

      {data.summary && (
        <article className="angle-card angle-card-premium translation-card-shell">
          <div className="translation-card-glow" aria-hidden="true" />

          <div className="editorial-kicker">{getSummaryKicker(lang)}</div>

          <h3 className="angle-card-title">{t.verdict}</h3>

          <div className="angle-card-divider" />

          <p
            className="editorial-lead"
            style={{
              marginBottom: 0,
              paddingBottom: 0,
              borderBottom: "none",
            }}
          >
            {data.summary}
          </p>

          <div className="translation-card-footer">
            <span className="translation-card-brand">Scriptura AI</span>

            <button
              type="button"
              className="translation-share-button"
              onClick={() =>
                handleShare({
                  key: "translation-summary",
                  title: `${reference} — ${t.verdict}`,
                  text: buildSummaryShareText({
                    reference,
                    summary: data.summary ?? "",
                    lang,
                    verdictLabel: t.verdict,
                  }),
                })
              }
              aria-label={`${shareLabel}: ${t.verdict}`}
            >
              <span aria-hidden="true">↗</span>
              {shareLabel}
            </button>
          </div>

          {shareStatus?.key === "translation-summary" && (
            <div className="translation-share-status" role="status">
              {shareStatus.message}
            </div>
          )}
        </article>
      )}

      <p className="translation-disclaimer">{t.translationDisclaimer}</p>
    </div>
  );
}

const translationViewStyles = `
  .translation-view-stack {
    animation: translationStackReveal 420ms ease both;
  }

  .translation-card-shell {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    transform: translateZ(0);
    animation: translationCardReveal 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease;
  }

  .translation-card-shell:hover {
    transform: translateY(-2px);
    box-shadow:
      0 22px 46px rgba(76, 58, 35, 0.13),
      0 2px 8px rgba(76, 58, 35, 0.07);
  }

  .translation-card-glow {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.72), transparent 28%),
      radial-gradient(circle at 100% 20%, rgba(139, 99, 58, 0.08), transparent 34%);
    opacity: 0.9;
  }

  .translation-card-topline {
    position: relative;
  }

  .translation-card-brand {
    color: rgba(90, 74, 55, 0.58);
    font-family: var(--font-serif, Georgia, serif);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .translation-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(138, 90, 43, 0.14);
  }

  .translation-share-button {
    appearance: none;
    border: 1px solid rgba(95, 120, 144, 0.22);
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(247, 238, 222, 0.72));
    color: #5f7890;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 36px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.01em;
    box-shadow:
      0 8px 18px rgba(76, 112, 143, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
    transition:
      transform 140ms ease,
      box-shadow 140ms ease,
      border-color 140ms ease,
      background 140ms ease;
  }

  .translation-share-button:hover {
    transform: translateY(-1px);
    border-color: rgba(95, 120, 144, 0.38);
    box-shadow:
      0 12px 24px rgba(76, 112, 143, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.78);
  }

  .translation-share-button:active {
    transform: translateY(1px) scale(0.985);
  }

  .translation-share-button:focus-visible {
    outline: 3px solid rgba(95, 120, 144, 0.28);
    outline-offset: 3px;
  }

  .translation-share-status {
    margin-top: 10px;
    color: rgba(90, 74, 55, 0.68);
    font-size: 12px;
    text-align: right;
  }

  @keyframes translationStackReveal {
    from {
      opacity: 0.96;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes translationCardReveal {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.992);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .translation-view-stack,
    .translation-card-shell {
      animation: none;
    }

    .translation-card-shell,
    .translation-card-shell:hover,
    .translation-share-button,
    .translation-share-button:hover,
    .translation-share-button:active {
      transform: none;
      transition: none;
    }
  }

  @media (max-width: 520px) {
    .translation-card-footer {
      margin-top: 20px;
      padding-top: 14px;
    }

    .translation-card-brand {
      font-size: 11px;
      letter-spacing: 0.07em;
    }

    .translation-share-button {
      min-height: 34px;
      padding: 0 12px;
      font-size: 12px;
    }
  }
`;
