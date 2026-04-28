"use client";

import { useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { MarkdownText } from "./MarkdownText";
import { extractJSONArray } from "@/lib/ai/parseJSON";

export type AngleCard = {
  title: string;
  teaser: string;
  anchor: string;
  why_it_matters: string;
};

function normalizeCard(c: unknown): AngleCard | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;

  const title = String(
    o.title ?? o["заголовок"] ?? o.heading ?? o.name ?? o.discovery ?? ""
  ).trim();

  const teaser = String(
    o.teaser ??
      o["кратко"] ??
      o.description ??
      o.summary ??
      o.body ??
      o.text ??
      ""
  ).trim();

  const anchor = String(
    o.anchor ??
      o["опора"] ??
      o.keyword ??
      o.key_phrase ??
      o.quote ??
      o.reference ??
      ""
  ).trim();

  const why_it_matters = String(
    o.why_it_matters ??
      o.whyItMatters ??
      o["почему_важно"] ??
      o["почему это важно"] ??
      o.significance ??
      o.insight ??
      o.conclusion ??
      ""
  ).trim();

  if (!title || !teaser || !anchor || !why_it_matters) return null;

  return { title, teaser, anchor, why_it_matters };
}

function extractCards(raw: string): AngleCard[] | null {
  if (!raw || !raw.trim()) {
    console.error("[AngleCards] rawText is empty");
    return null;
  }

  const parsed = extractJSONArray<unknown>(raw);
  if (!parsed) {
    console.error(
      "[AngleCards] extractJSONArray returned null. Raw preview:",
      raw.slice(0, 500)
    );
    return null;
  }

  const cards = parsed
    .map(normalizeCard)
    .filter((c): c is AngleCard => c !== null);

  if (cards.length === 0) {
    console.error(
      "[AngleCards] All cards filtered out. Parsed sample:",
      JSON.stringify(parsed[0])
    );
  }

  return cards;
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
    <div className="angle-cards-stack">
      {cards.map((card, i) => (
        <AngleCardItem
          key={i}
          index={i}
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
  index,
  card,
  reference,
  verseText,
  lang,
  provider,
}: {
  index: number;
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

  const cardNumber = String(index + 1).padStart(2, "0");

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      if (error) setError("");
      return;
    }

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
          anchor: card.anchor,
          reference,
          verseText,
          lang,
          provider,
        }),
      });

      const j = (await r.json()) as { text?: string; error?: string };
      if (!r.ok) throw new Error(j?.error || t.error);

      setArticle(j.text ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    const shareText = `${reference} — ${card.title}\n\n${article}\n\n${t.shareFrom}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${reference} — ${card.title}`,
          text: shareText,
        });
      } catch {
        // user dismissed share sheet
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2500);
      } catch {
        // clipboard unavailable
      }
    }
  }

  return (
    <article className={`angle-card angle-card-premium${expanded ? " is-expanded" : ""}`}>
      <div className="angle-card-topline">
        <div className="angle-card-index">{cardNumber}</div>

        <button
          type="button"
          className={`angle-expand-btn${expanded ? " is-open" : ""}`}
          onClick={handleExpand}
        >
          {expanded ? "Свернуть" : t.expand}
        </button>
      </div>

      <h3 className="angle-card-title">{card.title}</h3>

      <div className="angle-card-divider" />

      <div className="angle-anchor-box">
        <div className="angle-anchor-label">{t.anchor}</div>
        <div className="angle-anchor-text">“{card.anchor}”</div>
      </div>

      <div className="angle-card-body">
        <p className="angle-card-teaser">{card.teaser}</p>
      </div>

      <div className="angle-why">
        <span className="angle-why-label">{t.whyItMatters}: </span>
        <span className="angle-why-text">{card.why_it_matters}</span>
      </div>

      {expanded && (
        <div className="angle-expansion">
          {loading && !article && (
            <div className="angle-expansion-loading">
              <p className="expansion-writing">{t.writing}</p>
              <div className="lens-skeleton-bar" style={{ width: "92%" }} />
              <div className="lens-skeleton-bar" style={{ width: "86%" }} />
              <div className="lens-skeleton-bar" style={{ width: "78%" }} />
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {article && (
            <div className="prose angle-expansion-prose lens-content-appear">
              <MarkdownText text={article} />
            </div>
          )}

          {!loading && !error && article && (
            <div className="angle-expansion-actions">
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleShare}>
                {shareState === "copied" ? t.copied : t.share}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
