"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!verseText) return;

    let cancelled = false;

    setLoading(true);
    setError("");
    setData(null);

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

  if (loading) {
    return (
      <div className="angle-card angle-card-premium">
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
    <div className="angle-cards-stack">
      {data.cards.map((card, index) => {
        const cardNumber = String(index + 1).padStart(2, "0");
        const kicker = card.kicker.trim() || getFallbackDiscoveryKicker(lang);

        return (
          <article
            key={`${card.title}-${index}`}
            className="angle-card angle-card-premium"
          >
            <div className="angle-card-topline">
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
          </article>
        );
      })}

      {data.summary && (
        <article className="angle-card angle-card-premium">
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
        </article>
      )}

      <p className="translation-disclaimer">{t.translationDisclaimer}</p>
    </div>
  );
}
