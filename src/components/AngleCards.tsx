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
      o.anchorQuote ??
      o.keyword ??
      o.key_phrase ??
      o.quote ??
      o.reference ??
      ""
  ).trim();

  const why_it_matters = String(
    o.why_it_matters ??
      o.whyItMatters ??
      o.whyMatters ??
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

function getAnchorLabel(lang: Lang): string {
  if (lang === "ru") return "опора";
  if (lang === "es") return "apoyo";
  return "anchor";
}

function getThesisLabel(lang: Lang): string {
  if (lang === "ru") return "главная мысль";
  if (lang === "es") return "idea central";
  return "central thought";
}

function getWhyLabel(lang: Lang): string {
  if (lang === "ru") return "Почему это важно";
  if (lang === "es") return "Por qué importa";
  return "Why it matters";
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
    .split(/(?<=[.!?…])\s+(?=[А-ЯA-ZЁ])/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=[А-ЯA-ZЁ«])/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitReadingParagraphs(text: string): string[] {
  const normalized = normalizeArticleText(text);

  const explicitParagraphs = normalized
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (explicitParagraphs.length > 1) return explicitParagraphs;

  const sentences = splitSentences(normalized);
  if (sentences.length <= 3) return [normalized];

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  sentences.forEach((sentence, index) => {
    current.push(sentence);
    currentLength += sentence.length;

    const isLast = index === sentences.length - 1;
    const shouldBreak =
      !isLast &&
      (current.length >= 2 || currentLength >= 260) &&
      paragraphs.length < 2;

    if (shouldBreak) {
      paragraphs.push(current.join(" "));
      current = [];
      currentLength = 0;
    }
  });

  if (current.length > 0) paragraphs.push(current.join(" "));

  return paragraphs.length > 0 ? paragraphs : [normalized];
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
        .split(/(?<=[.!?…])\s+/g)
        .map((sentence) => sentence.trim())
    )
    .filter((sentence) => sentence.length >= 70 && sentence.length <= 210);
}

function pickPullQuote(paragraphs: string[], title: string): string {
  const candidates = getSentenceCandidates(paragraphs.slice(1));

  const strong =
    candidates.find((sentence) =>
      /(не просто|именно|становится|превращает|показывает|открывает|меняет|центр|ключ|пауза|вдруг|теперь)/i.test(
        sentence
      )
    ) ?? candidates[0];

  if (strong) return strong.replace(/[.。]$/, "");

  return title;
}

function pickCardThesis(card: AngleCard): string {
  const fromWhy = splitSentences(card.why_it_matters).find(
    (sentence) => sentence.length >= 55 && sentence.length <= 190
  );

  if (fromWhy) return fromWhy.replace(/[.。]$/, "");

  const fromTeaser = splitSentences(card.teaser).find(
    (sentence) => sentence.length >= 70 && sentence.length <= 190
  );

  if (fromTeaser) return fromTeaser.replace(/[.。]$/, "");

  return card.title;
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
          gap: 14px;
        }

        .angle-carousel-stage {
          touch-action: pan-y;
          animation: angleCardFadeIn 240ms ease both;
        }

        .angle-carousel-stage.is-expanded {
          touch-action: auto;
        }

        @keyframes angleCardFadeIn {
          from {
            opacity: 0.72;
            transform: translateY(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .angle-card-premium {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(138, 90, 43, 0.16);
          border-radius: 30px;
          padding: 30px 30px 26px;
          background:
            radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.88), transparent 38%),
            linear-gradient(180deg, rgba(255, 253, 248, 0.94) 0%, rgba(250, 244, 233, 0.92) 100%);
          box-shadow:
            0 28px 70px rgba(83, 58, 32, 0.10),
            0 1px 0 rgba(255, 255, 255, 0.8) inset;
        }

        .angle-card-premium::before {
          content: "";
          position: absolute;
          left: 30px;
          right: 30px;
          top: 83px;
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(138, 90, 43, 0.22),
            rgba(138, 90, 43, 0.055),
            rgba(138, 90, 43, 0)
          );
          pointer-events: none;
        }

        .angle-card-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 28px;
        }

        .angle-card-progress {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          padding: 0;
          border: 0;
          background: transparent;
          box-shadow: none;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .angle-card-progress-current {
          font-size: 11px;
          line-height: 1;
          font-weight: 760;
          color: rgba(65, 74, 81, 0.44);
        }

        .angle-card-progress-separator {
          font-size: 11px;
          line-height: 1;
          font-weight: 500;
          color: rgba(138, 90, 43, 0.34);
        }

        .angle-card-progress-total {
          font-size: 11px;
          line-height: 1;
          font-weight: 650;
          color: rgba(65, 74, 81, 0.38);
        }

        .angle-expand-btn {
          border: 1px solid rgba(138, 90, 43, 0.22);
          border-radius: 999px;
          background: rgba(255, 252, 246, 0.72);
          color: rgba(68, 90, 110, 0.92);
          padding: 11px 18px;
          font: inherit;
          font-size: 14px;
          font-weight: 760;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(42, 31, 22, 0.045);
          transition:
            transform 0.14s ease,
            box-shadow 0.14s ease,
            background 0.14s ease;
        }

        .angle-expand-btn:hover {
          transform: translateY(-1px);
          background: rgba(255, 253, 250, 0.94);
          box-shadow: 0 10px 22px rgba(42, 31, 22, 0.075);
        }

        .angle-card-title {
          margin: 0;
          max-width: 760px;
          color: #2d251e;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(26px, 4.8vw, 42px);
          line-height: 1.06;
          letter-spacing: -0.035em;
          font-weight: 760;
        }

        .angle-title-rule {
          display: grid;
          grid-template-columns: 78px 1fr;
          align-items: center;
          gap: 14px;
          margin: 24px 0 18px;
        }

        .angle-title-rule::before,
        .angle-title-rule::after {
          content: "";
          height: 1px;
          background: rgba(138, 90, 43, 0.22);
        }

        .angle-card-deck {
          max-width: 690px;
          margin: 0 0 20px;
          color: rgba(67, 54, 42, 0.82);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(17px, 2.2vw, 22px);
          line-height: 1.46;
          font-style: italic;
        }

        .angle-anchor-box {
          display: grid;
          gap: 8px;
          margin: 20px 0 24px;
          padding: 17px 18px;
          border: 1px solid rgba(190, 147, 91, 0.26);
          border-radius: 20px;
          background:
            linear-gradient(180deg, rgba(255, 251, 244, 0.72), rgba(247, 238, 224, 0.56));
        }

        .angle-anchor-label {
          color: rgba(150, 95, 43, 0.82);
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .angle-anchor-text {
          color: rgba(65, 54, 43, 0.82);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
          line-height: 1.55;
          font-style: italic;
        }

        .angle-card-body {
          display: grid;
          gap: 13px;
          margin-top: 2px;
        }

        .angle-card-paragraph {
          margin: 0;
          color: rgba(47, 41, 35, 0.89);
          font-size: 17px;
          line-height: 1.86;
          letter-spacing: -0.006em;
        }

        .angle-card-paragraph:first-child::first-letter {
          float: left;
          margin: 8px 9px 0 0;
          color: rgba(120, 80, 42, 0.62);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 52px;
          line-height: 0.78;
          font-weight: 720;
        }

        .angle-thesis {
          position: relative;
          margin: 26px 0 22px;
          padding: 22px 24px 22px 27px;
          border-left: 3px solid rgba(138, 90, 43, 0.44);
          background:
            linear-gradient(90deg, rgba(145, 102, 54, 0.085), rgba(255, 253, 248, 0));
        }

        .angle-thesis-label {
          display: block;
          margin-bottom: 8px;
          color: rgba(150, 95, 43, 0.82);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .angle-thesis-text {
          margin: 0;
          max-width: 680px;
          color: rgba(42, 34, 28, 0.9);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(19px, 2.6vw, 27px);
          line-height: 1.34;
          letter-spacing: -0.018em;
        }

        .angle-why {
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px solid rgba(138, 90, 43, 0.18);
        }

        .angle-why-label {
          display: block;
          margin-bottom: 7px;
          color: rgba(69, 103, 132, 0.92);
          font-size: 13px;
          line-height: 1;
          font-weight: 850;
        }

        .angle-why-text {
          display: block;
          color: rgba(76, 67, 58, 0.82);
          font-size: 16px;
          line-height: 1.74;
        }

        .editorial-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px solid rgba(138, 90, 43, 0.14);
        }

        .editorial-footer-label {
          color: rgba(92, 82, 72, 0.58);
          font-size: 13px;
        }

        .editorial-share-btn {
          border: 1px solid rgba(138, 90, 43, 0.20);
          border-radius: 999px;
          background: rgba(255, 253, 250, 0.78);
          color: rgba(69, 103, 132, 0.95);
          padding: 10px 18px;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(42, 31, 22, 0.035);
        }

        .angle-expansion {
          margin-top: 26px;
          padding-top: 24px;
          border-top: 1px solid rgba(138, 90, 43, 0.16);
        }

        .angle-carousel-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
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

        @media (max-width: 620px) {
          .angle-card-premium {
            border-radius: 24px;
            padding: 24px 22px 22px;
          }

          .angle-card-premium::before {
            left: 22px;
            right: 22px;
            top: 76px;
          }

          .angle-card-topline {
            margin-bottom: 24px;
          }

          .angle-title-rule {
            grid-template-columns: 48px 1fr;
            margin: 20px 0 15px;
          }

          .angle-card-deck {
            font-size: 17px;
            line-height: 1.5;
          }

          .angle-anchor-box {
            margin: 17px 0 20px;
            padding: 15px 16px;
            border-radius: 18px;
          }

          .angle-card-paragraph {
            font-size: 16px;
            line-height: 1.78;
          }

          .angle-card-paragraph:first-child::first-letter {
            font-size: 43px;
            margin-top: 7px;
          }

          .angle-thesis {
            margin: 22px 0 19px;
            padding: 18px 18px 18px 20px;
          }

          .angle-thesis-text {
            font-size: 20px;
            line-height: 1.36;
          }

          .angle-why-text {
            font-size: 15px;
            line-height: 1.68;
          }

          .angle-carousel-nav {
            gap: 9px;
          }

          .angle-carousel-btn {
            padding: 12px 13px;
            font-size: 13px;
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
  const thesis = pickCardThesis(card);
  const bodyParagraphs = splitReadingParagraphs(card.teaser);

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

      <div className="angle-title-rule" />

      <p className="angle-card-deck">{thesis}</p>

      <div className="angle-anchor-box">
        <div className="angle-anchor-label">{getAnchorLabel(lang)}</div>
        <div className="angle-anchor-text">“{card.anchor}”</div>
      </div>

      <div className="angle-card-body">
        {bodyParagraphs.map((paragraph, paragraphIndex) => (
          <p
            className="angle-card-paragraph"
            key={`${paragraph.slice(0, 28)}-${paragraphIndex}`}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <aside className="angle-thesis">
        <span className="angle-thesis-label">{getThesisLabel(lang)}</span>
        <p className="angle-thesis-text">{thesis}</p>
      </aside>

      <div className="angle-why">
        <span className="angle-why-label">{getWhyLabel(lang)}</span>
        <span className="angle-why-text">{card.why_it_matters}</span>
      </div>

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
