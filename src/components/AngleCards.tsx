"use client";

import { useState, type ReactNode } from "react";
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

      <p className="editorial-lead">{renderInlineText(cleanInlineMarkdown(first))}</p>

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
