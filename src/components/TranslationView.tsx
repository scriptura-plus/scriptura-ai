"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { extractJSONObject } from "@/lib/ai/parseJSON";

type Quote = { label: string; text: string };
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

/** Normalize analysis to always be an array of paragraph strings */
function toParas(analysis: string | string[]): string[] {
  if (Array.isArray(analysis)) return analysis.filter(Boolean);
  // Legacy string: split on double-newline or sentence-boundary heuristic
  const byNewline = analysis.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  // Single block — return as-is (better than nothing)
  return [analysis];
}

function extractData(raw: string): TranslationData | null {
  const parsed = extractJSONObject<TranslationData>(raw);
  if (!parsed || !parsed.versions || !parsed.divergences || !parsed.verdict) return null;
  return parsed;
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
        if (!cancelled) setData(extractData(j.text ?? ""));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, verseText, lang, provider]);

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: "70%" }} />
        <div className="skeleton" style={{ width: "92%" }} />
        <div className="skeleton" style={{ width: "85%" }} />
      </div>
    );
  }
  if (error) return <div className="card error">{error}</div>;
  if (!data) return <div className="card error">{t.error}</div>;

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Divergence cards */}
      {data.divergences.map((div, i) => (
        <div key={i} className="translation-block">
          <div className="translation-block-title">{div.title}</div>
          <div className="angle-card-divider" />

          {/* Translation rows */}
          <div className="translation-lines">
            {div.quotes.map((q, j) => (
              <div key={j} className="translation-line">
                <span className="translation-label">{q.label}</span>
                <span className="translation-text">"{q.text}"</span>
              </div>
            ))}
          </div>

          {/* Analysis — one <p> per paragraph */}
          <div className="translation-analysis">
            {toParas(div.analysis).map((para, k) => (
              <p key={k}>{para}</p>
            ))}
          </div>
        </div>
      ))}

      {/* Verdict */}
      <div className="translation-verdict">
        <span className="angle-anchor-label">{t.verdict}: </span>
        {data.verdict}
      </div>

      {/* AI disclaimer */}
      <p className="translation-disclaimer">{t.translationDisclaimer}</p>
    </div>
  );
}
