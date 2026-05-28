"use client";

import { useState, type ReactNode, type TouchEvent } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { extractJSONArray } from "@/lib/ai/parseJSON";

export type WordCard = {
  title: string;
  teaser: string;
  original: string;
  gap: string;
  why_it_matters: string;
};

function normalizeCard(c: unknown): WordCard | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;

  const title = String(o.title ?? o.heading ?? o.name ?? "").trim();
  const teaser = String(o.teaser ?? o.body ?? o.text ?? o.discovery ?? "").trim();
  const original = String(
    o.original ??
      o.original_word ??
      o.greek ??
      o.hebrew ??
      o.aramaic ??
      o.form ??
      o.word_form ??
      ""
  ).trim();
  const gap = String(
    o.gap ??
      o.translation_gap ??
      o.translation_shift ??
      o.semantic_gap ??
      o.observation ??
      ""
  ).trim();
  const why_it_matters = String(
    o.why_it_matters ??
      o.whyItMatters ??
      o.why ??
      o.significance ??
      o.meaning_shift ??
      ""
  ).trim();

  if (!title || !teaser || !original || !gap || !why_it_matters) return null;

  return { title, teaser, original, gap, why_it_matters };
}

function extractCards(raw: string): WordCard[] | null {
  if (!raw || !raw.trim()) {
    console.error("[WordCards] rawText is empty");
    return null;
  }

  const parsed = extractJSONArray<unknown>(raw);
  if (!parsed) {
    console.error(
      "[WordCards] extractJSONArray returned null. Raw preview:",
      raw.slice(0, 500),
    );
    return null;
  }

  const cards = parsed
    .map(normalizeCard)
    .filter((card): card is WordCard => card !== null);

  if (cards.length === 0) {
    console.error(
      "[WordCards] All cards filtered out. Parsed sample:",
      JSON.stringify(parsed[0]),
    );
  }

  return cards;
}

function getCollapseLabel(lang: Lang): string {
  if (lang === "ru") return "Ð¡Ð²ÐµÑ€Ð½ÑƒÑ‚ÑŒ";
  if (lang === "es") return "Ocultar";
  return "Collapse";
}

function getArticleLabel(lang: Lang): string {
  if (lang === "ru") return "Ð Ð°Ð·Ð²ÐµÑ€Ð½ÑƒÑ‚Ð°Ñ Ð¼Ñ‹ÑÐ»ÑŒ";
  if (lang === "es") return "Lectura ampliada";
  return "Expanded reading";
}

function getShareLabel(lang: Lang): string {
  if (lang === "ru") return "ÐŸÐ¾Ð´ÐµÐ»Ð¸Ñ‚ÑŒÑÑ ÑÑ‚Ð¾Ð¹ Ð¼Ñ‹ÑÐ»ÑŒÑŽ";
  if (lang === "es") return "Compartir esta idea";
  return "Share this insight";
}

function getPreviousLabel(lang: Lang): string {
  if (lang === "ru") return "ÐÐ°Ð·Ð°Ð´";
  if (lang === "es") return "Anterior";
  return "Previous";
}

function getNextLabel(lang: Lang): string {
  if (lang === "ru") return "Ð”Ð°Ð»ÑŒÑˆÐµ";
  if (lang === "es") return "Siguiente";
  return "Next";
}

function getOriginalLabel(lang: Lang): string {
  if (lang === "ru") return "Ð¾Ñ€Ð¸Ð³Ð¸Ð½Ð°Ð»";
  if (lang === "es") return "original";
  return "original";
}

function getGapLabel(lang: Lang): string {
  if (lang === "ru") return "Ð§Ñ‚Ð¾ Ñ‚ÐµÑ€ÑÐµÑ‚ÑÑ";
  if (lang === "es") return "QuÃ© se pierde";
  return "What gets lost";
}

function getWhyLabel(lang: Lang): string {
  if (lang === "ru") return "ÐŸÐ¾Ñ‡ÐµÐ¼Ñƒ ÑÑ‚Ð¾ Ð²Ð°Ð¶Ð½Ð¾";
  if (lang === "es") return "Por quÃ© importa";
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
    .split(/(?<=[.!?â€¦])\s+(?=[Ð-Ð¯A-ZÐ])/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?â€¦])\s+(?=[Ð-Ð¯A-ZÐÂ«])/g)
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
    .replace(/^[-â€“â€”]\s+/g, "")
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
        .split(/(?<=[.!?â€¦])\s+/g)
        .map((sentence) => sentence.trim()),
    )
    .filter((sentence) => sentence.length >= 70 && sentence.length <= 210);
}

function pickPullQuote(paragraphs: string[], title: string): string {
  const candidates = getSentenceCandidates(paragraphs.slice(1));

  const strong =
    candidates.find((sentence) =>
      /(Ð½Ðµ Ð¿Ñ€Ð¾ÑÑ‚Ð¾|Ð¸Ð¼ÐµÐ½Ð½Ð¾|ÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑÑ|Ð¿Ñ€ÐµÐ²Ñ€Ð°Ñ‰Ð°ÐµÑ‚|Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÑ‚|Ð¾Ñ‚ÐºÑ€Ñ‹Ð²Ð°ÐµÑ‚|Ð¼ÐµÐ½ÑÐµÑ‚|Ñ†ÐµÐ½Ñ‚Ñ€|ÐºÐ»ÑŽÑ‡|ÑÐ»Ð¾Ð²Ð¾|Ð½ÑŽÐ°Ð½Ñ|ÑÐ¼Ñ‹ÑÐ»|Ñ‚ÐµÐ¿ÐµÑ€ÑŒ)/i.test(
        sentence,
      ),
    ) ?? candidates[0];

  if (strong) return strong.replace(/[.ã€‚]$/, "");

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
                <span>â€œ</span>
                {pullQuote}
                <span>â€</span>
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

export function WordCards({
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
        {t.error} (Could not parse word cards â€” the AI may have returned non-JSON.)
      </div>
    );
  }

  const cards = parsedCards;
  const safeIndex = Math.min(currentIndex, cards.length - 1);
  const currentCard = cards[safeIndex];
  const hasMultipleCards = cards.length > 1;
  const isCurrentExpanded = expandedIndex === safeIndex;

  function goPrevious() {
    if (!hasMultipleCards) return;
    setExpandedIndex(null);
    setCurrentIndex((value) => {
      const current = Math.min(value, cards.length - 1);
      return current === 0 ? cards.length - 1 : current - 1;
    });
  }

  function goNext() {
    if (!hasMultipleCards) return;
    setExpandedIndex(null);
    setCurrentIndex((value) => {
      const current = Math.min(value, cards.length - 1);
      return current === cards.length - 1 ? 0 : current + 1;
    });
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
    <div className="angle-cards-carousel word-cards-carousel">
      <style>{`
        .angle-cards-carousel {
          display: grid;
          gap: 14px;
        }

        .angle-carousel-stage {
          touch-action: pan-y;
          animation: angleCardFadeIn 180ms ease both;
        }

        .angle-carousel-stage.is-expanded {
          touch-action: auto;
        }

        @keyframes angleCardFadeIn {
          from {
            opacity: 0.82;
            transform: translateY(3px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .angle-card-premium {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(112, 91, 67, 0.15);
          border-radius: 26px;
          padding: 28px 30px 24px;
          background: rgba(255, 253, 248, 0.86);
          box-shadow:
            0 18px 44px rgba(65, 49, 32, 0.075),
            0 1px 0 rgba(255, 255, 255, 0.72) inset;
        }

        .angle-card-premium::before {
          content: "";
          position: absolute;
          left: 30px;
          right: 30px;
          top: 76px;
          height: 1px;
          background: rgba(112, 91, 67, 0.13);
          pointer-events: none;
        }

        .angle-card-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 26px;
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

        .angle-card-progress-current,
        .angle-card-progress-separator,
        .angle-card-progress-total {
          font-size: 11px;
          line-height: 1;
          font-weight: 650;
          color: rgba(65, 74, 81, 0.34);
        }

        .angle-expand-btn {
          border: 1px solid rgba(112, 91, 67, 0.16);
          border-radius: 999px;
          background: rgba(255, 253, 248, 0.72);
          color: rgba(65, 86, 105, 0.88);
          padding: 10px 17px;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: none;
          transition:
            transform 0.14s ease,
            border-color 0.14s ease,
            background 0.14s ease;
        }

        .angle-expand-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(65, 86, 105, 0.24);
          background: rgba(255, 255, 252, 0.92);
        }

        .angle-card-title {
          margin: 0;
          max-width: 760px;
          color: #2f2923;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(24px, 4.2vw, 36px);
          line-height: 1.13;
          letter-spacing: -0.026em;
          font-weight: 720;
        }

        .angle-title-rule {
          display: block;
          height: 1px;
          margin: 22px 0 18px;
          background: rgba(112, 91, 67, 0.13);
        }

        .angle-title-rule::before,
        .angle-title-rule::after {
          content: none;
        }

        .angle-card-deck {
          max-width: 690px;
          margin: 0 0 18px;
          color: rgba(67, 54, 42, 0.76);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(16px, 2vw, 19px);
          line-height: 1.52;
          font-style: italic;
        }

        .angle-anchor-box {
          display: grid;
          gap: 7px;
          margin: 18px 0 22px;
          padding: 15px 16px;
          border: 1px solid rgba(112, 91, 67, 0.14);
          border-radius: 18px;
          background: rgba(246, 240, 229, 0.48);
        }

        .angle-anchor-label {
          color: rgba(113, 84, 54, 0.68);
          font-size: 10px;
          font-weight: 760;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .angle-anchor-text {
          color: rgba(65, 54, 43, 0.78);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15.5px;
          line-height: 1.55;
          font-style: italic;
        }

        .angle-card-body {
          display: grid;
          gap: 13px;
          margin-top: 0;
        }

        .angle-card-paragraph {
          margin: 0;
          color: rgba(47, 41, 35, 0.88);
          font-size: 16.5px;
          line-height: 1.78;
          letter-spacing: -0.004em;
        }

        .angle-card-paragraph:first-child::first-letter {
          float: none;
          margin: 0;
          color: inherit;
          font: inherit;
        }

        .angle-why {
          margin-top: 22px;
          padding-top: 16px;
          border-top: 1px solid rgba(112, 91, 67, 0.12);
        }

        .angle-why + .angle-why {
          margin-top: 14px;
          padding-top: 14px;
        }

        .angle-why-label {
          display: block;
          margin-bottom: 7px;
          color: rgba(65, 86, 105, 0.82);
          font-size: 12px;
          line-height: 1;
          font-weight: 760;
        }

        .angle-why-text {
          display: block;
          color: rgba(76, 67, 58, 0.78);
          font-size: 15.5px;
          line-height: 1.68;
        }

        .editorial-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid rgba(112, 91, 67, 0.11);
        }

        .editorial-footer-label {
          color: rgba(92, 82, 72, 0.48);
          font-size: 13px;
        }

        .editorial-share-btn {
          border: 1px solid rgba(112, 91, 67, 0.14);
          border-radius: 999px;
          background: rgba(255, 253, 248, 0.72);
          color: rgba(65, 86, 105, 0.86);
          padding: 9px 16px;
          font: inherit;
          font-size: 14px;
          font-weight: 720;
          cursor: pointer;
          box-shadow: none;
        }

        .angle-expansion {
          margin-top: 24px;
          padding-top: 22px;
          border-top: 1px solid rgba(112, 91, 67, 0.13);
        }

        .angle-carousel-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
        }

        .angle-carousel-btn {
          border: 1px solid rgba(112, 91, 67, 0.13);
          border-radius: 999px;
          background: rgba(255, 253, 248, 0.62);
          color: rgba(47, 41, 35, 0.68);
          padding: 13px 16px;
          font: inherit;
          font-size: 14px;
          font-weight: 720;
          cursor: pointer;
          box-shadow: none;
          transition:
            opacity 0.14s ease,
            transform 0.14s ease,
            border-color 0.14s ease,
            background 0.14s ease;
        }

        .angle-carousel-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(112, 91, 67, 0.2);
          background: rgba(255, 253, 248, 0.86);
        }

        .angle-carousel-btn:disabled {
          opacity: 0.32;
          cursor: not-allowed;
          box-shadow: none;
        }

        .angle-carousel-btn.is-primary {
          background: rgba(47, 41, 35, 0.92);
          color: #fffaf3;
          border-color: rgba(47, 41, 35, 0.18);
          box-shadow: 0 10px 22px rgba(42, 31, 22, 0.11);
        }

        .angle-carousel-btn.is-primary:disabled {
          background: rgba(255, 253, 248, 0.62);
          color: rgba(47, 41, 35, 0.38);
          box-shadow: none;
        }

        @media (max-width: 620px) {
          .angle-card-premium {
            border-radius: 22px;
            padding: 23px 21px 21px;
          }

          .angle-card-premium::before {
            left: 21px;
            right: 21px;
            top: 70px;
          }

          .angle-card-topline {
            margin-bottom: 23px;
          }

          .angle-card-title {
            font-size: clamp(23px, 7.2vw, 31px);
            line-height: 1.14;
          }

          .angle-title-rule {
            margin: 19px 0 16px;
          }

          .angle-card-deck {
            font-size: 16px;
            line-height: 1.5;
          }

          .angle-anchor-box {
            margin: 16px 0 19px;
            padding: 14px 15px;
            border-radius: 16px;
          }

          .angle-card-paragraph {
            font-size: 16px;
            line-height: 1.72;
          }

          .angle-why-text {
            font-size: 15px;
            line-height: 1.64;
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
        <WordCardItem
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

      {hasMultipleCards && (
        <div className="angle-carousel-nav">
          <button
            type="button"
            className="angle-carousel-btn"
            onClick={goPrevious}
          >
            â† {getPreviousLabel(lang)}
          </button>

          <button
            type="button"
            className="angle-carousel-btn is-primary"
            onClick={goNext}
          >
            {getNextLabel(lang)} â†’
          </button>
        </div>
      )}
    </div>
  );
}

function WordCardItem({
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
  card: WordCard;
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
          anchor: card.original,
          reference,
          verseText,
          lang,
          provider,
          sourceLens: "word",
          sourceType: "word_card_article",
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
    const baseText =
      article ||
      [
        card.teaser,
        "",
        `${getGapLabel(lang)}: ${card.gap}`,
        "",
        `${getWhyLabel(lang)}: ${card.why_it_matters}`,
      ].join("\n");

    const shareText = `${reference} â€” ${card.title}\n\n${baseText}\n\n${t.shareFrom}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${reference} â€” ${card.title}`,
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
          <span className="angle-card-progress-separator">â€”</span>
          <span className="angle-card-progress-total">{totalNumber}</span>
        </div>
      </div>

      <h3 className="angle-card-title">{card.title}</h3>

      <div className="angle-title-rule" />

      <div className="angle-anchor-box">
        <div className="angle-anchor-label">{getOriginalLabel(lang)}</div>
        <div className="angle-anchor-text">â€œ{card.original}â€</div>
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

      <div className="angle-why">
        <span className="angle-why-label">{getGapLabel(lang)}</span>
        <span className="angle-why-text">{card.gap}</span>
      </div>

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

