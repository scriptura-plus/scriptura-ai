"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { LensId } from "@/lib/prompts/buildLensPrompt";
import type { Provider } from "@/lib/ai/providers";
import { MarkdownText } from "./MarkdownText";
import { AngleCards } from "./AngleCards";
import { WordCards } from "./WordCards";
import { ContextLens } from "./ContextLens";
import { TranslationView } from "./TranslationView";

export function LensResults({
  lens,
  reference,
  verseText,
  lang,
  provider,
}: {
  lens: LensId;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang];
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Context and Translations own their own fetching — skip
    if (lens === "context" || lens === "translations") return;
    if (!verseText) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setText("");

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lens",
        id: lens,
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
        if (!cancelled) setText(j.text ?? "");
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, reference, verseText, lang, provider]);

  // Context lens — owns its own fetching via ContextLens
  if (lens === "context") {
    return (
      <ContextLens
        reference={reference}
        verseText={verseText}
        lang={lang}
        provider={provider}
      />
    );
  }

  // Translations lens — owns its own fetching via TranslationView
  if (lens === "translations") {
    return (
      <TranslationView
        reference={reference}
        verseText={verseText}
        lang={lang}
        provider={provider}
      />
    );
  }

  if (loading) {
    return (
      <div className="card">
        <div className="lens-skeleton-bar" style={{ width: "60%" }} />
        <div className="lens-skeleton-bar" style={{ width: "85%" }} />
        <div className="lens-skeleton-bar" style={{ width: "78%" }} />
        <div className="lens-skeleton-bar" style={{ width: "55%" }} />
      </div>
    );
  }
  if (error) return <div className="card error">{error}</div>;

  // Angles renders as structured cards
  if (lens === "angles") {
    return (
      <div className="lens-content-appear">
        <AngleCards
          rawText={text}
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      </div>
    );
  }

  // Word lens renders as structured word cards
  if (lens === "word") {
    return (
      <div className="lens-content-appear">
        <WordCards
          rawText={text}
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      </div>
    );
  }

  return (
    <div className="lens-content-appear card prose">
      <MarkdownText text={text} />
    </div>
  );
}
