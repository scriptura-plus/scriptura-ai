"use client";

import { useMemo, useState } from "react";

type Day1Action = "calibration" | "detector_preview";

type RunState = "idle" | "running" | "done" | "error";

function getStoredSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("scriptura.adminSecret") ?? "";
}

function saveStoredSecret(value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("scriptura.adminSecret", value);
}

function getShortStatus(value: unknown): string {
  if (!value || typeof value !== "object") return "No result yet.";

  const obj = value as Record<string, unknown>;
  const ok = obj.ok === true ? "OK" : "NOT OK";
  const mode = typeof obj.mode === "string" ? obj.mode : "unknown mode";
  const count =
    typeof obj.detector_signal_count === "number"
      ? obj.detector_signal_count
      : null;

  if (mode === "calibration") {
    const calibration = Array.isArray(obj.calibration) ? obj.calibration : [];
    const passed = calibration.filter((item) => {
      return (
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).passed === true
      );
    }).length;

    return `${ok} · calibration · ${passed}/${calibration.length} cases passed`;
  }

  if (mode === "detector_preview") {
    const queue = Array.isArray(obj.queue) ? obj.queue : [];
    return `${ok} · detector preview · signals: ${count ?? "?"} · queue items: ${queue.length}`;
  }

  return `${ok} · ${mode}`;
}

function getResultSummary(value: unknown): Array<{
  label: string;
  value: string;
}> {
  if (!value || typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;
  const rows: Array<{ label: string; value: string }> = [];

  rows.push({
    label: "Status",
    value: obj.ok === true ? "OK" : "Not OK",
  });

  if (typeof obj.mode === "string") {
    rows.push({ label: "Mode", value: obj.mode });
  }

  if (typeof obj.reference === "string") {
    rows.push({ label: "Reference", value: obj.reference });
  }

  if (typeof obj.detector_provider === "string") {
    rows.push({ label: "Detector", value: obj.detector_provider });
  }

  if (typeof obj.judge_provider === "string") {
    rows.push({ label: "Judge", value: obj.judge_provider });
  }

  if (typeof obj.verifier_provider === "string") {
    rows.push({ label: "Verifier", value: obj.verifier_provider });
  }

  if (typeof obj.detector_signal_count === "number") {
    rows.push({
      label: "Detector signals",
      value: String(obj.detector_signal_count),
    });
  }

  const queue = Array.isArray(obj.queue) ? obj.queue : null;
  if (queue) {
    rows.push({ label: "Queue items", value: String(queue.length) });
  }

  const errors = Array.isArray(obj.errors) ? obj.errors : null;
  if (errors) {
    rows.push({ label: "Errors", value: String(errors.length) });
  }

  return rows;
}

function extractCalibrationRows(value: unknown): Array<{
  caseId: string;
  label: string;
  passed: boolean;
}> {
  if (!value || typeof value !== "object") return [];

  const calibration = (value as Record<string, unknown>).calibration;

  if (!Array.isArray(calibration)) return [];

  return calibration.map((item, index) => {
    const row =
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>)
        : {};

    return {
      caseId:
        typeof row.case_id === "string" ? row.case_id : `case_${index + 1}`,
      label: typeof row.label === "string" ? row.label : "Untitled case",
      passed: row.passed === true,
    };
  });
}

function extractQueueRows(value: unknown): Array<{
  id: string;
  tier: string;
  action: string;
  verdict: string;
  verifier: string;
  surprise: string;
}> {
  if (!value || typeof value !== "object") return [];

  const queue = (value as Record<string, unknown>).queue;

  if (!Array.isArray(queue)) return [];

  return queue.map((item, index) => {
    const row =
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>)
        : {};

    const verdicts =
      typeof row.verdicts === "object" && row.verdicts !== null
        ? (row.verdicts as Record<string, unknown>)
        : {};

    const sameAngle =
      typeof verdicts.same_angle === "object" && verdicts.same_angle !== null
        ? (verdicts.same_angle as Record<string, unknown>)
        : {};

    const verifier =
      typeof verdicts.verifier === "object" && verdicts.verifier !== null
        ? (verdicts.verifier as Record<string, unknown>)
        : {};

    const signal =
      typeof row.signal === "object" && row.signal !== null
        ? (row.signal as Record<string, unknown>)
        : {};

    const surprise =
      typeof signal.reader_surprise_sentence === "object" &&
      signal.reader_surprise_sentence !== null
        ? (signal.reader_surprise_sentence as Record<string, unknown>)
        : {};

    return {
      id:
        typeof row.queue_item_id === "string"
          ? row.queue_item_id
          : `queue_${index + 1}`,
      tier: typeof row.tier === "string" ? row.tier : "unknown",
      action:
        typeof row.suggested_action === "string"
          ? row.suggested_action
          : "unknown",
      verdict:
        typeof sameAngle.verdict === "string" ? sameAngle.verdict : "unknown",
      verifier:
        typeof verifier.overall === "string" ? verifier.overall : "unknown",
      surprise:
        typeof surprise.ru === "string"
          ? surprise.ru
          : "No surprise sentence",
    };
  });
}

export default function DiscoveryDay1Page() {
  const [secret, setSecret] = useState(getStoredSecret);
  const [state, setState] = useState<RunState>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const shortStatus = useMemo(() => getShortStatus(result), [result]);
  const summaryRows = useMemo(() => getResultSummary(result), [result]);
  const calibrationRows = useMemo(() => extractCalibrationRows(result), [result]);
  const queueRows = useMemo(() => extractQueueRows(result), [result]);

  async function run(action: Day1Action) {
    const cleanSecret = secret.trim();

    if (!cleanSecret) {
      setState("error");
      setError("Enter ADMIN_SECRET first.");
      return;
    }

    saveStoredSecret(cleanSecret);

    setState("running");
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/discovery-refinery/day1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": cleanSecret,
        },
        body: JSON.stringify({
          action,
          detectorProvider: "claude",
          judgeProvider: "openai",
          verifierProvider: "openai",
        }),
      });

      const json = (await response.json()) as unknown;

      if (!response.ok) {
        const message =
          typeof json === "object" &&
          json !== null &&
          typeof (json as Record<string, unknown>).error === "string"
            ? String((json as Record<string, unknown>).error)
            : `Request failed with status ${response.status}`;

        throw new Error(message);
      }

      setResult(json);
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <main className="day1-page">
      <style>{`
        .day1-page {
          min-height: 100dvh;
          padding: 24px 16px 80px;
          background:
            radial-gradient(circle at 10% 0%, rgba(200,151,102,0.12), transparent 42%),
            radial-gradient(circle at 95% 0%, rgba(102,130,154,0.10), transparent 38%),
            #f6efe1;
          color: #2c241b;
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .day1-shell {
          width: min(920px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .day1-hero,
        .day1-card {
          border: 1px solid rgba(216, 201, 168, 0.82);
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.44), rgba(251,246,234,0.96));
          box-shadow:
            0 1px 2px rgba(60, 40, 20, 0.035),
            0 14px 34px rgba(60, 40, 20, 0.06);
        }

        .day1-hero {
          padding: 22px;
        }

        .day1-kicker {
          margin: 0 0 8px;
          color: rgba(138, 90, 43, 0.72);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .day1-title {
          margin: 0;
          font-family: ui-serif, Georgia, "Times New Roman", serif;
          font-size: clamp(32px, 7vw, 52px);
          line-height: 1.02;
          letter-spacing: -0.045em;
          font-weight: 500;
        }

        .day1-subtitle {
          max-width: 680px;
          margin: 14px 0 0;
          color: rgba(44, 36, 27, 0.72);
          font-size: 16px;
          line-height: 1.65;
        }

        .day1-card {
          padding: 18px;
        }

        .day1-card-title {
          margin: 0 0 12px;
          font-family: ui-serif, Georgia, "Times New Roman", serif;
          font-size: 22px;
          line-height: 1.2;
        }

        .day1-secret-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .day1-label {
          display: grid;
          gap: 6px;
          color: rgba(90, 74, 55, 0.8);
          font-size: 13px;
          font-weight: 700;
        }

        .day1-input {
          width: 100%;
          border: 1px solid rgba(216, 201, 168, 0.92);
          border-radius: 14px;
          background: rgba(255, 251, 244, 0.84);
          color: #2c241b;
          padding: 12px 13px;
          font: inherit;
          font-size: 15px;
          outline: none;
        }

        .day1-input:focus {
          border-color: rgba(102, 130, 154, 0.72);
          box-shadow: 0 0 0 3px rgba(102, 130, 154, 0.18);
        }

        .day1-buttons {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        .day1-button {
          appearance: none;
          border: 1px solid rgba(102, 130, 154, 0.26);
          border-radius: 999px;
          background: linear-gradient(180deg, #7591aa, #5f7c95);
          color: #f7fbff;
          cursor: pointer;
          min-height: 46px;
          padding: 0 18px;
          font: inherit;
          font-weight: 750;
          box-shadow:
            0 10px 22px rgba(95,124,149,0.18),
            inset 0 1px 0 rgba(255,255,255,0.18);
        }

        .day1-button.secondary {
          background: linear-gradient(180deg, #2f2923, #1f1a16);
          border-color: rgba(47, 41, 35, 0.24);
          box-shadow: 0 12px 24px rgba(42, 31, 22, 0.145);
        }

        .day1-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .day1-status {
          margin-top: 14px;
          border-radius: 16px;
          background: rgba(255, 251, 244, 0.7);
          border: 1px solid rgba(216, 201, 168, 0.7);
          padding: 12px 14px;
          color: rgba(44, 36, 27, 0.76);
          font-size: 14px;
          line-height: 1.5;
        }

        .day1-status strong {
          color: #2c241b;
        }

        .day1-error {
          margin-top: 12px;
          border-radius: 16px;
          background: rgba(138, 58, 32, 0.08);
          border: 1px solid rgba(138, 58, 32, 0.18);
          color: #8a3a20;
          padding: 12px 14px;
          font-size: 14px;
        }

        .day1-summary-grid {
          display: grid;
          gap: 8px;
        }

        .day1-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(216, 201, 168, 0.58);
          font-size: 14px;
        }

        .day1-summary-row span:first-child {
          color: rgba(90, 74, 55, 0.68);
        }

        .day1-summary-row span:last-child {
          font-weight: 750;
          text-align: right;
        }

        .day1-table {
          display: grid;
          gap: 10px;
        }

        .day1-row {
          border: 1px solid rgba(216, 201, 168, 0.72);
          border-radius: 18px;
          background: rgba(255, 251, 244, 0.62);
          padding: 13px;
        }

        .day1-row-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .day1-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 9px;
          background: rgba(102, 130, 154, 0.12);
          color: #536f88;
          font-size: 12px;
          font-weight: 800;
        }

        .day1-pill.good {
          background: rgba(52, 120, 77, 0.12);
          color: #34784d;
        }

        .day1-pill.bad {
          background: rgba(138, 58, 32, 0.10);
          color: #8a3a20;
        }

        .day1-row-title {
          margin: 0;
          font-weight: 800;
          color: #2c241b;
        }

        .day1-row-text {
          margin: 6px 0 0;
          color: rgba(44, 36, 27, 0.72);
          font-size: 14px;
          line-height: 1.55;
        }

        .day1-json {
          overflow: auto;
          max-height: 520px;
          border-radius: 18px;
          background: #241f19;
          color: #f8f1e5;
          padding: 16px;
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        @media (min-width: 640px) {
          .day1-buttons {
            grid-template-columns: 1fr 1fr;
          }

          .day1-hero,
          .day1-card {
            padding: 24px;
          }
        }
      `}</style>

      <div className="day1-shell">
        <section className="day1-hero">
          <p className="day1-kicker">Discovery Refinery · Day-1</p>
          <h1 className="day1-title">Vertical Slice Console</h1>
          <p className="day1-subtitle">
            Запускаем первый контролируемый тест: Matthew 11:29, один detector,
            fingerprint, Same-Angle Judge, Verifier и JSON moderator queue. Пока
            ничего не сохраняется в Supabase.
          </p>
        </section>

        <section className="day1-card">
          <h2 className="day1-card-title">Run</h2>

          <div className="day1-secret-row">
            <label className="day1-label">
              ADMIN_SECRET
              <input
                className="day1-input"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Paste ADMIN_SECRET"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="day1-buttons">
            <button
              type="button"
              className="day1-button"
              disabled={state === "running"}
              onClick={() => run("calibration")}
            >
              {state === "running" ? "Running…" : "Run Calibration"}
            </button>

            <button
              type="button"
              className="day1-button secondary"
              disabled={state === "running"}
              onClick={() => run("detector_preview")}
            >
              {state === "running" ? "Running…" : "Run Detector Preview"}
            </button>
          </div>

          <div className="day1-status">
            <strong>Status:</strong> {shortStatus}
          </div>

          {state === "error" && error && (
            <div className="day1-error">{error}</div>
          )}
        </section>

        {summaryRows.length > 0 && (
          <section className="day1-card">
            <h2 className="day1-card-title">Summary</h2>
            <div className="day1-summary-grid">
              {summaryRows.map((row) => (
                <div key={row.label} className="day1-summary-row">
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {calibrationRows.length > 0 && (
          <section className="day1-card">
            <h2 className="day1-card-title">Calibration Cases</h2>
            <div className="day1-table">
              {calibrationRows.map((row) => (
                <div key={row.caseId} className="day1-row">
                  <div className="day1-row-top">
                    <p className="day1-row-title">{row.label}</p>
                    <span className={`day1-pill ${row.passed ? "good" : "bad"}`}>
                      {row.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  <p className="day1-row-text">{row.caseId}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {queueRows.length > 0 && (
          <section className="day1-card">
            <h2 className="day1-card-title">Moderator Queue Preview</h2>
            <div className="day1-table">
              {queueRows.map((row) => (
                <div key={row.id} className="day1-row">
                  <div className="day1-row-top">
                    <p className="day1-row-title">{row.action}</p>
                    <span className="day1-pill">{row.tier}</span>
                  </div>
                  <p className="day1-row-text">
                    <strong>Judge:</strong> {row.verdict} ·{" "}
                    <strong>Verifier:</strong> {row.verifier}
                  </p>
                  <p className="day1-row-text">{row.surprise}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {result !== null && (
          <section className="day1-card">
            <h2 className="day1-card-title">Raw JSON</h2>
            <pre className="day1-json">{JSON.stringify(result, null, 2)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
