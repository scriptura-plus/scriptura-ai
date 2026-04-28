"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { extractJSONObject } from "@/lib/ai/parseJSON";

type Quote = {
  label: string;
  text: string;
};

type Divergence = {
  title: string;
  quotes: Quote[];
  analysis: string | string[];
};

type TranslationData = {
  versions: Record<string, string>;
  divergences: Divergence[];
  verdict: string;
};

function toParas(analysis: string | string[]): string[] {
  if (Array.isArray(analysis)) {
    return analysis.map((s) => s.trim()).filter(Boolean);
  }

  const byNewline = analysis
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (byNewline.length > 1) return byNewline;

  return [analysis.trim()].filter(Boolean);
}

function extractData(raw: string): TranslationData | null {
  const parsed = extractJSONObject<TranslationData>(raw);

  if (
    !parsed ||
    !parsed.versions ||
    !Array.isArray(parsed.divergences) ||
    typeof parsed.verdict !== "string"
  ) {
    return null;
  }

  return parsed;
}

function getTranslationKicker(lang: Lang): string {
  if (lang === "ru") return "Сравнение переводов";
  if (lang === "es") return "Comparación de traducciones";
  return "Translation comparison";
}

function getVerdictTitle(lang: Lang): string {
  if (lang === "ru") return "Итоговый сдвиг";
  if (lang === "es") return "Cambio principal";
  return "Main shift";
}

function normalizeLabel(label: string): string {
  const cleaned = label.trim();

  if (!cleaned) return "";

  const upper = cleaned.toUpperCase();

  if (upper === "PNM") return "NWT";
  if (upper === "ПНМ") return "NWT";

  return upper;
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

  const [data, setData] = useState<TranslationData | null>(null);
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
          setData(extractData(j.text ?? ""));
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

  const kicker = getTranslationKicker(lang);
  const verdictTitle = getVerdictTitle(lang);

  return (
    <div className="angle-cards-stack">
      {data.divergences.map((div, index) => {
        const cardNumber = String(index + 1).padStart(2, "0");
        const paragraphs = toParas(div.analysis);
        const firstParagraph = paragraphs[0];
        const restParagraphs = paragraphs.slice(1);

        return (
          <article
            key={`${div.title}-${index}`}
            className="angle-card angle-card-premium"
          >
            <div className="angle-card-topline">
              <div className="angle-card-index">{cardNumber}</div>
              <div className="editorial-kicker">{kicker}</div>
            </div>

            <h3 className="angle-card-title">{div.title}</h3>

            <div className="angle-card-divider" />

            <div className="translation-lines">
              {div.quotes.map((q, qIndex) => (
                <div key={`${q.label}-${qIndex}`} className="translation-line">
                  <span className="translation-label">
                    {normalizeLabel(q.label)}
                  </span>
                  <span className="translation-text">“{q.text}”</span>
                </div>
              ))}
            </div>

            <div className="angle-card-divider" />

            <div className="editorial-article" style={{ marginTop: 0 }}>
              {firstParagraph && (
                <p className="editorial-paragraph">{firstParagraph}</p>
              )}

              {restParagraphs.map((paragraph, paragraphIndex) => (
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

      <article className="angle-card angle-card-premium">
        <div className="editorial-kicker">{verdictTitle}</div>

        <h3 className="angle-card-title">{t.verdict}</h3>

        <div className="angle-card-divider" />

        <p className="editorial-lead" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>
          {data.verdict}
        </p>
      </article>

      <p className="translation-disclaimer">{t.translationDisclaimer}</p>
    </div>
  );
}
