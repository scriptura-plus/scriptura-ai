"use client";

import { useState, type ReactNode } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { extractJSONObject, extractJSONArray } from "@/lib/ai/parseJSON";

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
  const parsed = extractJSONObject<NarrowPayload>(raw);

  if (
    !parsed ||
    typeof parsed.thesis !== "string" ||
    !Array.isArray(parsed.cards)
  ) {
    return null;
  }

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
}

function extractWide(raw: string): ContextCard[] | null {
  const parsed = extractJSONArray<ContextCard>(raw);
  if (!parsed) return null;

  return parsed.filter(
    (c: unknown) =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as Record<string, unknown>).title === "string" &&
      typeof (c as Record<string, unknown>).teaser === "string" &&
      typeof (c as Record<string, unknown>).shift === "string" &&
      typeof (c as Record<string, unknown>).why_it_matters === "string",
  ) as ContextCard[];
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
        .map((sentence) => sentence.trim()),
    )
    .filter((sentence) => sentence.length >= 70 && sentence.length <= 190);
}

function pickPullQuote(paragraphs: string[], title: string): string {
  const candidates = getSentenceCandidates(paragraphs.slice(1));

  const strong =
    candidates.find((sentence) =>
      /(не просто|именно|становится|превращает|показывает|открывает|меняет|контекст|сдвиг|смысл|молитв|история|сцена|логика)/i.test(
        sentence,
      ),
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
              <h4 className="editorial-subhead">
                {renderInlineText(cleaned)}
              </h4>
            ) : (
              <p className="editorial-paragraph">
                {renderInlineText(cleaned)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
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
          {t.error} (Could not parse narrow context — the AI may have returned
          non-JSON.)
        </div>
      );
    }

    return (
      <div className="angle-cards-stack">
        {payload.thesis && (
          <p
            style={{
              fontStyle: "italic",
              fontSize: "1.05rem",
              lineHeight: 1.72,
              margin: "0 0 2px",
              color: "rgba(44, 36, 27, 0.9)",
            }}
          >
            {payload.thesis}
          </p>
        )}

        {payload.cards.map((card, i) => (
          <ContextCardItem
            key={`${card.title}-${i}`}
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

  const cards = extractWide(rawText);

  if (!cards || cards.length === 0) {
    return (
      <div className="card error">
        {t.error} (Could not parse wide context — the AI may have returned
        non-JSON.)
      </div>
    );
  }

  return (
    <div className="angle-cards-stack">
      {cards.map((card, i) => (
        <ContextCardItem
          key={`${card.title}-${i}`}
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

function ContextCardItem({
  index,
  card,
  reference,
  verseText,
  lang,
  provider,
}: {
  index: number;
  card: ContextCard;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang];
  const collapseLabel = getCollapseLabel(lang);
  const shareLabel = getShareLabel(lang);

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
          anchor: card.shift,
          reference,
          verseText,
          lang,
          provider,
          sourceLens: "context",
          sourceType: "context_card_article",
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
        <div className="angle-card-index">{cardNumber}</div>

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
        <div className="angle-anchor-label">{t.shift}</div>
        <div className="angle-anchor-text">“{card.shift}”</div>
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
