"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_REQUEST = {
  reference: "Ефесянам 4:32",
  verseText:
    "А вы будьте добры друг к другу, сострадательны, великодушно прощайте друг друга, как и Бог через Христа великодушно простил вас.",
  lang: "ru",
  provider: "openai",
  targetFeaturedCount: 12,
  candidate: {
    id: "candidate_1",
    title: "Прощение здесь не бухгалтерия, а подарочная грамматика",
    anchor: "«великодушно прощайте»",
    teaser:
      "Павел выбирает не просто язык списания долга, а глагол из поля дара и благосклонности. Поэтому прощение звучит не как закрытие счёта, а как действие, которое повторяет логику незаслуженного подарка.",
    why_it_matters:
      "Так стих переносит центр тяжести с юридической отмены долга на щедрость, которую человек сам уже получил.",
  },
  featuredCards: [
    {
      id: "featured_1",
      title: "Сострадание здесь живёт не в сердце, а во внутренностях",
      anchor: "«сострадательны»",
      teaser:
        "Греческое слово связано с образом внутренностей как места глубокой реакции. Это не холодная вежливость, а телесный язык сильного внутреннего отклика.",
      why_it_matters:
        "Так доброта в стихе перестаёт быть этикетом и становится внутренним движением.",
      score_total: 88,
      status: "featured",
      is_locked: false,
    },
    {
      id: "featured_2",
      title: "Прощение здесь больше похоже на подарок, чем на расчёт",
      anchor: "«прощайте»",
      teaser:
        "Выбранный глагол связан с идеей благосклонности и дара. Поэтому Павел описывает прощение не как сухое списание, а как щедрое действие.",
      why_it_matters:
        "Это меняет интонацию стиха: прощение становится не бухгалтерским актом, а повторением полученной щедрости.",
      score_total: 76,
      status: "featured",
      is_locked: false,
    },
  ],
  reserveCards: [],
  sourceArticle: "",
};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function EvaluatorTestPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [requestText, setRequestText] = useState(formatJson(DEFAULT_REQUEST));
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);

  const parsedRequest = useMemo(() => {
    try {
      return JSON.parse(requestText);
    } catch {
      return null;
    }
  }, [requestText]);

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura_admin_secret");
    if (saved) setAdminSecret(saved);
  }, []);

  function saveSecret(value: string) {
    setAdminSecret(value);
    window.localStorage.setItem("scriptura_admin_secret", value);
  }

  async function runTest() {
    if (!parsedRequest) {
      setResultText("Invalid JSON request.");
      return;
    }

    setLoading(true);
    setResultText("");

    try {
      const response = await fetch("/api/evaluate-angle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify(parsedRequest),
      });

      const data = await response.json();

      setResultText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setResultText(
        error instanceof Error ? error.message : "Evaluator request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 18px",
        background: "#f6efe1",
        color: "#2c2418",
        fontFamily:
          'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: 32,
            marginBottom: 8,
            letterSpacing: "-0.03em",
          }}
        >
          Scriptura AI Evaluator Test
        </h1>

        <p
          style={{
            marginBottom: 24,
            color: "#6f604a",
            lineHeight: 1.5,
          }}
        >
          Temporary internal test page for the angle-card evaluator. This page
          does not change Supabase and does not modify Featured/Reserve yet.
        </p>

        <section
          style={{
            border: "1px solid rgba(80, 58, 32, 0.18)",
            borderRadius: 18,
            padding: 18,
            background: "rgba(255, 252, 245, 0.72)",
            marginBottom: 18,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#7a6a53",
              marginBottom: 8,
            }}
          >
            Admin Secret
          </label>

          <input
            value={adminSecret}
            onChange={(event) => saveSecret(event.target.value)}
            placeholder="Enter ADMIN_SECRET"
            type="password"
            style={{
              width: "100%",
              border: "1px solid rgba(80, 58, 32, 0.22)",
              borderRadius: 12,
              padding: "12px 14px",
              background: "#fffaf0",
              color: "#2c2418",
              fontSize: 15,
              boxSizing: "border-box",
            }}
          />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 18,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(80, 58, 32, 0.18)",
              borderRadius: 18,
              padding: 18,
              background: "rgba(255, 252, 245, 0.72)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  margin: 0,
                }}
              >
                Request JSON
              </h2>

              <button
                type="button"
                onClick={() => setRequestText(formatJson(DEFAULT_REQUEST))}
                style={{
                  border: "1px solid rgba(80, 58, 32, 0.18)",
                  borderRadius: 999,
                  background: "#e8dcc5",
                  padding: "8px 12px",
                  color: "#3b3021",
                  cursor: "pointer",
                }}
              >
                Reset sample
              </button>
            </div>

            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 520,
                border: "1px solid rgba(80, 58, 32, 0.18)",
                borderRadius: 14,
                padding: 14,
                background: "#fffaf0",
                color: "#2c2418",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.45,
                boxSizing: "border-box",
              }}
            />

            {!parsedRequest ? (
              <p style={{ color: "#9b3b2f", marginTop: 10 }}>
                Request JSON is invalid.
              </p>
            ) : null}

            <button
              type="button"
              disabled={loading || !adminSecret || !parsedRequest}
              onClick={runTest}
              style={{
                marginTop: 14,
                border: "none",
                borderRadius: 999,
                background:
                  loading || !adminSecret || !parsedRequest
                    ? "#c7bda9"
                    : "#5f7890",
                color: "#fff",
                padding: "12px 18px",
                cursor:
                  loading || !adminSecret || !parsedRequest
                    ? "not-allowed"
                    : "pointer",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {loading ? "Evaluating..." : "Run Evaluator"}
            </button>
          </div>

          <div
            style={{
              border: "1px solid rgba(80, 58, 32, 0.18)",
              borderRadius: 18,
              padding: 18,
              background: "rgba(255, 252, 245, 0.72)",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                marginTop: 0,
                marginBottom: 10,
              }}
            >
              Result
            </h2>

            <pre
              style={{
                minHeight: 260,
                whiteSpace: "pre-wrap",
                overflowX: "auto",
                border: "1px solid rgba(80, 58, 32, 0.18)",
                borderRadius: 14,
                padding: 14,
                background: "#fffaf0",
                color: "#2c2418",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {resultText || "No evaluation yet."}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
