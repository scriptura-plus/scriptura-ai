"use client";

import { useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { EXTRA_ORDER, type ExtraId } from "@/lib/prompts/buildExtraPrompt";
import { MarkdownText } from "./MarkdownText";

export function ExtraAnalysis({
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
  const t = dictionary[lang].extra;
  return (
    <section>
      <h2 className="h2" style={{ marginTop: 28 }}>{t.title}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {EXTRA_ORDER.map((id) => (
          <ExtraItem
            key={id}
            id={id}
            title={t[id]}
            reference={reference}
            verseText={verseText}
            lang={lang}
            provider={provider}
          />
        ))}
      </div>
    </section>
  );
}

function ExtraItem({
  id,
  title,
  reference,
  verseText,
  lang,
  provider,
}: {
  id: ExtraId;
  title: string;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const T = dictionary[lang];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (text || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "extra",
          id,
          reference,
          verseText,
          lang,
          provider,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || T.error);
      setText(j.text ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : T.error);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--ink)",
          fontFamily: "inherit",
        }}
      >
        <span className="section-title">{title}</span>
        <span className="muted">{open ? T.hide : T.show}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {loading && (
            <>
              <div className="skeleton" style={{ width: "80%" }} />
              <div className="skeleton" style={{ width: "65%" }} />
            </>
          )}
          {error && <div className="error">{error}</div>}
          {!loading && !error && text && (
            <div className="prose">
              <MarkdownText text={text} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
