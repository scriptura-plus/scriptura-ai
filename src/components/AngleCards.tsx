"use client";

import { useEffect, useMemo, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { MarkdownText } from "./MarkdownText";
import { extractJSONArray } from "@/lib/ai/parseJSON";
import ExploreMorePearlsButton from "./ExploreMorePearlsButton";

export type AngleCard = {
  id?: string;
  title: string;
  teaser: string;
  anchor: string;
  why_it_matters: string;
  score_total?: number | null;
  status?: string | null;
  coverage_type?: string | null;
};

type SavedPearlCard = {
  id: string;
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
  score_total?: number | null;
  status?: string | null;
  coverage_type?: string | null;
};

function normalizeCard(c: unknown): AngleCard | null {
  if (!c || typeof c !== "object") return null;

  const o = c as Record<string, unknown>;

  const id = String(o.id ?? "").trim();

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

  const scoreRaw = o.score_total;
  const score_total =
    typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
      ? scoreRaw
      : null;

  const status =
    typeof o.status === "string" && o.status.trim() ? o.status.trim() : null;

  const coverage_type =
    typeof o.coverage_type === "string" && o.coverage_type.trim()
      ? o.coverage_type.trim()
      : null;

  if (!title || !teaser || !anchor || !why_it_matters) return null;

  return {
    id: id || undefined,
    title,
    teaser,
    anchor,
    why_it_matters,
    score_total,
    status,
    coverage_type,
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

function getPearlsTitle(lang: Lang): string {
  if (lang === "ru") return "Жемчужины стиха";
  if (lang === "es") return "Perlas del versículo";
  return "Verse pearls";
}

function savedPearlToAngleCard(card: SavedPearlCard): AngleCard | null {
  if (!card.title || !card.teaser) return null;

  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor ?? "",
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? "",
    score_total: card.score_total ?? null,
    status: card.status ?? null,
    coverage_type: card.coverage_type ?? null,
  };
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

  const parsedCards = useMemo(() => extractCards(rawText), [rawText]);
  const [cards, setCards] = useState<AngleCard[]>(parsedCards ?? []);

  useEffect(() => {
    setCards(parsedCards ?? []);
  }, [parsedCards]);

  function handleCardsUpdated(updatedCards: SavedPearlCard[]) {
    const featuredCards = updatedCards
      .filter((card) => !card.status || card.status === "featured")
      .map(savedPearlToAngleCard)
      .filter((card): card is AngleCard => card !== null);

    if (featuredCards.length > 0) {
      setCards(featuredCards);
    }
  }

  if (!parsedCards || parsedCards.length === 0) {
    return (
      <div className="card error">
        {t.error} (Could not parse pearls — the AI may have returned non-JSON.)
      </div>
    );
  }

  return (
    <div className="lens-content-appear" style={{ display: "grid", gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="section-title">{getPearlsTitle(lang)}</h2>
        <span className="muted">
          {cards.length} {lang === "ru" ? "найдено" : lang === "es" ? "guardadas" : "found"}
        </span>
      </div>

      {cards.map((card, i) => (
        <AngleCardItem
          key={card.id ?? `${card.title}-${i}`}
          card={card}
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      ))}

      <ExploreMorePearlsButton
        reference={reference}
        verseText={verseText}
        lang={lang}
        provider={provider}
        onCardsUpdated={handleCardsUpdated}
      />
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

      <p className="angle-card-teaser">{card.teaser}</p>

      <div className="angle-why">
        <span className="angle-anchor-label">{t.whyItMatters}: </span>
        {card.why_it_matters}
      </div>

      {expanded && (
        <div className="angle-expansion">
          {loading && !article && (
            <p className="expansion-writing">{t.writing}</p>
          )}

          {error && <div className="error">{error}</div>}

          {article && (
            <div className="prose">
              <MarkdownText text={article} />
            </div>
          )}

          {!loading && !error && article && (
            <div style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-sm" onClick={handleShare}>
                {shareState === "copied" ? t.copied : t.share}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
