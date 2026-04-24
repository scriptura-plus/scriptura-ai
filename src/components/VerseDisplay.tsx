"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";

export function VerseDisplay({
  reference,
  lang,
  provider,
  onLoaded,
}: {
  reference: string;
  lang: Lang;
  provider: Provider;
  onLoaded?: (text: string) => void;
}) {
  const t = dictionary[lang];
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setText("");

    fetch("/api/verse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, lang, provider }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || t.error);
        return j;
      })
      .then((j: { text?: string }) => {
        if (cancelled) return;
        const v = j.text ?? "";
        setText(v);
        onLoaded?.(v);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, lang, provider]);

  return (
    <div className="card">
      <div className="muted" style={{ marginBottom: 8 }}>{reference}</div>
      {loading && (
        <>
          <div className="skeleton" style={{ width: "92%" }} />
          <div className="skeleton" style={{ width: "80%" }} />
        </>
      )}
      {!loading && error && <div className="error">{error}</div>}
      {!loading && !error && <div className="verse-text">{text}</div>}
    </div>
  );
}
