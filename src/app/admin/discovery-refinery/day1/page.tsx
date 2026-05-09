"use client";

import { useMemo, useState } from "react";

type Action =
  | "calibration"
  | "detector_preview"
  | "day15_fixture_preview"
  | "day15_multi_verse_preview";

type QueueItem = {
  queue_item_id?: string;
  tier?: string;
  suggested_action?: string;
  signal?: {
    reader_surprise_sentence?: {
      ru?: string | null;
    };
    evidence_level?: string;
  };
  verdicts?: {
    same_angle?: {
      verdict?: string;
      judge_confidence?: string;
    };
    verifier?: {
      overall?: string;
      pretty_but_empty?: boolean;
    };
  };
};

type ApiResult = {
  ok?: boolean;
  mode?: string;
  reference?: string;
  fixture_id?: string;
  canonical_ref?: string;
  passage_id?: string;
  genre?: string;
  expected_richness?: string;
  diagnostic_reason?: string;
  expected_behavior_note?: string;
  detector_signal_count?: number;
  queue?: QueueItem[];
  calibration?: Array<{
    case_id: string;
    label: string;
    passed: boolean;
    actual?: {
      same_angle_verdict?: string | null;
      verifier_overall?: string | null;
    };
  }>;
  action_counts?: Record<string, number>;
  tier_counts?: Record<string, number>;
  aggregate?: Record<string, number>;
  verses?: Array<{
    fixture_id: string;
    reference: string;
    genre: string;
    expected_richness: string;
    detector_signal_count: number;
    action_counts: Record<string, number>;
    tier_counts: Record<string, number>;
    queue: QueueItem[];
    errors?: string[];
  }>;
  errors?: string[];
  meta?: {
    action?: string;
    fixtureId?: string;
    purpose?: string;
    boundary?: string;
    next?: string;
    warning?: string;
  };
  error?: string;
};

const DAY15_FIXTURES = [
  {
    id: "matthew_11_29",
    label: "Matthew 11:29",
    note: "rich · existing cards",
  },
  {
    id: "isaiah_58_2",
    label: "Isaiah 58:2",
    note: "rich · prophetic",
  },
  {
    id: "first_timothy_4_12",
    label: "1 Timothy 4:12",
    note: "medium · instruction",
  },
  {
    id: "genesis_22_8",
    label: "Genesis 22:8",
    note: "medium · narrative",
  },
  {
    id: "genesis_5_20",
    label: "Genesis 5:20",
    note: "low · genealogy",
  },
];

function getStatusLabel(result: ApiResult | null): string {
  if (!result) return "No run yet";
  if (result.ok) return "OK";
  return "Not OK";
}

function getStatusClass(result: ApiResult | null): string {
  if (!result) return "status-neutral";
  if (result.ok) return "status-ok";
  return "status-bad";
}

function summarizeCalibration(result: ApiResult): string {
  const cases = result.calibration ?? [];
  const passed = cases.filter((item) => item.passed).length;
  return `${passed}/${cases.length} cases passed`;
}

function summarizeQueue(result: ApiResult): string {
  const queue = result.queue ?? [];
  const approve = queue.filter(
    (item) => item.suggested_action === "approve_reserve",
  ).length;
  const rewrite = queue.filter(
    (item) => item.suggested_action === "rewrite",
  ).length;
  const discard = queue.filter(
    (item) => item.suggested_action === "discard",
  ).length;

  return `${queue.length} queue items · ${approve} approve_reserve · ${rewrite} rewrite · ${discard} discard`;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function actionBadgeClass(action?: string): string {
  if (action === "approve_reserve" || action === "approve_active") {
    return "good";
  }

  if (
    action === "rewrite" ||
    action === "replace_existing" ||
    action === "mark_for_external_research"
  ) {
    return "warn";
  }

  if (action === "discard") return "bad";

  return "";
}

function QueuePreview({ queue }: { queue: QueueItem[] }) {
  if (queue.length === 0) {
    return <p className="empty">No queue items.</p>;
  }

  return (
    <>
      {queue.map((item, index) => (
        <div className="queue-row" key={item.queue_item_id ?? index}>
          <div className="row-top">
            <div>
              <div className="row-title">
                {index + 1}. {item.suggested_action ?? "—"}
              </div>
              <div className="row-meta">
                Tier: {item.tier ?? "—"} · Judge:{" "}
                {item.verdicts?.same_angle?.verdict ?? "—"} · Verifier:{" "}
                {item.verdicts?.verifier?.overall ?? "—"}
              </div>
            </div>
            <span className={`badge ${actionBadgeClass(item.suggested_action)}`}>
              {item.signal?.evidence_level ?? "—"}
            </span>
          </div>
          <div className="quote">
            {item.signal?.reader_surprise_sentence?.ru ?? "—"}
          </div>
        </div>
      ))}
    </>
  );
}

export default function Day1DiscoveryRefineryPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const statusLabel = useMemo(() => getStatusLabel(result), [result]);
  const statusClass = useMemo(() => getStatusClass(result), [result]);

  async function runAction(action: Action, fixtureId?: string) {
    const key = fixtureId ? `${action}:${fixtureId}` : action;

    setLoadingKey(key);
    setResult(null);

    try {
      const response = await fetch("/api/admin/discovery-refinery/day1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          action,
          fixtureId,
          detectorProvider: "claude",
          judgeProvider: "openai",
          verifierProvider: "openai",
        }),
      });

      const data = (await response.json().catch(() => null)) as ApiResult | null;

      if (!response.ok) {
        setResult(
          data ?? {
            ok: false,
            error: `Request failed with status ${response.status}`,
          },
        );
        return;
      }

      setResult(data ?? { ok: false, error: "Empty response" });
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoadingKey(null);
    }
  }

  const isLoading = loadingKey !== null;
  const canRun = adminSecret.trim().length > 0 && !isLoading;

  const isSinglePreview =
    result?.mode === "detector_preview" ||
    result?.mode === "day15_fixture_preview";

  return (
    <main className="day1-page">
      <style jsx>{`
        .day1-page {
          min-height: 100vh;
          padding: 32px 18px 80px;
          background: #f6efe1;
          color: #2c241b;
          font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .shell {
          width: min(1120px, 100%);
          margin: 0 auto;
        }

        .header {
          margin-bottom: 22px;
        }

        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7b6b58;
          margin-bottom: 8px;
        }

        h1 {
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(32px, 5vw, 54px);
          line-height: 1.02;
          margin: 0 0 10px;
        }

        .subtitle {
          max-width: 860px;
          color: #5a4a37;
          font-size: 16px;
          line-height: 1.55;
          margin: 0;
        }

        .panel {
          background: rgba(255, 250, 240, 0.78);
          border: 1px solid rgba(100, 78, 48, 0.16);
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 18px 45px rgba(61, 43, 22, 0.08);
          margin-bottom: 16px;
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .secret-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        label {
          font-size: 13px;
          color: #6c5b45;
          font-weight: 650;
        }

        input {
          width: 100%;
          border: 1px solid rgba(100, 78, 48, 0.22);
          background: #fffaf0;
          color: #2c241b;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 15px;
          outline: none;
        }

        input:focus {
          border-color: rgba(62, 97, 131, 0.65);
          box-shadow: 0 0 0 4px rgba(62, 97, 131, 0.1);
        }

        .button-row,
        .fixture-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .fixture-section {
          border-top: 1px solid rgba(100, 78, 48, 0.14);
          padding-top: 14px;
        }

        .section-label {
          font-size: 13px;
          font-weight: 850;
          color: #5a4a37;
          margin-bottom: 8px;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 11px 15px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
          color: #fffaf0;
          background: #5f7890;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease,
            box-shadow 0.15s ease;
          box-shadow: 0 10px 22px rgba(55, 78, 101, 0.18);
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(55, 78, 101, 0.22);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .secondary {
          background: #8a5a2b;
        }

        .danger {
          background: #6f4720;
        }

        .fixture-button {
          display: grid;
          gap: 2px;
          text-align: left;
          border-radius: 16px;
          padding: 11px 13px;
          min-width: 170px;
        }

        .fixture-button span:first-child {
          font-size: 14px;
          font-weight: 850;
        }

        .fixture-button span:last-child {
          font-size: 11px;
          font-weight: 650;
          opacity: 0.82;
        }

        .status-line {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-top: 2px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 13px;
          font-weight: 800;
        }

        .status-neutral {
          background: rgba(100, 78, 48, 0.1);
          color: #5a4a37;
        }

        .status-ok {
          background: rgba(51, 120, 82, 0.14);
          color: #27643f;
        }

        .status-bad {
          background: rgba(155, 48, 48, 0.12);
          color: #8b2424;
        }

        .small-muted {
          color: #7b6b58;
          font-size: 13px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 900px) {
          .grid {
            grid-template-columns: 0.9fr 1.1fr;
          }
        }

        h2 {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 24px;
          margin: 0 0 12px;
        }

        h3 {
          font-size: 15px;
          margin: 18px 0 8px;
        }

        .summary-list {
          display: grid;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .summary-item {
          background: rgba(255, 255, 255, 0.42);
          border: 1px solid rgba(100, 78, 48, 0.12);
          border-radius: 14px;
          padding: 11px;
          font-size: 14px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .case-row,
        .queue-row,
        .verse-row {
          border: 1px solid rgba(100, 78, 48, 0.14);
          background: rgba(255, 255, 255, 0.46);
          border-radius: 16px;
          padding: 12px;
          margin-bottom: 10px;
        }

        .row-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .row-title {
          font-weight: 800;
          font-size: 14px;
        }

        .row-meta {
          color: #7b6b58;
          font-size: 12px;
          line-height: 1.45;
        }

        .badge {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 800;
          background: rgba(95, 120, 144, 0.13);
          color: #4f6579;
          white-space: nowrap;
        }

        .badge.good {
          background: rgba(51, 120, 82, 0.14);
          color: #27643f;
        }

        .badge.warn {
          background: rgba(177, 116, 42, 0.16);
          color: #7a4f18;
        }

        .badge.bad {
          background: rgba(155, 48, 48, 0.12);
          color: #8b2424;
        }

        .quote {
          color: #3d3023;
          font-size: 14px;
          line-height: 1.5;
        }

        pre {
          width: 100%;
          max-height: 720px;
          overflow: auto;
          margin: 0;
          padding: 14px;
          border-radius: 16px;
          background: #211a14;
          color: #f8ead0;
          font-size: 12px;
          line-height: 1.5;
        }

        .empty {
          color: #7b6b58;
          font-size: 14px;
          line-height: 1.5;
        }

        .warning {
          border: 1px solid rgba(155, 48, 48, 0.18);
          background: rgba(155, 48, 48, 0.07);
          color: #6d2a1f;
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.45;
        }
      `}</style>

      <div className="shell">
        <section className="header">
          <div className="eyebrow">Scriptura AI · Discovery Refinery</div>
          <h1>Day-1 / Day-1.5 Console</h1>
          <p className="subtitle">
            Diagnostic preview only. No Supabase writes, no Studio moderation,
            no Card Crafter. Use single-fixture preview for Day-1.5 to avoid
            Vercel timeout.
          </p>
        </section>

        <section className="panel controls">
          <div className="secret-row">
            <label htmlFor="admin-secret">Admin Secret</label>
            <input
              id="admin-secret"
              value={adminSecret}
              onChange={(event) => setAdminSecret(event.target.value)}
              placeholder="Paste ADMIN_SECRET"
              type="password"
              autoComplete="off"
            />
          </div>

          <div className="button-row">
            <button
              disabled={!canRun}
              onClick={() => runAction("calibration")}
              type="button"
            >
              {loadingKey === "calibration"
                ? "Running Calibration…"
                : "Run Calibration"}
            </button>

            <button
              className="secondary"
              disabled={!canRun}
              onClick={() => runAction("detector_preview")}
              type="button"
            >
              {loadingKey === "detector_preview"
                ? "Running Detector Preview…"
                : "Run Detector Preview"}
            </button>

            <button
              className="danger"
              disabled={!canRun}
              onClick={() => runAction("day15_multi_verse_preview")}
              type="button"
              title="Can timeout. Prefer the single fixture buttons below."
            >
              {loadingKey === "day15_multi_verse_preview"
                ? "Running Full Batch…"
                : "Full Batch — may timeout"}
            </button>
          </div>

          <div className="fixture-section">
            <div className="section-label">
              Safe Day-1.5 Preview — run one fixture at a time
            </div>
            <div className="fixture-grid">
              {DAY15_FIXTURES.map((fixture) => {
                const key = `day15_fixture_preview:${fixture.id}`;

                return (
                  <button
                    className="fixture-button"
                    disabled={!canRun}
                    key={fixture.id}
                    onClick={() =>
                      runAction("day15_fixture_preview", fixture.id)
                    }
                    type="button"
                  >
                    <span>
                      {loadingKey === key ? "Running…" : fixture.label}
                    </span>
                    <span>{fixture.note}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="status-line">
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
            {result?.mode && (
              <span className="small-muted">Mode: {result.mode}</span>
            )}
            {result?.reference && (
              <span className="small-muted">Reference: {result.reference}</span>
            )}
            {result?.meta?.next && (
              <span className="small-muted">Next: {result.meta.next}</span>
            )}
          </div>
        </section>

        <div className="grid">
          <section className="panel">
            <h2>Readable Summary</h2>

            {!result && (
              <p className="empty">
                Run calibration first. Then use the single-fixture buttons for
                Day-1.5.
              </p>
            )}

            {result?.error && (
              <div className="summary-item">
                <strong>Error:</strong> {result.error}
              </div>
            )}

            {result?.meta?.warning && (
              <div className="warning">{result.meta.warning}</div>
            )}

            {result?.mode === "calibration" && (
              <>
                <ul className="summary-list">
                  <li className="summary-item">
                    <strong>Calibration:</strong> {summarizeCalibration(result)}
                  </li>
                  <li className="summary-item">
                    <strong>Queue:</strong> {summarizeQueue(result)}
                  </li>
                </ul>

                <h3>Cases</h3>
                {(result.calibration ?? []).map((item) => (
                  <div className="case-row" key={item.case_id}>
                    <div className="row-top">
                      <div>
                        <div className="row-title">{item.label}</div>
                        <div className="row-meta">{item.case_id}</div>
                      </div>
                      <span
                        className={`badge ${item.passed ? "good" : "bad"}`}
                      >
                        {item.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                    <div className="row-meta">
                      Judge: {item.actual?.same_angle_verdict ?? "—"} ·
                      Verifier: {item.actual?.verifier_overall ?? "—"}
                    </div>
                  </div>
                ))}
              </>
            )}

            {isSinglePreview && (
              <>
                <ul className="summary-list">
                  <li className="summary-item">
                    <strong>Reference:</strong> {result.reference ?? "—"}
                  </li>

                  {result.fixture_id && (
                    <li className="summary-item">
                      <strong>Fixture:</strong> {result.fixture_id}
                      {"\n"}
                      <strong>Genre:</strong> {result.genre ?? "—"}
                      {"\n"}
                      <strong>Expected richness:</strong>{" "}
                      {result.expected_richness ?? "—"}
                    </li>
                  )}

                  {result.diagnostic_reason && (
                    <li className="summary-item">
                      <strong>Diagnostic reason:</strong>{" "}
                      {result.diagnostic_reason}
                    </li>
                  )}

                  {result.expected_behavior_note && (
                    <li className="summary-item">
                      <strong>Expected behavior:</strong>{" "}
                      {result.expected_behavior_note}
                    </li>
                  )}

                  <li className="summary-item">
                    <strong>Detector signals:</strong>{" "}
                    {result.detector_signal_count ?? 0}
                  </li>

                  <li className="summary-item">
                    <strong>Queue:</strong> {summarizeQueue(result)}
                  </li>

                  {result.action_counts && (
                    <li className="summary-item">
                      <strong>Actions:</strong>{" "}
                      {formatJson(result.action_counts)}
                    </li>
                  )}

                  {result.tier_counts && (
                    <li className="summary-item">
                      <strong>Tiers:</strong> {formatJson(result.tier_counts)}
                    </li>
                  )}

                  <li className="summary-item">
                    <strong>Errors:</strong> {(result.errors ?? []).length}
                  </li>
                </ul>

                <h3>Moderator Queue Preview</h3>
                <QueuePreview queue={result.queue ?? []} />
              </>
            )}

            {result?.mode === "day15_multi_verse_preview" && (
              <>
                <div className="warning">
                  Full batch can timeout. Prefer the single-fixture buttons.
                </div>

                <ul className="summary-list">
                  <li className="summary-item">
                    <strong>Verses:</strong> {result.verses?.length ?? 0}
                  </li>
                  <li className="summary-item">
                    <strong>Aggregate:</strong>{" "}
                    {formatJson(result.aggregate ?? {})}
                  </li>
                  <li className="summary-item">
                    <strong>Errors:</strong> {(result.errors ?? []).length}
                  </li>
                </ul>

                <h3>Verse Results</h3>
                {(result.verses ?? []).map((verse) => (
                  <div className="verse-row" key={verse.fixture_id}>
                    <div className="row-top">
                      <div>
                        <div className="row-title">{verse.reference}</div>
                        <div className="row-meta">
                          {verse.genre} · richness: {verse.expected_richness} ·
                          signals: {verse.detector_signal_count}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          verse.errors?.length ? "bad" : "good"
                        }`}
                      >
                        {verse.errors?.length ? "ERROR" : "OK"}
                      </span>
                    </div>

                    <div className="row-meta">
                      Actions: {formatJson(verse.action_counts)}
                    </div>
                    <div className="row-meta">
                      Tiers: {formatJson(verse.tier_counts)}
                    </div>

                    <QueuePreview queue={verse.queue} />
                  </div>
                ))}
              </>
            )}
          </section>

          <section className="panel">
            <h2>Raw JSON</h2>
            <pre>{result ? formatJson(result) : "No result yet."}</pre>
          </section>
        </div>
      </div>
    </main>
  );
}
