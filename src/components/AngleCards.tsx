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
    o.teaser ?? o["кратко"] ?? o.description ?? o.summary ?? o.body ?? o.text ?? ""
  ).trim();
  const anchor = String(
    o.anchor ?? o["опора"] ?? o.keyword ?? o.key_phrase ?? o.quote ?? o.reference ?? ""
  ).trim();
  const why_it_matters = String(
    o.why_it_matters ?? o.whyItMatters ?? o["почему_важно"] ??
    o["почему это важно"] ?? o.significance ?? o.insight ?? o.conclusion ?? ""
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
    console.error("[AngleCards] extractJSONArray returned null. Raw preview:", raw.slice(0, 500));
    return null;
  }
  const cards = parsed.map(normalizeCard).filter((c): c is AngleCard => c !== null);
  if (cards.length === 0) {
    console.error("[AngleCards] All cards filtered out. Parsed sample:", JSON.stringify(parsed[0]));
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
    if (expanded) {
      setExpanded(false);
      // Clear error so re-expand can retry; keep article if it finished loading
      if (error) setError("");
      return;
    }
    setExpanded(true);
    if (article) return; // already fully loaded

    setLoading(true);
    setError("");
    setArticle("");

    try {
      const r = await fetch("/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          angleTitle: card.title,
          anchor: card.anchor,
          reference,
          verseText,
          lang,
          provider,
        }),
      });

      // Error responses come back as JSON
      const contentType = r.headers.get("Content-Type") ?? "";
      if (!r.ok || contentType.includes("application/json")) {
        const j = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(j?.error || t.error);
      }

      // Success: plain text stream
      const body = r.body;
      if (!body) throw new Error(t.error);

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setArticle(full);
      }

      // Flush any remaining bytes
      full += decoder.decode();
      setArticle(full);

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

          {/* "writing…" — visible only before first text chunk arrives */}
          {loading && !article && (
            <p className="expansion-writing">{t.writing}</p>
          )}

          {/* Error with implicit retry via collapse+expand */}
          {error && <div className="error">{error}</div>}

          {/* Article text — grows as stream arrives, no Share until done */}
          {article && (
            <div className="prose">
              <MarkdownText text={article} />
            </div>
          )}

          {/* Share button — appears only when loading is complete */}
          {!loading && !error && article && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleShare}
              >
                {shareState === "copied" ? t.copied : t.share}
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
