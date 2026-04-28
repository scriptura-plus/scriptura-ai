"use client";

import { useState, type ReactNode } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { EXTRA_ORDER, type ExtraId } from "@/lib/prompts/buildExtraPrompt";
import { extractJSONObject } from "@/lib/ai/parseJSON";

export function ExtraAnalysis({
  reference,
  verseText,
  lang,
  provider,
}: {
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const t = dictionary[lang].extra;

  return (
    <section>
      <h2 className="h2" style={{ marginTop: 28 }}>
        {t.title}
      </h2>

      <div style={{ display: "grid", gap: 12 }}>
        {EXTRA_ORDER.map((id) => (
          <ExtraItem
            key={id}
            id={id}
            title={t[id]}
            reference={reference}
            verseText={verseText}
            lang={lang}
            provider={provider}
          />
        ))}
      </div>
    </section>
  );
}

type ExtraBlock = {
  title: string;
  body: string;
};

function getCollapseLabel(lang: Lang): string {
  if (lang === "ru") return "Скрыть";
  if (lang === "es") return "Ocultar";
  return "Hide";
}

function getArticleLabel(title: string): string {
  return title;
}

function getShareLabel(lang: Lang): string {
  if (lang === "ru") return "Поделиться исследованием";
  if (lang === "es") return "Compartir investigación";
  return "Share this research";
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:markdown|md|text|json)?\s*/i, "")
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

function pickPullQuote(paragraphs: string[], fallback: string): string {
  const candidates = getSentenceCandidates(paragraphs.slice(1));

  const strong =
    candidates.find((sentence) =>
      /(не просто|именно|становится|превращает|показывает|открывает|меняет|ключ|смысл|контекст|слово|деталь|читатель)/i.test(
        sentence,
      ),
    ) ?? candidates[0];

  if (strong) return strong.replace(/[.。]$/, "");

  return fallback;
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

function extractBlocks(raw: string): ExtraBlock[] | null {
  const parsed = extractJSONObject<{ blocks: ExtraBlock[] }>(raw);

  if (!parsed || !Array.isArray(parsed.blocks)) return null;

  const blocks = parsed.blocks.filter(
    (b: unknown) =>
      typeof b === "object" &&
      b !== null &&
      typeof (b as ExtraBlock).title === "string" &&
      typeof (b as ExtraBlock).body === "string",
  );

  return blocks.length > 0 ? blocks : null;
}

function blocksToText(blocks: ExtraBlock[]): string {
  return blocks.map((block) => `${block.title}\n\n${block.body}`).join("\n\n");
}

function EditorialArticleFromText({
  text,
  fallbackTitle,
  kicker,
}: {
  text: string;
  fallbackTitle: string;
  kicker: string;
}) {
  const paragraphs = splitArticleParagraphs(text);

  if (paragraphs.length === 0) return null;

  const first = paragraphs[0];
  const rest = paragraphs.slice(1);
  const pullQuote = pickPullQuote(paragraphs, fallbackTitle);

  return (
    <div className="editorial-article">
      <div className="editorial-kicker">{kicker}</div>

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

function EditorialArticleFromBlocks({
  blocks,
  kicker,
}: {
  blocks: ExtraBlock[];
  kicker: string;
}) {
  const firstBlock = blocks[0];
  const restBlocks = blocks.slice(1);

  if (!firstBlock) return null;

  const firstParagraphs = splitArticleParagraphs(firstBlock.body);
  const firstLead = firstParagraphs[0] ?? firstBlock.body;
  const firstRest = firstParagraphs.slice(1);
  const allParagraphs = blocks.flatMap((block) =>
    splitArticleParagraphs(block.body),
  );
  const pullQuote = pickPullQuote(allParagraphs, firstBlock.title);

  return (
    <div className="editorial-article">
      <div className="editorial-kicker">{kicker}</div>

      <h4
        className="editorial-subhead"
        style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}
      >
        {firstBlock.title}
      </h4>

      <p className="editorial-lead">
        {renderInlineText(cleanInlineMarkdown(firstLead))}
      </p>

      {firstRest.map((paragraph, index) => (
        <p key={`first-${index}`} className="editorial-paragraph">
          {renderInlineText(cleanInlineMarkdown(paragraph))}
        </p>
      ))}

      {restBlocks.map((block, blockIndex) => {
        const paragraphs = splitArticleParagraphs(block.body);
        const shouldInsertPullQuote = blockIndex === 0 && pullQuote;

        return (
          <div key={`${block.title}-${blockIndex}`}>
            {shouldInsertPullQuote && (
              <aside className="editorial-pullquote">
                <span>“</span>
                {pullQuote}
                <span>”</span>
              </aside>
            )}

            <div className="editorial-divider" />

            <h4 className="editorial-subhead">{block.title}</h4>

            {paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={`${block.title}-${paragraphIndex}`}
                className="editorial-paragraph"
              >
                {renderInlineText(cleanInlineMarkdown(paragraph))}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ExtraItem({
  id,
  title,
  reference,
  verseText,
  lang,
  provider,
}: {
  id: ExtraId;
  title: string;
  reference: string;
  verseText: string;
  lang: Lang;
  provider: Provider;
}) {
  const T = dictionary[lang];

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareNotice, setShareNotice] = useState("");

  const articleLabel = getArticleLabel(title);
  const shareLabel = getShareLabel(lang);
  const collapseLabel = getCollapseLabel(lang);

  function buildShareText(raw: string): string {
    const blocks = extractBlocks(raw);

    const body = blocks ? blocksToText(blocks) : raw;

    return `${reference}\n${title}\n\n${body}\n\n${T.shareFrom}`;
  }

  async function shareAnalysis() {
    if (!text) return;

    const shareText = buildShareText(text);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${reference} — ${title}`,
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setShareNotice(T.copied);
      window.setTimeout(() => setShareNotice(""), 2500);
    } catch {
      setShareNotice("");
    }
  }

  async function load() {
    if (text || loading) return;

    setLoading(true);
    setError("");

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "extra",
          id,
          reference,
          verseText,
          lang,
          provider,
        }),
      });

      const j = (await r.json()) as { text?: string; error?: string };

      if (!r.ok) throw new Error(j?.error || T.error);

      setText(j.text ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : T.error);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);

    if (next) void load();
  }

  const blocks = text ? extractBlocks(text) : null;

  return (
    <article className={`angle-card angle-card-premium${open ? " is-expanded" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--ink)",
          fontFamily: "inherit",
          textAlign: "left",
          gap: 16,
        }}
      >
        <span className="angle-card-title" style={{ margin: 0 }}>
          {title}
        </span>

        <span className={`angle-expand-btn${open ? " is-open" : ""}`}>
          {open ? collapseLabel : T.show}
        </span>
      </button>

      {open && (
        <div className="angle-expansion">
          {loading && (
            <div className="angle-expansion-loading">
              <p className="expansion-writing">{T.writing}</p>
              <div className="lens-skeleton-bar" style={{ width: "92%" }} />
              <div className="lens-skeleton-bar" style={{ width: "86%" }} />
              <div className="lens-skeleton-bar" style={{ width: "78%" }} />
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {!loading && !error && text ? (
            <>
              {blocks ? (
                <EditorialArticleFromBlocks
                  blocks={blocks}
                  kicker={articleLabel}
                />
              ) : (
                <EditorialArticleFromText
                  text={text}
                  fallbackTitle={title}
                  kicker={articleLabel}
                />
              )}

              <div className="editorial-footer">
                <div className="editorial-footer-label">{shareLabel}</div>

                <button
                  type="button"
                  onClick={shareAnalysis}
                  className="editorial-share-btn"
                >
                  {shareNotice || T.share}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </article>
  );
}
