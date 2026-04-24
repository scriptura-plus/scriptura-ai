"use client";

import { useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { MarkdownText } from "./MarkdownText";

export type AngleCard = {
  title: string;
  teaser: string;
  anchor: string;
  why_it_matters: string;
};

function extractCards(raw: string): AngleCard[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (c) =>
        typeof c === "object" &&
        typeof c.title === "string" &&
        typeof c.teaser === "string" &&
        typeof c.anchor === "string" &&
        typeof c.why_it_matters === "string",
    );
  } catch {
    return null;
  }
}

export function AngleCards({
  rawText,
  reference,
  verseText,
  lang,
  provider,
}: {
  rawText: string;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang];
  const cards = extractCards(rawText);

  if (!cards || cards.length === 0) {
    return (
      <div className="card error">
        {t.error} (Could not parse angles — the AI may have returned non-JSON.)
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {cards.map((card, i) => (
        <AngleCardItem
          key={i}
          card={card}
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      ))}
    </div>
  );
}

function AngleCardItem({
  card,
  reference,
  verseText,
  lang,
  provider,
}: {
  card: AngleCard;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang];
  const [expanded, setExpanded] = useState(false);
  const [article, setArticle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  async function handleExpand() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (article) return; // already loaded

    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "expand-angle",
          angleTitle: card.title,
          anchor: card.anchor,
          reference,
          verseText,
          lang,
          provider,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || t.error);
      setArticle(j.text ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    const shareText =
      `${reference} — ${card.title}\n\n${article}\n\n${t.shareFrom}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${reference} — ${card.title}`, text: shareText });
      } catch {
        // user dismissed share sheet — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2500);
      } catch {
        // clipboard unavailable — silent fail
      }
    }
  }

  return (
    <div className="angle-card">
      {/* Card header */}
      <div className="angle-card-header">
        <div>
          <div className="angle-card-title">{card.title}</div>
          <div className="angle-card-divider" />
          <div className="angle-card-anchor">
            <span className="angle-anchor-label">{t.anchor}: </span>
            <span className="angle-anchor-text">"{card.anchor}"</span>
          </div>
        </div>
        <button
          type="button"
          className={`btn btn-sm${expanded ? " btn-ghost" : ""}`}
          onClick={handleExpand}
          style={{ flexShrink: 0, alignSelf: "flex-start" }}
        >
          {expanded ? "↑" : t.expand}
        </button>
      </div>

      {/* Teaser */}
      <p className="angle-card-teaser">{card.teaser}</p>

      {/* Why it matters */}
      <div className="angle-why">
        <span className="angle-anchor-label">{t.whyItMatters}: </span>
        {card.why_it_matters}
      </div>

      {/* Expanded article */}
      {expanded && (
        <div className="angle-expansion">
          {loading && (
            <>
              <div className="skeleton" style={{ width: "80%" }} />
              <div className="skeleton" style={{ width: "92%" }} />
              <div className="skeleton" style={{ width: "68%" }} />
            </>
          )}
          {error && <div className="error">{error}</div>}
          {!loading && !error && article && (
            <>
              <div className="prose">
                <MarkdownText text={article} />
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleShare}
                >
                  {shareState === "copied" ? t.copied : t.share}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
