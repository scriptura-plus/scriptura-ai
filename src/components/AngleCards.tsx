"use client";

import { useEffect, useState } from "react";
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

  const [adminSecret, setAdminSecret] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura_admin_secret");
    if (saved) setAdminSecret(saved);
  }, []);

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
    setExtractMessage("");

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

  async function handleExtractPearlsFromArticle() {
    if (!adminSecret.trim()) {
      setExtractMessage("ADMIN_SECRET не найден. Открой админ-тестер один раз.");
      return;
    }

    if (!article.trim()) {
      setExtractMessage("Сначала разверни статью.");
      return;
    }

    setExtracting(true);
    setExtractMessage("Извлекаю жемчужины из статьи...");

    try {
      const response = await fetch(
        "/api/admin/extract-angle-candidates-from-article",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({
            reference,
            verseText,
            lang,
            provider,
            sourceTitle: card.title,
            sourceType: "expanded_angle_article",
            sourceLens: "angle_expand",
            sourceArticle: article,
            count: 3,
            processLimit: 3,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : "Extractor request failed.";
        throw new Error(message);
      }

      const savedCount =
        typeof data?.saved_count === "number" ? data.saved_count : 0;
      const skippedCount =
        typeof data?.skipped_count === "number" ? data.skipped_count : 0;
      const extractedCount =
        typeof data?.extracted_count === "number" ? data.extracted_count : 0;

      if (savedCount > 0) {
        setExtractMessage(
          `Найдены и сохранены новые жемчужины: ${savedCount}. Извлечено: ${extractedCount}, пропущено: ${skippedCount}.`,
        );
      } else if (extractedCount > 0) {
        setExtractMessage(
          `Новые жемчужины не сохранены: ${skippedCount} пропущено как дубли или слабые кандидаты.`,
        );
      } else {
        setExtractMessage(
          "Новых сильных жемчужин в этой статье не найдено.",
        );
      }
    } catch (e: unknown) {
      setExtractMessage(
        e instanceof Error
          ? `Ошибка extractor: ${e.message}`
          : "Ошибка extractor.",
      );
    } finally {
      setExtracting(false);
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
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleShare}
              >
                {shareState === "copied" ? t.copied : t.share}
              </button>

              {adminSecret ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleExtractPearlsFromArticle}
                  disabled={extracting}
                >
                  {extracting
                    ? "Ищу жемчужины..."
                    : "Извлечь жемчужины из статьи"}
                </button>
              ) : null}
            </div>
          )}

          {extractMessage ? (
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 13,
                color: "var(--ink-soft)",
              }}
            >
              {extractMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
