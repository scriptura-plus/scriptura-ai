"use client";

import { useState, type ReactNode, type TouchEvent } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
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

function getCollapseLabel(lang: Lang): string {
  if (lang === "ru") return "Свернуть";
  if (lang === "es") return "Ocultar";
  return "Collapse";
}

function getArticleLabel(lang: Lang): string {
  if (lang === "ru") return "Развернутая мысль";
  if (lang === "es") return "Lectura ampliada";
  return "Expanded reading";
}

function getShareLabel(lang: Lang): string {
  if (lang === "ru") return "Поделиться этой мыслью";
  if (lang === "es") return "Compartir esta idea";
  return "Share this insight";
}

function getPreviousLabel(lang: Lang): string {
  if (lang === "ru") return "Назад";
  if (lang === "es") return "Anterior";
  return "Previous";
}

function getNextLabel(lang: Lang): string {
  if (lang === "ru") return "Дальше";
  if (lang === "es") return "Siguiente";
  return "Next";
}

function formatCardNumber(value: number): string {
  if (value < 10) return String(value).padStart(2, "0");
  return String(value);
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:markdown|md|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeArticleText(text: string): string {
  return stripCodeFence(text)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitArticleParagraphs(text: string): string[] {
  const normalized = normalizeArticleText(text);

  const paragraphs = normalized
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) return paragraphs;

  return normalized
    .split(/(?<=[.!?])\s+(?=[А-ЯA-ZЁ])/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/^#{1,4}\s+/g, "")
    .replace(/^[-–—]\s+/g, "")
    .trim();
}

function isHeadingLike(text: string): boolean {
  const cleaned = cleanInlineMarkdown(text);
  if (cleaned.length > 90) return false;
  if (/[.!?]$/.test(cleaned)) return false;
  return /^#{1,4}\s+/.test(text.trim()) || cleaned.split(/\s+/).length <= 8;
}

function removeMarkdownMarkers(text: string): string {
  return cleanInlineMarkdown(text)
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSentenceCandidates(paragraphs: string[]): string[] {
  return paragraphs
    .flatMap((paragraph) =>
      removeMarkdownMarkers(paragraph)
        .split(/(?<=[.!?])\s+/g)
        .map((sentence) => sentence.trim())
    )
    .filter((sentence) => sentence.length >= 70 && sentence.length <= 190);
}

function pickPullQuote(paragraphs: string[], title: string): string {
  const candidates = getSentenceCandidates(paragraphs.slice(1));

  const strong =
    candidates.find((sentence) =>
      /(не просто|именно|становится|превращает|показывает|открывает|меняет|центр|ключ)/i.test(
        sentence
      )
    ) ?? candidates[0];

  if (strong) return strong.replace(/[.。]$/, "");

  return title;
}

function renderInlineText(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <span key={index} className="editorial-term">
          {part.slice(1, -1)}
        </span>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return <span key={index}>{part}</span>;
  });
}

function EditorialArticle({
  text,
  title,
  lang,
}: {
  text: string;
  title: string;
  lang: Lang;
}) {
  const paragraphs = splitArticleParagraphs(text);
  const articleLabel = getArticleLabel(lang);
  const pullQuote = pickPullQuote(paragraphs, title);

  if (paragraphs.length === 0) return null;

  const first = paragraphs[0];
  const rest = paragraphs.slice(1);

  return (
    <div className="editorial-article">
      <div className="editorial-kicker">{articleLabel}</div>

      <p className="editorial-lead">
        {renderInlineText(cleanInlineMarkdown(first))}
      </p>

      {rest.map((paragraph, index) => {
        const cleaned = cleanInlineMarkdown(paragraph);
        const shouldInsertPullQuote = index === 1 && pullQuote;
        const shouldInsertDivider = index > 0 && index % 3 === 0;

        return (
          <div key={`${cleaned.slice(0, 30)}-${index}`}>
            {shouldInsertPullQuote && (
              <aside className="editorial-pullquote">
                <span>“</span>
                {pullQuote}
                <span>”</span>
              </aside>
            )}

            {shouldInsertDivider && <div className="editorial-divider" />}

            {isHeadingLike(paragraph) ? (
              <h4 className="editorial-subhead">{renderInlineText(cleaned)}</h4>
            ) : (
              <p className="editorial-paragraph">{renderInlineText(cleaned)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
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
  const parsedCards = extractCards(rawText);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  if (!parsedCards || parsedCards.length === 0) {
    return (
      <div className="card error">
        {t.error} (Could not parse angles — the AI may have returned non-JSON.)
      </div>
    );
  }

  const cards = parsedCards;
  const safeIndex = Math.min(currentIndex, cards.length - 1);
  const currentCard = cards[safeIndex];
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < cards.length - 1;
  const isCurrentExpanded = expandedIndex === safeIndex;

  function goPrevious() {
    if (!canGoPrevious) return;
    setExpandedIndex(null);
    setCurrentIndex((value) => Math.max(0, value - 1));
  }

  function goNext() {
    if (!canGoNext) return;
    setExpandedIndex(null);
    setCurrentIndex((value) => Math.min(cards.length - 1, value + 1));
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (isCurrentExpanded) return;

    const touch = event.touches[0];
    if (!touch) return;

    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (isCurrentExpanded) return;
    if (touchStartX === null || touchStartY === null) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    setTouchStartX(null);
    setTouchStartY(null);

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (absX < 45) return;
    if (absY > absX * 0.8) return;

    if (diffX < 0) {
      goNext();
    } else {
      goPrevious();
    }
  }

  return (
    <div className="angle-cards-carousel">
      <style>{`
        .angle-cards-carousel {
          display: grid;
          gap: 12px;
        }

        .angle-carousel-stage {
          touch-action: pan-y;
          animation: angleCardFadeIn 220ms ease both;
        }

        .angle-carousel-stage.is-expanded {
          touch-action: auto;
        }

        @keyframes angleCardFadeIn {
          from {
            opacity: 0.72;
            transform: translateY(4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .angle-card-progress {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          width: auto;
          min-width: 0;
          height: auto;
          padding: 2px 2px;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.055em;
          opacity: 0.52;
        }

        .angle-card-progress-current {
          font-size: 12px;
          line-height: 1;
          font-weight: 650;
          color: rgba(96, 110, 123, 0.72);
        }

        .angle-card-progress-separator {
          font-size: 11px;
          line-height: 1;
          font-weight: 500;
          color: rgba(96, 110, 123, 0.34);
        }

        .angle-card-progress-total {
          font-size: 11px;
          line-height: 1;
          font-weight: 560;
          color: rgba(96, 110, 123, 0.44);
        }

        .angle-carousel-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 6px;
        }

        .angle-carousel-btn {
          border: 1px solid rgba(138, 90, 43, 0.16);
          border-radius: 999px;
          background: rgba(255, 253, 250, 0.72);
          color: rgba(47, 41, 35, 0.72);
          padding: 13px 16px;
          font: inherit;
          font-size: 14px;
          font-weight: 760;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(42, 31, 22, 0.045);
          transition:
            opacity 0.14s ease,
            transform 0.14s ease,
            box-shadow 0.14s ease,
            background 0.14s ease;
        }

        .angle-carousel-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(42, 31, 22, 0.075);
          background: rgba(255, 253, 250, 0.9);
        }

        .angle-carousel-btn:disabled {
          opacity: 0.32;
          cursor: not-allowed;
          box-shadow: none;
        }

        .angle-carousel-btn.is-primary {
          background: linear-gradient(180deg, #2f2923 0%, #1f1a16 100%);
          color: #fffaf3;
          border-color: rgba(47, 41, 35, 0.24);
          box-shadow: 0 12px 24px rgba(42, 31, 22, 0.145);
        }

        .angle-carousel-btn.is-primary:disabled {
          background: rgba(255, 253, 250, 0.72);
          color: rgba(47, 41, 35, 0.42);
        }

        .angle-card-premium .angle-expand-btn {
          box-shadow: 0 5px 14px rgba(42, 31, 22, 0.035);
        }

        @media (max-width: 520px) {
          .angle-cards-carousel {
            gap: 10px;
          }

          .angle-carousel-nav {
            gap: 9px;
          }

          .angle-carousel-btn {
            padding: 12px 13px;
            font-size: 13px;
          }

          .angle-card-progress {
            gap: 4px;
            opacity: 0.60;
          }

          .angle-card-progress-current {
            font-size: 11px;
            font-weight: 620;
          }

          .angle-card-progress-separator {
  font-size: 10px;
}

.angle-card-progress-total {
  font-size: 10px;
  color: rgba(96, 110, 123, 0.62);
  font-weight: 620;
}
        }
      `}</style>

      <div
        key={`${currentCard.title}-${safeIndex}`}
        className={`angle-carousel-stage${isCurrentExpanded ? " is-expanded" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AngleCardItem
          index={safeIndex}
          totalCount={cards.length}
          card={currentCard}
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
          expanded={isCurrentExpanded}
          onExpandedChange={(nextExpanded) =>
            setExpandedIndex(nextExpanded ? safeIndex : null)
          }
        />
      </div>

      {cards.length > 1 && (
        <div className="angle-carousel-nav">
          <button
            type="button"
            className="angle-carousel-btn"
            onClick={goPrevious}
            disabled={!canGoPrevious}
          >
            ← {getPreviousLabel(lang)}
          </button>

          <button
            type="button"
            className="angle-carousel-btn is-primary"
            onClick={goNext}
            disabled={!canGoNext}
          >
            {getNextLabel(lang)} →
          </button>
        </div>
      )}
    </div>
  );
}

function AngleCardItem({
  index,
  totalCount,
  card,
  reference,
  verseText,
  lang,
  provider,
  expanded,
  onExpandedChange,
}: {
  index: number;
  totalCount: number;
  card: AngleCard;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const t = dictionary[lang];
  const collapseLabel = getCollapseLabel(lang);
  const shareLabel = getShareLabel(lang);

  const [article, setArticle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  const cardNumber = formatCardNumber(index + 1);
  const totalNumber = String(totalCount);

  async function handleExpand() {
    if (expanded) {
      onExpandedChange(false);
      if (error) setError("");
      return;
    }

    onExpandedChange(true);
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
    const baseText = article || card.teaser;
    const shareText = `${reference} — ${card.title}\n\n${baseText}\n\n${t.shareFrom}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${reference} — ${card.title}`,
          text: shareText,
        });
      } catch {
        // user dismissed share sheet
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <article className={`angle-card angle-card-premium${expanded ? " is-expanded" : ""}`}>
      <div className="angle-card-topline">
        <div
          className="angle-card-index angle-card-progress"
          aria-label={`${index + 1} of ${totalCount}`}
        >
          <span className="angle-card-progress-current">{cardNumber}</span>
          <span className="angle-card-progress-separator">—</span>
          <span className="angle-card-progress-total">{totalNumber}</span>
        </div>

        <button
          type="button"
          className={`angle-expand-btn${expanded ? " is-open" : ""}`}
          onClick={handleExpand}
        >
          {expanded ? collapseLabel : t.expand}
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

      <div className="editorial-footer" style={{ marginTop: 18 }}>
        <div className="editorial-footer-label">{shareLabel}</div>
        <button
          type="button"
          className="editorial-share-btn"
          onClick={handleShare}
        >
          {shareState === "copied" ? t.copied : t.share}
        </button>
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
            <>
              <EditorialArticle text={article} title={card.title} lang={lang} />

              <div className="editorial-footer">
                <div className="editorial-footer-label">{shareLabel}</div>
                <button
                  type="button"
                  className="editorial-share-btn"
                  onClick={handleShare}
                >
                  {shareState === "copied" ? t.copied : t.share}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}
