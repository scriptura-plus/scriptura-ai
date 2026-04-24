"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { LensId } from "@/lib/prompts/buildLensPrompt";
import type { Provider } from "@/lib/ai/providers";
import { MarkdownText } from "./MarkdownText";
import { AngleCards } from "./AngleCards";

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

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: "70%" }} />
        <div className="skeleton" style={{ width: "92%" }} />
        <div className="skeleton" style={{ width: "85%" }} />
        <div className="skeleton" style={{ width: "60%" }} />
      </div>
    );
  }
  if (error) return <div className="card error">{error}</div>;

  // Angles renders as structured cards
  if (lens === "angles") {
    return (
      <AngleCards
        rawText={text}
        reference={reference}
        verseText={verseText}
        lang={lang}
        provider={provider}
      />
    );
  }

  return (
    <div className="card prose">
      <MarkdownText text={text} />
    </div>
  );
}
