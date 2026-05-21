"use client";

import { useMemo, useState } from "react";

type ApiResult = Record<string, unknown>;

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

export default function PearlV3TestPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [reference, setReference] = useState("John 17:3");
  const [lang, setLang] = useState<"ru" | "en" | "es">("ru");
  const [provider, setProvider] = useState<"claude" | "openai" | "gemini">(
    "claude",
  );
  const [writeLimit, setWriteLimit] = useState("1");
  const [targetCount, setTargetCount] = useState("1");
  const [minScore, setMinScore] = useState("70");
  const [includeRaw, setIncludeRaw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
const cards = useMemo(() => {
  const scoredCards = getArray(result?.scoredCards);
  if (scoredCards.length > 0) return scoredCards;
  return getArray(result?.cards);
}, [result]);
  
  const angles = useMemo(() => getArray(result?.angles), [result]);

  async function runTest() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/pearl-v3/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret.trim()
            ? { "x-admin-secret": adminSecret.trim() }
            : {}),
        },
        body: JSON.stringify({
          reference,
          lang,
          provider,
          writeLimit: Number(writeLimit),
          targetCount: Number(targetCount),
          minScore: Number(minScore),
          includeRaw,
        }),
      });

      const data = (await response.json()) as ApiResult;

      if (!response.ok) {
        throw new Error(getString(data.error) || `HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.kicker}>Scriptura AI internal test</p>
        <h1 style={styles.title}>Pearl v3 Test Panel</h1>
        <p style={styles.subtitle}>
          Isolated test page for Detector → Writer → Scorer. This does not
          change the public Pearl UI.
        </p>
      </section>

      <section style={styles.panel}>
        <label style={styles.label}>
          Admin Secret
          <input
            style={styles.input}
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            placeholder="Required on Vercel preview/production"
            type="password"
          />
        </label>

        <div style={styles.grid}>
          <label style={styles.label}>
            Reference
            <input
              style={styles.input}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="John 17:3"
            />
          </label>

          <label style={styles.label}>
            Language
            <select
              style={styles.input}
              value={lang}
              onChange={(event) => setLang(event.target.value as "ru" | "en" | "es")}
            >
              <option value="ru">Russian</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </label>

          <label style={styles.label}>
            Provider
            <select
              style={styles.input}
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as "claude" | "openai" | "gemini")
              }
            >
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>

          <label style={styles.label}>
            writeLimit
            <input
              style={styles.input}
              value={writeLimit}
              onChange={(event) => setWriteLimit(event.target.value)}
              inputMode="numeric"
            />
          </label>

          <label style={styles.label}>
            targetCount
            <input
              style={styles.input}
              value={targetCount}
              onChange={(event) => setTargetCount(event.target.value)}
              inputMode="numeric"
            />
          </label>

          <label style={styles.label}>
            minScore
            <input
              style={styles.input}
              value={minScore}
              onChange={(event) => setMinScore(event.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={includeRaw}
            onChange={(event) => setIncludeRaw(event.target.checked)}
          />
          Include raw model outputs
        </label>

        <button style={styles.button} onClick={runTest} disabled={loading}>
          {loading ? "Running Pearl v3..." : "Run Pearl v3"}
        </button>

        {error && <div style={styles.error}>{error}</div>}
      </section>

      {result && (
        <section style={styles.results}>
          <div style={styles.metaGrid}>
            <Meta label="OK" value={String(Boolean(result.ok))} />
            <Meta label="Model" value={getString(result.model)} />
            <Meta label="Reference" value={getString(result.reference)} />
            <Meta label="Canonical" value={getString(result.canonicalRef)} />
            <Meta
              label="Lexicon"
              value={String(Boolean(result.lexiconAvailable))}
            />
          </div>

          <h2 style={styles.sectionTitle}>Cards</h2>

          {cards.length === 0 ? (
            <p style={styles.muted}>No cards returned.</p>
          ) : (
            <div style={styles.cardList}>
              {cards.map((item, index) => {
                
                const wrapper = getObject(item);
const nestedCard = getObject(wrapper?.card);
const scoreObject = getObject(wrapper?.score);

const card = nestedCard ?? wrapper;

const score = getNumber(
  scoreObject?.score ??
    wrapper?.score_total ??
    wrapper?.score ??
    card?.score_total,
);

const title = getString(card?.title);
const anchor = getString(card?.anchor ?? card?.anchorQuote);
const teaser = getString(card?.teaser ?? card?.body);
const why = getString(card?.why_it_matters ?? card?.whyMatters);

const suggestedStatus = getString(wrapper?.suggestedStatus);
const claimType = getString(scoreObject?.claimType);
const weaknessRoot = getString(scoreObject?.weaknessRoot);
const weaknessDetail = getString(scoreObject?.weaknessDetail);
const reasoning = getString(scoreObject?.reasoning);
                return (
                  <article key={index} style={styles.card}>
                    <div style={styles.cardTopline}>
                      <span>Card {index + 1}</span>
                      {score !== null && <strong>Score: {score}</strong>}
                    </div><div style={styles.scoreRow}>
  {suggestedStatus && <span>Status: {suggestedStatus}</span>}
  {claimType && <span>Claim: {claimType}</span>}
  {weaknessRoot && <span>Weakness: {weaknessRoot}</span>}
</div>

                    <h3 style={styles.cardTitle}>{title || "Untitled"}</h3>

                    {anchor && (
                      <div style={styles.anchor}>
                        <span style={styles.anchorLabel}>Anchor</span>
                        <p>{anchor}</p>
                      </div>
                    )}

                    {teaser && <p style={styles.body}>{teaser}</p>}

                    {why && (
                      <p style={styles.why}>
                        <strong>Why it matters: </strong>
                        {why}
                      </p>
                    )}{reasoning && (
  <p style={styles.reasoning}>
    <strong>Scorer reasoning: </strong>
    {reasoning}
  </p>
)}

{weaknessDetail && (
  <p style={styles.weakness}>
    <strong>Weakness detail: </strong>
    {weaknessDetail}
  </p>
)}
                  </article>
                );
              })}
            </div>
          )}

          <h2 style={styles.sectionTitle}>Detected Angles</h2>

          <details style={styles.details}>
            <summary>Show angles ({angles.length})</summary>
            <pre style={styles.pre}>{JSON.stringify(angles, null, 2)}</pre>
          </details>

          <h2 style={styles.sectionTitle}>Full JSON</h2>

          <details style={styles.details}>
            <summary>Show full response</summary>
            <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.meta}>
      <span style={styles.metaLabel}>{label}</span>
      <strong style={styles.metaValue}>{value || "—"}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "40px 20px",
    background: "#f5efe5",
    color: "#2f2923",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    maxWidth: 980,
    margin: "0 auto 24px",
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontSize: 12,
    color: "#8a5a2b",
    fontWeight: 700,
  },
  title: {
    margin: "8px 0",
    fontSize: 38,
    lineHeight: 1.05,
    fontFamily: "Georgia, serif",
  },
  subtitle: {
    margin: 0,
    maxWidth: 680,
    color: "rgba(47, 41, 35, 0.72)",
    fontSize: 16,
    lineHeight: 1.55,
  },
  panel: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 20,
    border: "1px solid rgba(138, 90, 43, 0.18)",
    borderRadius: 22,
    background: "rgba(255, 253, 250, 0.82)",
    boxShadow: "0 16px 40px rgba(42, 31, 22, 0.08)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginTop: 14,
  },
  label: {
    display: "grid",
    gap: 7,
    fontSize: 13,
    fontWeight: 700,
    color: "rgba(47, 41, 35, 0.78)",
  },
  input: {
    width: "100%",
    border: "1px solid rgba(138, 90, 43, 0.22)",
    borderRadius: 12,
    padding: "11px 12px",
    background: "#fffdfa",
    color: "#2f2923",
    font: "inherit",
    fontWeight: 500,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    fontSize: 14,
    color: "rgba(47, 41, 35, 0.74)",
  },
  button: {
    marginTop: 18,
    width: "100%",
    border: 0,
    borderRadius: 999,
    padding: "14px 18px",
    background: "#2f2923",
    color: "#fffaf3",
    font: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    background: "#ffe8e3",
    color: "#8c1d18",
    fontWeight: 700,
  },
  results: {
    maxWidth: 980,
    margin: "24px auto 0",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  meta: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255, 253, 250, 0.86)",
    border: "1px solid rgba(138, 90, 43, 0.14)",
  },
  metaLabel: {
    display: "block",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(47, 41, 35, 0.48)",
    marginBottom: 5,
  },
  metaValue: {
    fontSize: 15,
  },
  sectionTitle: {
    margin: "28px 0 14px",
    fontFamily: "Georgia, serif",
    fontSize: 25,
  },
  muted: {
    color: "rgba(47, 41, 35, 0.58)",
  },
  cardList: {
    display: "grid",
    gap: 16,
  },
  card: {
    padding: 22,
    borderRadius: 22,
    background: "rgba(255, 253, 250, 0.9)",
    border: "1px solid rgba(138, 90, 43, 0.15)",
    boxShadow: "0 12px 30px rgba(42, 31, 22, 0.055)",
  },
  cardTopline: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "rgba(47, 41, 35, 0.55)",
    fontSize: 13,
    fontWeight: 800,
  },
  cardTitle: {
    margin: "12px 0",
    fontFamily: "Georgia, serif",
    fontSize: 26,
    lineHeight: 1.15,
  },
  anchor: {
    margin: "14px 0",
    padding: 14,
    borderRadius: 16,
    background: "rgba(138, 90, 43, 0.07)",
  },
  anchorLabel: {
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: 11,
    fontWeight: 800,
    color: "#8a5a2b",
    marginBottom: 4,
  },
  body: {
    fontSize: 17,
    lineHeight: 1.68,
  },
  why: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 1.55,
    color: "rgba(47, 41, 35, 0.78)",
  },
  details: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255, 253, 250, 0.82)",
    border: "1px solid rgba(138, 90, 43, 0.14)",
    marginBottom: 14,
  },
  pre: {
    overflow: "auto",
    whiteSpace: "pre-wrap",
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "#1f1a16",
    color: "#fffaf3",
    fontSize: 12,
    lineHeight: 1.5,
  },
  scoreRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "8px 0 14px",
    color: "#8a5a2b",
    fontSize: 13,
    fontWeight: 800,
  },
  reasoning: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(47, 41, 35, 0.06)",
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(47, 41, 35, 0.76)",
  },
  weakness: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    background: "rgba(150, 70, 30, 0.08)",
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(89, 45, 22, 0.86)",
  },};