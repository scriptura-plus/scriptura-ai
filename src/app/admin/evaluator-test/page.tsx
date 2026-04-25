"use client";

import { useEffect, useMemo, useState } from "react";

const DUPLICATE_ANGLE_REQUEST = {
  reference: "Ефесянам 4:32",
  verseText:
    "А вы будьте добры друг к другу, сострадательны, великодушно прощайте друг друга, как и Бог через Христа великодушно простил вас.",
  lang: "ru",
  provider: "openai",
  targetFeaturedCount: 12,
  candidate: {
    id: "candidate_duplicate_angle",
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

const NEW_ANGLE_REQUEST = {
  ...DUPLICATE_ANGLE_REQUEST,
  candidate: {
    id: "candidate_new_angle",
    title: "«Во Христе» звучит как место, а не как инструмент",
    anchor: "«как и Бог через Христа простил вас»",
    teaser:
      "Фраза не просто говорит, что Бог простил через Христа как через средство. Она помещает Божий акт прощения внутрь определённой сферы: прощение имеет пространство, в котором оно стало возможным и образцовым.",
    why_it_matters:
      "Так сравнение работает не как голый пример для копирования, а как указание на уже заданную реальность, внутри которой люди обращаются друг с другом.",
  },
};

const WEAK_GENERIC_REQUEST = {
  ...DUPLICATE_ANGLE_REQUEST,
  candidate: {
    id: "candidate_weak_generic",
    title: "Нужно быть добрыми и прощать других",
    anchor: "«будьте добры»",
    teaser:
      "Этот стих показывает, что христиане должны быть добрыми, сострадательными и прощать других людей.",
    why_it_matters:
      "Это важно, потому что доброта и прощение помогают сохранять мирные отношения.",
  },
};

type RequestShape = typeof DUPLICATE_ANGLE_REQUEST;

type EvaluationResponse = {
  status: number;
  ok: boolean;
  data?: {
    evaluation?: unknown;
    raw?: string;
    error?: string;
  };
};

type RewriteResponse = {
  status: number;
  ok: boolean;
  data?: {
    rewritten?: {
      card?: unknown;
      rewrite_notes?: string;
    };
    raw?: string;
    error?: string;
  };
};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const child = value[key];
  return isRecord(child) ? child : null;
}

export default function EvaluatorTestPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [requestText, setRequestText] = useState(
    formatJson(DUPLICATE_ANGLE_REQUEST),
  );

  const [resultText, setResultText] = useState("");
  const [rewriteText, setRewriteText] = useState("");
  const [reevaluationText, setReevaluationText] = useState("");
  const [saveText, setSaveText] = useState("");
  const [readText, setReadText] = useState("");

  const [loading, setLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [reevaluating, setReevaluating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);

  const parsedRequest = useMemo(() => {
    try {
      return JSON.parse(requestText) as RequestShape;
    } catch {
      return null;
    }
  }, [requestText]);

  const parsedEvaluationResult = useMemo(() => {
    if (!resultText) return null;

    try {
      return JSON.parse(resultText) as EvaluationResponse;
    } catch {
      return null;
    }
  }, [resultText]);

  const parsedRewriteResult = useMemo(() => {
    if (!rewriteText) return null;

    try {
      return JSON.parse(rewriteText) as RewriteResponse;
    } catch {
      return null;
    }
  }, [rewriteText]);

  const parsedReevaluationResult = useMemo(() => {
    if (!reevaluationText) return null;

    try {
      return JSON.parse(reevaluationText) as EvaluationResponse;
    } catch {
      return null;
    }
  }, [reevaluationText]);

  const lastEvaluation = parsedEvaluationResult?.data?.evaluation ?? null;
  const lastRewrittenCard =
    getNestedRecord(parsedRewriteResult?.data?.rewritten, "card") ?? null;
  const lastReevaluation = parsedReevaluationResult?.data?.evaluation ?? null;

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura_admin_secret");
    if (saved) setAdminSecret(saved);
  }, []);

  function saveSecret(value: string) {
    setAdminSecret(value);
    window.localStorage.setItem("scriptura_admin_secret", value);
  }

  function loadPreset(value: unknown) {
    setRequestText(formatJson(value));
    setResultText("");
    setRewriteText("");
    setReevaluationText("");
    setSaveText("");
    setReadText("");
  }

  async function runEvaluator() {
    if (!parsedRequest) {
      setResultText("Invalid JSON request.");
      return;
    }

    setLoading(true);
    setResultText("");
    setRewriteText("");
    setReevaluationText("");
    setSaveText("");
    setReadText("");

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

  async function runRewrite() {
    if (!parsedRequest || !lastEvaluation) {
      setRewriteText("Run evaluator first. Rewrite needs evaluation output.");
      return;
    }

    setRewriting(true);
    setRewriteText("");
    setReevaluationText("");
    setSaveText("");
    setReadText("");

    try {
      const response = await fetch("/api/rewrite-angle-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: parsedRequest.reference,
          verseText: parsedRequest.verseText,
          lang: parsedRequest.lang,
          provider: parsedRequest.provider,
          candidate: parsedRequest.candidate,
          evaluation: lastEvaluation,
          sourceArticle: parsedRequest.sourceArticle ?? "",
        }),
      });

      const data = await response.json();

      setRewriteText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setRewriteText(
        error instanceof Error ? error.message : "Rewrite request failed.",
      );
    } finally {
      setRewriting(false);
    }
  }

  async function runReevaluateRewritten() {
    if (!parsedRequest || !lastRewrittenCard) {
      setReevaluationText(
        "Run rewrite first. Re-evaluation needs rewritten card.",
      );
      return;
    }

    setReevaluating(true);
    setReevaluationText("");
    setSaveText("");
    setReadText("");

    try {
      const response = await fetch("/api/evaluate-angle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          ...parsedRequest,
          candidate: {
            ...lastRewrittenCard,
            id: "rewritten_candidate",
          },
        }),
      });

      const data = await response.json();

      setReevaluationText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setReevaluationText(
        error instanceof Error
          ? error.message
          : "Re-evaluation request failed.",
      );
    } finally {
      setReevaluating(false);
    }
  }

  async function runSaveRewrittenCard() {
    if (!parsedRequest || !lastRewrittenCard || !lastReevaluation) {
      setSaveText(
        "Run evaluator, rewrite, and re-evaluate first. Save needs rewritten card + final evaluation.",
      );
      return;
    }

    setSaving(true);
    setSaveText("");
    setReadText("");

    try {
      const response = await fetch("/api/admin/save-angle-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: parsedRequest.reference,
          lang: parsedRequest.lang,
          card: lastRewrittenCard,
          evaluation: lastReevaluation,
          original_card: parsedRequest.candidate,
          source_type: "manual_test_rewrite",
          source_provider: parsedRequest.provider,
          source_model: "unknown",
        }),
      });

      const data = await response.json();

      setSaveText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setSaveText(
        error instanceof Error ? error.message : "Save request failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runReadSavedCards() {
    if (!parsedRequest) {
      setReadText("Invalid JSON request.");
      return;
    }

    setReading(true);
    setReadText("");

    try {
      const params = new URLSearchParams({
        reference: parsedRequest.reference,
        lang: parsedRequest.lang,
        statuses: "featured,reserve",
        limit: "24",
      });

      const response = await fetch(`/api/admin/angle-cards?${params}`, {
        method: "GET",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });

      const data = await response.json();

      setReadText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setReadText(
        error instanceof Error ? error.message : "Read request failed.",
      );
    } finally {
      setReading(false);
    }
  }

  const buttonBaseStyle = {
    border: "1px solid rgba(80, 58, 32, 0.18)",
    borderRadius: 999,
    background: "#e8dcc5",
    padding: "10px 14px",
    color: "#3b3021",
    cursor: "pointer",
    fontWeight: 600,
  } as const;

  const primaryButtonStyle = {
    border: "none",
    borderRadius: 999,
    background: "#5f7890",
    color: "#fff",
    padding: "12px 18px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
  } as const;

  const disabledButtonStyle = {
    ...primaryButtonStyle,
    background: "#c7bda9",
    cursor: "not-allowed",
  } as const;

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
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 32,
            marginBottom: 8,
            letterSpacing: "-0.03em",
          }}
        >
          Scriptura AI Evaluator Test
        </h1>

        <p style={{ marginBottom: 24, color: "#6f604a", lineHeight: 1.5 }}>
          Temporary internal test page for evaluator, rewrite, re-evaluation,
          saving, and reading angle cards from Supabase.
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
            border: "1px solid rgba(80, 58, 32, 0.18)",
            borderRadius: 18,
            padding: 18,
            background: "rgba(255, 252, 245, 0.72)",
            marginBottom: 18,
          }}
        >
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>
            Preset Tests
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => loadPreset(DUPLICATE_ANGLE_REQUEST)}
              style={buttonBaseStyle}
            >
              Test duplicate angle
            </button>

            <button
              type="button"
              onClick={() => loadPreset(NEW_ANGLE_REQUEST)}
              style={buttonBaseStyle}
            >
              Test new angle
            </button>

            <button
              type="button"
              onClick={() => loadPreset(WEAK_GENERIC_REQUEST)}
              style={buttonBaseStyle}
            >
              Test weak generic card
            </button>
          </div>
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
              <h2 style={{ fontSize: 18, margin: 0 }}>Request JSON</h2>

              <button
                type="button"
                onClick={() => loadPreset(DUPLICATE_ANGLE_REQUEST)}
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

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                disabled={loading || !adminSecret || !parsedRequest}
                onClick={runEvaluator}
                style={
                  loading || !adminSecret || !parsedRequest
                    ? disabledButtonStyle
                    : primaryButtonStyle
                }
              >
                {loading ? "Evaluating..." : "1. Run Evaluator"}
              </button>

              <button
                type="button"
                disabled={rewriting || !adminSecret || !lastEvaluation}
                onClick={runRewrite}
                style={
                  rewriting || !adminSecret || !lastEvaluation
                    ? disabledButtonStyle
                    : primaryButtonStyle
                }
              >
                {rewriting ? "Rewriting..." : "2. Rewrite Last Candidate"}
              </button>

              <button
                type="button"
                disabled={reevaluating || !adminSecret || !lastRewrittenCard}
                onClick={runReevaluateRewritten}
                style={
                  reevaluating || !adminSecret || !lastRewrittenCard
                    ? disabledButtonStyle
                    : primaryButtonStyle
                }
              >
                {reevaluating
                  ? "Re-evaluating..."
                  : "3. Evaluate Rewritten Card"}
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  !adminSecret ||
                  !lastRewrittenCard ||
                  !lastReevaluation
                }
                onClick={runSaveRewrittenCard}
                style={
                  saving ||
                  !adminSecret ||
                  !lastRewrittenCard ||
                  !lastReevaluation
                    ? disabledButtonStyle
                    : primaryButtonStyle
                }
              >
                {saving ? "Saving..." : "4. Save Rewritten Card"}
              </button>

              <button
                type="button"
                disabled={reading || !adminSecret || !parsedRequest}
                onClick={runReadSavedCards}
                style={
                  reading || !adminSecret || !parsedRequest
                    ? disabledButtonStyle
                    : primaryButtonStyle
                }
              >
                {reading ? "Reading..." : "5. Read Saved Cards"}
              </button>
            </div>
          </div>

          <ResultBlock title="Evaluation Result" text={resultText} />

          <ResultBlock title="Rewrite Result" text={rewriteText} />

          <ResultBlock
            title="Re-evaluation Result"
            text={reevaluationText}
          />

          <ResultBlock title="Save Result" text={saveText} />

          <ResultBlock title="Saved Cards Result" text={readText} />
        </section>
      </div>
    </main>
  );
}

function ResultBlock({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(80, 58, 32, 0.18)",
        borderRadius: 18,
        padding: 18,
        background: "rgba(255, 252, 245, 0.72)",
      }}
    >
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 10 }}>{title}</h2>

      <pre
        style={{
          minHeight: 220,
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
        {text || "No result yet."}
      </pre>
    </div>
  );
}
