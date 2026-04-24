"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { ContextCards } from "./ContextCards";

export function ContextLens({
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

  const [narrowText, setNarrowText] = useState("");
  const [narrowLoading, setNarrowLoading] = useState(true);
  const [narrowError, setNarrowError] = useState("");

  const [wideText, setWideText] = useState("");
  const [wideLoading, setWideLoading] = useState(false);
  const [wideRequested, setWideRequested] = useState(false);
  const [wideError, setWideError] = useState("");

  useEffect(() => {
    if (!verseText) return;
    let cancelled = false;
    setNarrowLoading(true);
    setNarrowError("");
    setNarrowText("");
    setWideText("");
    setWideRequested(false);
    setWideError("");

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "context",
        level: "narrow",
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
        if (!cancelled) setNarrowText(j.text ?? "");
      })
      .catch((e: Error) => {
        if (!cancelled) setNarrowError(e.message || t.error);
      })
      .finally(() => {
        if (!cancelled) setNarrowLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, verseText, lang, provider]);

  function handleWideRequest() {
    setWideRequested(true);
    setWideLoading(true);
    setWideError("");

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "context",
        level: "wide",
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
        setWideText(j.text ?? "");
      })
      .catch((e: Error) => {
        setWideError(e.message || t.error);
      })
      .finally(() => {
        setWideLoading(false);
      });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Narrow context */}
      {narrowLoading && (
        <div className="card">
          <div className="skeleton" style={{ width: "70%" }} />
          <div className="skeleton" style={{ width: "92%" }} />
          <div className="skeleton" style={{ width: "85%" }} />
          <div className="skeleton" style={{ width: "60%" }} />
        </div>
      )}
      {narrowError && <div className="card error">{narrowError}</div>}
      {!narrowLoading && !narrowError && narrowText && (
        <ContextCards
          rawText={narrowText}
          level="narrow"
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      )}

      {/* Wide context button / loader / cards */}
      {!narrowLoading && !narrowError && narrowText && !wideRequested && (
        <div>
          <button
            type="button"
            className="btn"
            onClick={handleWideRequest}
          >
            {t.showWideContext}
          </button>
        </div>
      )}

      {wideRequested && wideLoading && (
        <div className="card">
          <div className="skeleton" style={{ width: "70%" }} />
          <div className="skeleton" style={{ width: "92%" }} />
          <div className="skeleton" style={{ width: "85%" }} />
          <div className="skeleton" style={{ width: "60%" }} />
        </div>
      )}
      {wideRequested && wideError && <div className="card error">{wideError}</div>}
      {wideRequested && !wideLoading && !wideError && wideText && (
        <ContextCards
          rawText={wideText}
          level="wide"
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      )}
    </div>
  );
}
