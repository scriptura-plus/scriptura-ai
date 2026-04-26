"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";
import { EXTRA_ORDER, type ExtraId } from "@/lib/prompts/buildExtraPrompt";
import { MarkdownText } from "./MarkdownText";
import { extractJSONObject } from "@/lib/ai/parseJSON";

type ExtraBlock = {
  title: string;
  body: string;
};

type ExtractResponse = {
  ok?: boolean;
  extracted_count?: number;
  processed_count?: number;
  saved_count?: number;
  skipped_count?: number;
  error?: string;
};

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

function extractBlocks(raw: string): ExtraBlock[] | null {
  const parsed = extractJSONObject<{ blocks: ExtraBlock[] }>(raw);

  if (!parsed || !Array.isArray(parsed.blocks)) return null;

  const blocks = parsed.blocks.filter(
    (b: unknown): b is ExtraBlock =>
      typeof b === "object" &&
      b !== null &&
      typeof (b as ExtraBlock).title === "string" &&
      typeof (b as ExtraBlock).body === "string",
  );

  return blocks.length > 0 ? blocks : null;
}

function buildArticleTextFromBlocks(blocks: ExtraBlock[]): string {
  return blocks
    .map((block) => {
      return `${block.title}\n\n${block.body}`;
    })
    .join("\n\n---\n\n");
}

function getExtractSuccessMessage(args: {
  savedCount: number;
  skippedCount: number;
  extractedCount: number;
}): string {
  if (args.savedCount > 0) {
    return `Найдены и сохранены новые жемчужины: ${args.savedCount}. Извлечено: ${args.extractedCount}, пропущено: ${args.skippedCount}.`;
  }

  if (args.extractedCount > 0) {
    return `Новые жемчужины не сохранены: ${args.skippedCount} пропущено как дубли или слабые кандидаты.`;
  }

  return "Новых сильных жемчужин в этой статье не найдено.";
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

  const [adminSecret, setAdminSecret] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura_admin_secret");
    if (saved) setAdminSecret(saved);
  }, []);

  async function load() {
    if (text || loading) return;

    setLoading(true);
    setError("");
    setExtractMessage("");

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

      const j = await r.json();

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

  async function handleExtractPearlsFromArticle() {
    if (!adminSecret.trim()) {
      setExtractMessage("ADMIN_SECRET не найден. Открой админ-тестер один раз.");
      return;
    }

    if (!text.trim()) {
      setExtractMessage("Сначала нужно загрузить статью.");
      return;
    }

    const blocks = extractBlocks(text);
    const sourceArticle = blocks ? buildArticleTextFromBlocks(blocks) : text;

    if (!sourceArticle.trim()) {
      setExtractMessage("Не удалось подготовить текст статьи для extractor.");
      return;
    }

    setExtracting(true);
    setExtractMessage("Извлекаю жемчужины из этой статьи...");

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
            sourceTitle: title,
            sourceType: "extra_analysis_article",
            sourceLens: id,
            sourceArticle,
            count: 3,
            processLimit: 3,
          }),
        },
      );

      const data = (await response.json()) as ExtractResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Extractor request failed.");
      }

      const savedCount =
        typeof data.saved_count === "number" ? data.saved_count : 0;
      const skippedCount =
        typeof data.skipped_count === "number" ? data.skipped_count : 0;
      const extractedCount =
        typeof data.extracted_count === "number" ? data.extracted_count : 0;

      setExtractMessage(
        getExtractSuccessMessage({
          savedCount,
          skippedCount,
          extractedCount,
        }),
      );
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
    <div className="card">
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
        }}
      >
        <span className="section-title">{title}</span>
        <span className="muted">{open ? T.hide : T.show}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {loading && (
            <>
              <div className="skeleton" style={{ width: "80%" }} />
              <div className="skeleton" style={{ width: "65%" }} />
            </>
          )}

          {error && <div className="error">{error}</div>}

          {!loading &&
            !error &&
            text &&
            (() => {
              const blocks = extractBlocks(text);

              if (!blocks) {
                return (
                  <div className="prose">
                    <MarkdownText text={text} />
                  </div>
                );
              }

              return (
                <div style={{ display: "grid", gap: 0 }}>
                  {blocks.map((block, i) => (
                    <div key={i}>
                      {i > 0 && (
                        <div
                          className="angle-card-divider"
                          style={{ margin: "16px 0" }}
                        />
                      )}
                      <div className="extra-block-title">{block.title}</div>
                      <p className="extra-block-body">{block.body}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

          {!loading && !error && text && adminSecret ? (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleExtractPearlsFromArticle}
                disabled={extracting}
              >
                {extracting
                  ? "Ищу жемчужины..."
                  : "Извлечь жемчужины из этой статьи"}
              </button>

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
          ) : null}
        </div>
      )}
    </div>
  );
}
