"use client";

import { useEffect, useMemo, useState } from "react";

type Lang = "ru" | "en" | "es";

type ParsedCard = {
  title?: string;
  anchor?: string;
  teaser?: string;
  body?: string;
  why_it_matters?: string;
  whyItMatters?: string;
};

function safeParseCards(text: unknown): ParsedCard[] {
  if (typeof text !== "string") return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
  } catch {
    return [];
  }
}

function snippet(value: unknown, max = 260): string {
  if (typeof value !== "string") return "";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function AnalyzeInspectorPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [reference, setReference] = useState("John 17:3");
  const [verseText, setVerseText] = useState(
    "And this is eternal life, that they know you, the only true God, and Jesus Christ whom you have sent.",
  );
  const [lang, setLang] = useState<Lang>("en");
  const [kind, setKind] = useState("lens");
  const [lensId, setLensId] = useState("angles");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura.adminSecret");
    if (saved) setAdminSecret(saved);
  }, []);

  const cards = useMemo(() => safeParseCards(result?.text), [result]);

  async function checkSecret() {
    setAuthMessage("");
    setAuthorized(false);

    const response = await fetch("/api/admin/studio/analyze-inspector/check", {
      method: "POST",
      headers: {
        "x-admin-secret": adminSecret,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      setAuthMessage(data?.error ?? "Unauthorized");
      return;
    }

    window.localStorage.setItem("scriptura.adminSecret", adminSecret);
    setAuthorized(true);
    setAuthMessage("Admin secret accepted.");
  }

  async function runAnalyze() {
    setLoading(true);
    setError("");
    setResult(null);
    setStatus(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind,
          id: lensId,
          reference,
          verseText,
          lang,
        }),
      });

      setStatus(response.status);

      const data = await response.json().catch(async () => ({
        error: await response.text(),
      }));

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown request error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <h1>Analyze Response Inspector</h1>

      <p style={{ color: "#7a5b32", lineHeight: 1.6 }}>
        Этот диагностический вызов обращается к реальному <code>/api/analyze</code> и может
        запустить generation, если кэша нет. Использовать только вручную.
      </p>

      <section style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12, marginBottom: 24 }}>
        <h2>Admin access</h2>
        <input
          value={adminSecret}
          onChange={(event) => setAdminSecret(event.target.value)}
          placeholder="ADMIN_SECRET"
          type="password"
          style={{ width: "100%", padding: 12, marginBottom: 12 }}
        />
        <button onClick={checkSecret} style={{ padding: "10px 16px" }}>
          Unlock inspector
        </button>
        {authMessage ? <p>{authMessage}</p> : null}
      </section>

      {authorized ? (
        <>
          <section style={{ display: "grid", gap: 12, marginBottom: 24 }}>
            <label>
              Reference
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              Verse text
              <textarea
                value={verseText}
                onChange={(event) => setVerseText(event.target.value)}
                rows={4}
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              Language
              <select value={lang} onChange={(event) => setLang(event.target.value as Lang)}>
                <option value="en">en</option>
                <option value="ru">ru</option>
                <option value="es">es</option>
              </select>
            </label>

            <label>
              Kind
              <input
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              ID
              <input
                value={lensId}
                onChange={(event) => setLensId(event.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <button onClick={runAnalyze} disabled={loading} style={{ padding: "12px 18px" }}>
              {loading ? "Checking..." : "Проверить /api/analyze"}
            </button>
          </section>

          <section style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
            <h2>Response summary</h2>

            {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

            <p>HTTP status: {status ?? "—"}</p>
            <p>source: {String(result?.source ?? "—")}</p>
            <p>cached: {String(result?.cached ?? "—")}</p>
            <p>generated: {String(result?.generated ?? "—")}</p>
            <p>text length: {typeof result?.text === "string" ? result.text.length : "—"}</p>

            {result?.error ? <p style={{ color: "crimson" }}>Error: {String(result.error)}</p> : null}

            <h3>First cards</h3>
            {cards.length ? (
              cards.map((card, index) => (
                <article key={index} style={{ padding: 12, borderTop: "1px solid #eee" }}>
                  <strong>{index + 1}. {snippet(card.title)}</strong>
                  <p><b>Anchor:</b> {snippet(card.anchor)}</p>
                  <p><b>Teaser:</b> {snippet(card.teaser ?? card.body ?? card.why_it_matters ?? card.whyItMatters)}</p>
                </article>
              ))
            ) : (
              <p>No parseable cards in text.</p>
            )}

            <h3>Raw text preview</h3>
            <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
              {snippet(result?.text, 900)}
            </pre>
          </section>
        </>
      ) : null}
    </main>
  );
}
