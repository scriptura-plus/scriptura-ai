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
    o.title ?? o["заголовок"] ?? o.heading ?? o.name ?? o.discovery ?? "",
  ).trim();

  const teaser = String(
    o.teaser ??
      o["кратко"] ??
      o.description ??
      o.summary ??
      o.body ??
      o.text ??
      "",
  ).trim();

  const anchor = String(
    o.anchor ??
      o["опора"] ??
      o.keyword ??
      o.key_phrase ??
      o.quote ??
      o.reference ??
      "",
  ).trim();

  const why_it_matters = String(
    o.why_it_matters ??
      o.whyItMatters ??
      o["почему_важно"] ??
      o["почему это важно"] ??
      o.significance ??
      o.insight ??
      o.conclusion ??
      "",
  ).trim();

  if (!title || !teaser || !anchor || !why_it_matters) return null;

  return {
    title,
    teaser,
    anchor,
    why_it_matters,
  };
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
      raw.slice(0, 500),
    );
    return null;
  }

  const cards = parsed
    .map(normalizeCard)
    .filter((c): c is AngleCard => c !== null);

  if (cards.length === 0) {
    console.error(
      "[AngleCards] All cards filtered out. Parsed sample:",
      JSON.stringify(parsed[0]),
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
    <>
      <style>{`
        .angle-card-stack {
          display: grid;
          gap: 16px;
        }

        .angle-card-premium {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.58), transparent 38%),
            linear-gradient(180deg, rgba(255, 252, 244, 0.96), rgba(255, 247, 232, 0.94));
          border: 1px solid rgba(123, 91, 55, 0.15);
          border-radius: 20px;
          padding: 18px 18px 17px;
          box-shadow:
            0 1px 1px rgba(255, 255, 255, 0.50) inset,
            0 1px 2px rgba(70, 46, 22, 0.055),
            0 16px 34px rgba(70, 46, 22, 0.085);
          animation: angle-card-appear 0.28s ease-out both;
        }

        .angle-card-premium::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.76),
            transparent
          );
          pointer-events: none;
        }

        .angle-card-premium::after {
          content: "";
          position: absolute;
          top: -90px;
          right: -90px;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(111, 135, 154, 0.10), transparent 66%);
          pointer-events: none;
        }

        @keyframes angle-card-appear {
          from {
            opacity: 0;
            transform: translateY(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .angle-card-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }

        .angle-card-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--ink-muted);
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          line-height: 1;
        }

        .angle-card-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 25px;
          height: 25px;
          padding: 0 7px;
          border-radius: 999px;
          background: rgba(111, 135, 154, 0.12);
          color: var(--ui-active-deep);
          border: 1px solid rgba(111, 135, 154, 0.16);
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }

        .angle-card-expand {
          appearance: none;
          border: 1px solid rgba(111, 135, 154, 0.22);
          background: rgba(255, 249, 236, 0.72);
          color: var(--ui-active-deep);
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 13px;
          font-weight: 750;
          font-family: inherit;
          cursor: pointer;
          box-shadow:
            0 1px 1px rgba(255, 255, 255, 0.46) inset,
            0 6px 14px rgba(55, 82, 105, 0.075);
          transition:
            transform 0.08s ease,
            background 0.14s ease,
            border-color 0.14s ease,
            box-shadow 0.14s ease;
          flex-shrink: 0;
        }

        .angle-card-expand:hover {
          background: rgba(216, 228, 237, 0.42);
          border-color: rgba(111, 135, 154, 0.32);
          box-shadow:
            0 1px 1px rgba(255, 255, 255, 0.48) inset,
            0 9px 18px rgba(55, 82, 105, 0.11);
        }

        .angle-card-expand:active {
          transform: scale(0.975);
        }

        .angle-card-expand.is-open {
          background: transparent;
          color: var(--ink-soft);
          box-shadow: none;
        }

        .angle-card-title-premium {
          position: relative;
          z-index: 1;
          font-family: var(--serif);
          font-size: 20px;
          font-weight: 680;
          color: var(--ink);
          line-height: 1.22;
          letter-spacing: -0.018em;
          margin: 0 0 12px;
          max-width: 95%;
        }

        .angle-card-anchor-premium {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 4px;
          margin: 0 0 14px;
          padding: 11px 12px 11px 13px;
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(239, 228, 208, 0.38), rgba(255, 249, 236, 0.32));
          border: 1px solid rgba(123, 91, 55, 0.12);
        }

        .angle-card-anchor-label-premium {
          color: var(--accent-soft);
          font-size: 11px;
          font-weight: 780;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          line-height: 1;
        }

        .angle-card-anchor-text-premium {
          color: var(--ink-soft);
          font-size: 14px;
          line-height: 1.45;
          font-style: italic;
        }

        .angle-card-teaser-premium {
          position: relative;
          z-index: 1;
          color: var(--ink);
          font-size: 15.5px;
          line-height: 1.72;
          margin: 0 0 14px;
        }

        .angle-why-premium {
          position: relative;
          z-index: 1;
          padding-top: 13px;
          border-top: 1px solid rgba(123, 91, 55, 0.14);
          color: var(--ink-soft);
          font-size: 13.5px;
          line-height: 1.58;
        }

        .angle-why-premium strong {
          color: var(--ui-active-deep);
          font-weight: 780;
        }

        .angle-expansion-premium {
          position: relative;
          z-index: 1;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(123, 91, 55, 0.14);
          animation: angle-card-appear 0.24s ease-out both;
        }

        .angle-expansion-premium .prose {
          font-size: 15px;
          line-height: 1.72;
        }

        .angle-expansion-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(123, 91, 55, 0.12);
        }

        .angle-share-button {
          appearance: none;
          border: 1px solid rgba(111, 135, 154, 0.22);
          background: rgba(216, 228, 237, 0.30);
          color: var(--ui-active-deep);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 750;
          font-family: inherit;
          cursor: pointer;
          transition:
            transform 0.08s ease,
            background 0.14s ease,
            border-color 0.14s ease,
            box-shadow 0.14s ease;
        }

        .angle-share-button:hover {
          background: rgba(216, 228, 237, 0.48);
          border-color: rgba(111, 135, 154, 0.34);
          box-shadow: 0 7px 16px rgba(55, 82, 105, 0.09);
        }

        .angle-share-button:active {
          transform: scale(0.975);
        }

        .expansion-writing-premium {
          color: var(--ink-soft);
          font-size: 14px;
          font-style: italic;
          margin: 0;
          opacity: 0.78;
        }

        @media (max-width: 480px) {
          .angle-card-stack {
            gap: 14px;
          }

          .angle-card-premium {
            border-radius: 18px;
            padding: 16px 16px 15px;
          }

          .angle-card-title-premium {
            font-size: 18.5px;
            line-height: 1.25;
          }

          .angle-card-teaser-premium {
            font-size: 15px;
            line-height: 1.68;
          }

          .angle-card-anchor-premium {
            padding: 10px 11px;
          }
        }
      `}</style>

      <div className="angle-card-stack">
        {cards.map((card, i) => (
          <AngleCardItem
            key={i}
            card={card}
            index={i}
            reference={reference}
            verseText={verseText}
            lang={lang}
            provider={provider}
          />
        ))}
      </div>
    </>
  );
}

function AngleCardItem({
  card,
  index,
  reference,
  verseText,
  lang,
  provider,
}: {
  card: AngleCard;
  index: number;
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
        // User dismissed share sheet — do nothing.
      }

      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      // Clipboard unavailable — silent fail.
    }
  }

  const displayNumber = String(index + 1).padStart(2, "0");

  return (
    <article className="angle-card-premium">
      <div className="angle-card-topline">
        <div className="angle-card-kicker">
          <span className="angle-card-number">{displayNumber}</span>
        </div>

        <button
          type="button"
          className={`angle-card-expand${expanded ? " is-open" : ""}`}
          onClick={handleExpand}
          aria-expanded={expanded}
        >
          {expanded ? "↑" : t.expand}
        </button>
      </div>

      <h3 className="angle-card-title-premium">{card.title}</h3>

      <div className="angle-card-anchor-premium">
        <div className="angle-card-anchor-label-premium">{t.anchor}</div>
        <div className="angle-card-anchor-text-premium">“{card.anchor}”</div>
      </div>

      <p className="angle-card-teaser-premium">{card.teaser}</p>

      <div className="angle-why-premium">
        <strong>{t.whyItMatters}: </strong>
        {card.why_it_matters}
      </div>

      {expanded && (
        <div className="angle-expansion-premium">
          {loading && !article ? (
            <p className="expansion-writing-premium">{t.writing}</p>
          ) : null}

          {error ? <div className="error">{error}</div> : null}

          {article ? (
            <div className="prose">
              <MarkdownText text={article} />
            </div>
          ) : null}

          {!loading && !error && article ? (
            <div className="angle-expansion-actions">
              <button
                type="button"
                className="angle-share-button"
                onClick={handleShare}
              >
                {shareState === "copied" ? t.copied : t.share}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
