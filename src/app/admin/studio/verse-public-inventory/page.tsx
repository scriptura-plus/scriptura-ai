"use client";

import { useMemo, useState } from "react";

type InventoryResponse = {
  ok?: boolean;
  mode?: string;
  generated?: boolean;
  reference?: string;
  canonical_ref?: string | null;
  lang?: string;
  sections?: {
    observations?: InventorySection;
    deep?: Record<string, InventorySection>;
  };
  rawCounts?: Record<string, number>;
  warnings?: string[];
  error?: string;
};

type InventorySection = {
  key?: string;
  label?: string;
  uiId?: string;
  publishedLensId?: string;
  articleType?: string;
  status?: string;
  source?: string;
  counts?: Record<string, number>;
  wouldGenerateIfOpenedPublicly?: boolean;
  canOpenReadOnly?: boolean;
  notes?: string[];
};

const STATUS_LABELS: Record<string, string> = { ready: "Ready", partial: "Partial", missing: "Missing", legacy_only: "Legacy/cache only", generated_but_not_published: "Generated but not published" };

function statusText(status?: string) {
  if (!status) return "unknown";
  return STATUS_LABELS[status] ?? status;
}

function statusClass(status?: string) {
  if (status === "ready") return "status ready";
  if (status === "partial") return "status partial";
  if (status === "generated_but_not_published") return "status partial";
  if (status === "legacy_only") return "status legacy";
  if (status === "missing") return "status missing";
  return "status";
}

function SectionCard({
  title,
  section,
}: {
  title: string;
  section?: InventorySection;
}) {
  if (!section) {
    return (
      <div className="card">
        <div className="cardTop">
          <h2>{title}</h2>
          <span className="status missing">No data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="cardTop">
        <div>
          <h2>{section.label || title}</h2>
          <div className="meta">
            {section.key ? <span>key: {section.key}</span> : null}
            {section.uiId ? <span>ui: {section.uiId}</span> : null}
            {section.publishedLensId ? (
              <span>published: {section.publishedLensId}</span>
            ) : null}
            {section.articleType ? <span>article: {section.articleType}</span> : null}
            {section.source ? <span>source: {section.source}</span> : null}
          </div>
        </div>
        <span className={statusClass(section.status)}>
          {statusText(section.status)}
        </span>
      </div>

      {section.counts ? (
        <div className="counts">
          {Object.entries(section.counts).map(([key, value]) => (
            <div className="count" key={key}>
              <span>{key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flags">
        <span>
          wouldGenerateIfOpenedPublicly:{" "}
          <strong>{String(Boolean(section.wouldGenerateIfOpenedPublicly))}</strong>
        </span>
        <span>
          canOpenReadOnly: <strong>{String(Boolean(section.canOpenReadOnly))}</strong>
        </span>
      </div>

      {section.notes && section.notes.length > 0 ? (
        <ul className="notes">
          {section.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function VersePublicInventoryPage() {
  const [reference, setReference] = useState("John 17:3");
  const [lang, setLang] = useState("ru");
  const [adminSecret, setAdminSecret] = useState("");
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      reference,
      lang,
    });

    return `/api/admin/studio/verse-public-inventory?${params.toString()}`;
  }, [reference, lang]);

  async function loadInventory() {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      const json = (await res.json()) as InventoryResponse;

      if (!res.ok) {
        setError(json.error || `Request failed with status ${res.status}`);
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const observations = data?.sections?.observations;
  const deep = data?.sections?.deep ?? {};

  return (
    <main className="page">
      <div className="hero">
        <div>
          <p className="eyebrow">Scriptura Studio - Read-only diagnostic</p>
          <h1>Verse Public Content Inventory</h1>
          <p className="subtitle">Shows what already exists in published, cache, and research layers for one verse. This page does not call /api/analyze and does not run AI generation.</p>
        </div>
      </div>

      <section className="panel">
        <label>Reference<input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="John 17:3"
          />
        </label>

        <label>Lang<select value={lang} onChange={(event) => setLang(event.target.value)}>
            <option value="ru">ru</option>
            <option value="en">en</option>
            <option value="es">es</option>
          </select>
        </label>

        <label>Reference<input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            placeholder="localtest"
            type="password"
          />
        </label>

        <button onClick={loadInventory} disabled={loading}>
          {loading ? "Checking..." : "Check"}
        </button>
      </section>

      <div className="endpoint">{endpoint}</div>

      {error ? <div className="error">{error}</div> : null}

      {data ? (
        <section className="results">
          <div className="summary">
            <div>
              <span>reference</span>
              <strong>{data.reference || "â€”"}</strong>
            </div>
            <div>
              <span>canonical_ref</span>
              <strong>{data.canonical_ref || "â€”"}</strong>
            </div>
            <div>
              <span>mode</span>
              <strong>{data.mode || "â€”"}</strong>
            </div>
            <div>
              <span>generated</span>
              <strong>{String(Boolean(data.generated))}</strong>
            </div>
          </div>

          <SectionCard title="Observations" section={observations} />

          <div className="grid">
            <SectionCard title="Text findings" section={deep.text_findings} />
            <SectionCard title="Historical scene" section={deep.historical_scene} />
            <SectionCard title="Scripture links" section={deep.scripture_links} />
          </div>

          {data.rawCounts ? (
            <div className="card">
              <div className="cardTop">
                <h2>Raw counts</h2>
              </div>
              <div className="counts">
                {Object.entries(data.rawCounts).map(([key, value]) => (
                  <div className="count" key={key}>
                    <span>{key}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {data.warnings && data.warnings.length > 0 ? (
            <div className="card warningCard">
              <div className="cardTop">
                <h2>Warnings</h2>
              </div>
              <ul className="notes">
                {data.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="raw">
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </section>
      ) : null}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f7efe2;
          color: #2b241b;
          padding: 32px;
          font-family:
            ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        }

        .hero {
          max-width: 1100px;
          margin: 0 auto 20px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #7e6143;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: 38px;
          line-height: 1.05;
        }

        h2 {
          margin: 0;
          font-size: 20px;
        }

        .subtitle {
          max-width: 780px;
          color: #655342;
          font-size: 17px;
          line-height: 1.5;
        }

        .panel,
        .summary,
        .card,
        .raw {
          max-width: 1100px;
          margin: 0 auto 16px;
          background: rgba(255, 252, 246, 0.88);
          border: 1px solid rgba(109, 82, 51, 0.16);
          border-radius: 22px;
          box-shadow: 0 16px 40px rgba(92, 66, 36, 0.08);
        }

        .panel {
          display: grid;
          grid-template-columns: 1.5fr 120px 1.2fr auto;
          gap: 12px;
          align-items: end;
          padding: 18px;
        }

        label {
          display: grid;
          gap: 6px;
          color: #6f5b45;
          font-size: 14px;
        }

        input,
        select {
          border: 1px solid rgba(93, 70, 44, 0.22);
          background: #fffaf1;
          border-radius: 14px;
          padding: 12px 13px;
          color: #2b241b;
          font-size: 15px;
          outline: none;
        }

        button {
          border: none;
          border-radius: 14px;
          padding: 13px 18px;
          background: #496f8f;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .endpoint {
          max-width: 1100px;
          margin: 0 auto 16px;
          color: #7c6650;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
        }

        .error {
          max-width: 1100px;
          margin: 0 auto 16px;
          background: #fff0ec;
          border: 1px solid #d08a77;
          color: #8a2e1e;
          border-radius: 18px;
          padding: 14px 16px;
        }

        .results {
          display: grid;
          gap: 16px;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          padding: 16px;
        }

        .summary div {
          display: grid;
          gap: 5px;
        }

        .summary span,
        .count span,
        .meta,
        .flags {
          color: #7b6750;
          font-size: 13px;
        }

        .card {
          padding: 18px;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 7px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }

        .status {
          border-radius: 999px;
          padding: 7px 11px;
          background: #eee2d0;
          color: #5f4c36;
          font-size: 13px;
          white-space: nowrap;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .status.ready {
          background: #dbeedc;
          color: #235827;
        }

        .status.partial {
          background: #fff0c7;
          color: #745000;
        }

        .status.legacy {
          background: #e2e7f5;
          color: #334570;
        }

        .status.missing {
          background: #f4d7cf;
          color: #7c2d1d;
        }

        .counts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }

        .count {
          border-radius: 16px;
          background: #f8f0e3;
          padding: 12px;
          display: grid;
          gap: 6px;
        }

        .count strong {
          font-size: 22px;
        }

        .flags {
          margin-top: 14px;
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }

        .notes {
          margin: 14px 0 0;
          padding-left: 18px;
          color: #5d4b39;
          line-height: 1.45;
        }

        .grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .warningCard {
          border-color: rgba(173, 98, 52, 0.3);
        }

        .raw {
          padding: 16px 18px;
        }

        .raw summary {
          cursor: pointer;
          font-weight: 700;
        }

        pre {
          overflow: auto;
          background: #251f18;
          color: #f8ead6;
          border-radius: 16px;
          padding: 16px;
          font-size: 13px;
          line-height: 1.45;
        }

        @media (max-width: 900px) {
          .panel,
          .summary,
          .grid {
            grid-template-columns: 1fr;
          }

          .page {
            padding: 18px;
          }
        }
      `}</style>
    </main>
  );
}




