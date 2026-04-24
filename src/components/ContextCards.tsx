"use client";

import { useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";

import { MarkdownText } from "./MarkdownText";

export type ContextLevel = "narrow" | "wide";

export type ContextCard = {
  title: string;
  teaser: string;
  shift: string;
  why_it_matters: string;
};

type NarrowPayload = {
  thesis: string;
  cards: ContextCard[];
};

function extractNarrow(raw: string): NarrowPayload | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed !== "object" ||
      typeof parsed.thesis !== "string" ||
      !Array.isArray(parsed.cards)
    ) return null;
    const cards = parsed.cards.filter(
      (c: unknown) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).title === "string" &&
        typeof (c as Record<string, unknown>).teaser === "string" &&
        typeof (c as Record<string, unknown>).shift === "string" &&
        typeof (c as Record<string, unknown>).why_it_matters === "string",
    ) as ContextCard[];
    return { thesis: parsed.thesis, cards };
  } catch {
    return null;
  }
}

function extractWide(raw: string): ContextCard[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (c: unknown) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).title === "string" &&
        typeof (c as Record<string, unknown>).teaser === "string" &&
        typeof (c as Record<string, unknown>).shift === "string" &&
        typeof (c as Record<string, unknown>).why_it_matters === "string",
    ) as ContextCard[];
  } catch {
    return null;
  }
}

export function ContextCards({
  rawText,
  level,
  reference,
  verseText,
  lang,
  provider,
}: {
  rawText: string;
  level: ContextLevel;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang];

  if (level === "narrow") {
    const payload = extractNarrow(rawText);
    if (!payload || payload.cards.length === 0) {
      return (
        <div className="card error">
          {t.error} (Could not parse narrow context — the AI may have returned non-JSON.)
        </div>
      );
    }
    return (
      <div style={{ display: "grid", gap: 14 }}>
        {payload.thesis && (
          <p style={{ fontStyle: "italic", fontSize: "1.05rem", lineHeight: 1.6, margin: 0 }}>
            {payload.thesis}
          </p>
        )}
        {payload.cards.map((card, i) => (
          <ContextCardItem
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

  // wide
  const cards = extractWide(rawText);
  if (!cards || cards.length === 0) {
    return (
      <div className="card error">
        {t.error} (Could not parse wide context — the AI may have returned non-JSON.)
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {cards.map((card, i) => (
        <ContextCardItem
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

function ContextCardItem({
  card,
  reference,
  verseText,
  lang,
  provider,
}: {
  card: ContextCard;
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
    if (article) return;

    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "expand-angle",
          angleTitle: card.title,
          anchor: card.shift,
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
      <div className="angle-card-header">
        <div>
          <div className="angle-card-title">{card.title}</div>
          <div className="angle-card-divider" />
          <div className="angle-card-anchor">
            <span className="angle-anchor-label">{t.shift}: </span>
            <span className="angle-anchor-text">"{card.shift}"</span>
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

      <p className="angle-card-teaser">{card.teaser}</p>

      <div className="angle-why">
        <span className="angle-anchor-label">{t.whyItMatters}: </span>
        {card.why_it_matters}
      </div>

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
