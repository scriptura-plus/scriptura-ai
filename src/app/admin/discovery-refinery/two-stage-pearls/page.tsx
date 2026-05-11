"use client";

import { useMemo, useState } from "react";

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  reference?: string;
  canonical_ref?: string;
  passage_id?: string;
  existing_card_count?: number;
  active_or_reserve_count?: number;
  detector_summary?: {
    detector_signal_count?: number;
    queue_item_count?: number;
    action_counts?: Record<string, number>;
    tier_counts?: Record<string, number>;
    errors?: string[];
    status_counts?: Record<string, number>;
    keep_total?: number;
    discard_total?: number;
  };
  editorial_preview?: {
    draft_cards?: DraftCard[];
    eligible_signals?: SignalSummary[];
    research_only_signals?: SignalSummary[];
    discarded_signals?: SignalSummary[];
    unknown_signals?: SignalSummary[];
    existing_cards?: ExistingCard[];
  };
  raw?: unknown;
};

type DraftCard = {
  title?: string;
  anchor?: string | null;
  teaser?: string;
  why_it_matters?: string | null;
  source_signal_id?: string | null;
  score_estimate?: number | null;
  editor_note?: string | null;
};

type SignalSummary = {
  signal_id?: string;
  intake_status?: string;
  tier?: string | null;
  evidence_level?: string | null;
  reader_surprise_ru?: string;
  core_observation?: string;
  anchor_text?: string | null;
  risk_flags?: string[];
  suggested_lane?: string;
};

type ExistingCard = {
  id?: string;
  status?: string;
  title?: string;
  anchor?: string | null;
  teaser?: string;
  why_it_matters?: string | null;
  score_total?: number | null;
  coverage_type?: string | null;
  source_type?: string | null;
};

function getStoredSecret(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("scriptura_admin_secret") ?? "";
}

function storeSecret(secret: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("scriptura_admin_secret", secret);
}

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="jsonDetails">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function StatusPill({ children }: { children: string }) {
  return <span className="pill">{children}</span>;
}

function DraftCardView({ card, index }: { card: DraftCard; index: number }) {
  return (
    <article className="card draftCard">
      <div className="cardTopline">
        <span>Draft {index + 1}</span>
        {typeof card.score_estimate === "number" ? (
          <span>{card.score_estimate}/100</span>
        ) : null}
      </div>
      <h3>{card.title || "Untitled draft"}</h3>
      {card.anchor ? <p className="anchor">“{card.anchor}”</p> : null}
      {card.teaser ? <p className="teaser">{card.teaser}</p> : null}
      {card.why_it_matters ? (
        <p className="why">{card.why_it_matters}</p>
      ) : null}
      <div className="metaLine">
        {card.source_signal_id ? (
          <StatusPill>signal: {card.source_signal_id}</StatusPill>
        ) : null}
        {card.editor_note ? <StatusPill>{card.editor_note}</StatusPill> : null}
      </div>
    </article>
  );
}

function SignalView({ signal, index }: { signal: SignalSummary; index: number }) {
  return (
    <article className="card signalCard">
      <div className="cardTopline">
        <span>Signal {index + 1}</span>
        <span>{signal.intake_status || "unknown"}</span>
      </div>
      <p className="teaser">
        {signal.reader_surprise_ru || signal.core_observation || "No text"}
      </p>
      {signal.anchor_text ? <p className="anchor">“{signal.anchor_text}”</p> : null}
      <div className="metaLine">
        {signal.evidence_level ? <StatusPill>{signal.evidence_level}</StatusPill> : null}
        {signal.tier ? <StatusPill>{signal.tier}</StatusPill> : null}
        {signal.suggested_lane ? <StatusPill>{signal.suggested_lane}</StatusPill> : null}
        {(signal.risk_flags ?? []).map((flag) => (
          <StatusPill key={flag}>{flag}</StatusPill>
        ))}
      </div>
    </article>
  );
}

function ExistingCardView({ card, index }: { card: ExistingCard; index: number }) {
  return (
    <article className="card existingCard">
      <div className="cardTopline">
        <span>Existing {index + 1}</span>
        <span>{card.status || "unknown"}</span>
      </div>
      <h3>{card.title || "Untitled existing card"}</h3>
      {card.anchor ? <p className="anchor">“{card.anchor}”</p> : null}
      {card.teaser ? <p className="teaser">{card.teaser}</p> : null}
      {card.why_it_matters ? <p className="why">{card.why_it_matters}</p> : null}
      <div className="metaLine">
        {typeof card.score_total === "number" ? (
          <StatusPill>{card.score_total}/100</StatusPill>
        ) : null}
        {card.coverage_type ? <StatusPill>{card.coverage_type}</StatusPill> : null}
      </div>
    </article>
  );
}

export default function TwoStagePearlsPreviewPage() {
  const [reference, setReference] = useState("Матфея 11:29");
  const [adminSecret, setAdminSecret] = useState(getStoredSecret);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftCards = result?.editorial_preview?.draft_cards ?? [];
  const eligibleSignals = result?.editorial_preview?.eligible_signals ?? [];
  const researchSignals = result?.editorial_preview?.research_only_signals ?? [];
  const discardedSignals = result?.editorial_preview?.discarded_signals ?? [];
  const existingCards = result?.editorial_preview?.existing_cards ?? [];

  const readableSummary = useMemo(() => {
    if (!result) return null;

    return [
      `Reference: ${result.reference ?? reference}`,
      `Canonical: ${result.canonical_ref ?? "—"}`,
      `Passage: ${result.passage_id ?? "—"}`,
      `Existing cards: ${result.existing_card_count ?? 0}`,
      `Active/reserve: ${result.active_or_reserve_count ?? 0}`,
      `Detector signals: ${result.detector_summary?.detector_signal_count ?? 0}`,
      `Queue items: ${result.detector_summary?.queue_item_count ?? 0}`,
      `Keep total: ${result.detector_summary?.keep_total ?? 0}`,
      `Discard total: ${result.detector_summary?.discard_total ?? 0}`,
      `New draft cards: ${draftCards.length}`,
      `Errors: ${(result.detector_summary?.errors ?? []).length}`,
    ].join("\n");
  }, [draftCards.length, reference, result]);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setResult(null);
    storeSecret(adminSecret);

    try {
      const response = await fetch(
        "/api/admin/discovery-refinery/two-stage-pearls-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({
            reference,
            lang: "ru",
            detectorProvider: "claude",
            crafterProvider: "claude",
            maxCards: 6,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as PreviewResponse | null;

      if (!response.ok || !data) {
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Scriptura Studio</p>
        <h1>Two-stage Pearls editorial preview</h1>
        <p className="subtitle">
          Находит углы через новый detector, пишет draft-карточки только из
          eligible signals, а спорные гипотезы показывает отдельно как research.
        </p>
      </section>

      <section className="panel controls">
        <label>
          <span>Admin secret</span>
          <input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            placeholder="ADMIN_SECRET"
            type="password"
          />
        </label>

        <label>
          <span>Reference</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Матфея 11:29"
          />
        </label>

        <button disabled={loading || !reference.trim() || !adminSecret.trim()} onClick={runPreview}>
          {loading ? "Running..." : "Run preview"}
        </button>
      </section>

      {error ? <section className="errorBox">{error}</section> : null}

      {readableSummary ? (
        <section className="panel">
          <h2>Readable Summary</h2>
          <pre className="summary">{readableSummary}</pre>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="grid2">
            <div className="panel">
              <h2>New draft Pearls v2</h2>
              <p className="hint">
                Это не публикация. Это редакционный preview карточек, сделанных
                только из eligible signals.
              </p>
              {draftCards.length > 0 ? (
                <div className="stack">
                  {draftCards.map((card, index) => (
                    <DraftCardView
                      card={card}
                      index={index}
                      key={`${card.source_signal_id ?? "card"}-${index}`}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty">No draft cards generated.</p>
              )}
            </div>

            <div className="panel">
              <h2>Existing Scriptura cards</h2>
              <p className="hint">
                Не A/B battle, а ориентир качества и карта возможных дублей.
              </p>
              {existingCards.length > 0 ? (
                <div className="stack">
                  {existingCards.slice(0, 8).map((card, index) => (
                    <ExistingCardView
                      card={card}
                      index={index}
                      key={card.id ?? index}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty">No existing cards.</p>
              )}
            </div>
          </section>

          <section className="grid3">
            <div className="panel">
              <h2>Eligible signals</h2>
              <p className="hint">Из них Card Crafter может делать preview-карточки.</p>
              {eligibleSignals.length > 0 ? (
                <div className="stack">
                  {eligibleSignals.map((signal, index) => (
                    <SignalView
                      signal={signal}
                      index={index}
                      key={signal.signal_id ?? index}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty">No eligible signals.</p>
              )}
            </div>

            <div className="panel">
              <h2>Research-only signals</h2>
              <p className="hint">Не публиковать. Нужна проверка/модератор.</p>
              {researchSignals.length > 0 ? (
                <div className="stack">
                  {researchSignals.map((signal, index) => (
                    <SignalView
                      signal={signal}
                      index={index}
                      key={signal.signal_id ?? index}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty">No research-only signals.</p>
              )}
            </div>

            <div className="panel">
              <h2>Discarded signals</h2>
              <p className="hint">Красиво, но пусто / явный fail.</p>
              {discardedSignals.length > 0 ? (
                <div className="stack">
                  {discardedSignals.map((signal, index) => (
                    <SignalView
                      signal={signal}
                      index={index}
                      key={signal.signal_id ?? index}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty">No discarded signals.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <JsonDetails title="Raw response" value={result.raw ?? result} />
          </section>
        </>
      ) : null}

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px;
          background: #f6efe1;
          color: #2c241b;
          font-family:
            ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        }

        .hero {
          max-width: 920px;
          margin: 0 auto 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8a5a2b;
        }

        h1 {
          margin: 0;
          font-size: clamp(34px, 6vw, 64px);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }

        h2 {
          margin: 0 0 10px;
          font-size: 24px;
          letter-spacing: -0.03em;
        }

        h3 {
          margin: 8px 0;
          font-size: 20px;
          line-height: 1.05;
        }

        .subtitle {
          max-width: 760px;
          margin: 14px 0 0;
          color: #5a4a37;
          font-size: 18px;
          line-height: 1.45;
        }

        .panel {
          border: 1px solid rgba(111, 71, 32, 0.18);
          border-radius: 24px;
          padding: 18px;
          background: rgba(251, 246, 234, 0.92);
          box-shadow: 0 18px 48px rgba(44, 36, 27, 0.08);
        }

        .controls {
          max-width: 920px;
          margin: 0 auto 20px;
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }

        label {
          display: grid;
          gap: 6px;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          font-size: 13px;
          color: #5a4a37;
        }

        input {
          width: 100%;
          border: 1px solid rgba(111, 71, 32, 0.2);
          border-radius: 14px;
          padding: 12px 14px;
          background: #fffaf0;
          color: #2c241b;
          font-size: 16px;
        }

        button {
          border: 0;
          border-radius: 14px;
          padding: 13px 18px;
          background: #6f4720;
          color: #fffaf0;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .errorBox {
          max-width: 920px;
          margin: 0 auto 20px;
          border: 1px solid rgba(160, 40, 30, 0.25);
          border-radius: 20px;
          padding: 16px;
          background: #fff0ed;
          color: #8a1f16;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .summary {
          white-space: pre-wrap;
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
        }

        .grid2 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
          margin: 20px 0;
        }

        .grid3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin: 20px 0;
        }

        .stack {
          display: grid;
          gap: 12px;
        }

        .card {
          border: 1px solid rgba(111, 71, 32, 0.14);
          border-radius: 18px;
          padding: 14px;
          background: #fbf6ea;
        }

        .draftCard {
          background: #fffaf0;
        }

        .existingCard {
          opacity: 0.92;
        }

        .signalCard {
          background: #f8f0df;
        }

        .cardTopline,
        .metaLine {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          justify-content: space-between;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          font-size: 12px;
          color: #8a5a2b;
        }

        .metaLine {
          justify-content: flex-start;
          margin-top: 12px;
        }

        .anchor {
          margin: 8px 0;
          color: #6f4720;
          font-size: 15px;
        }

        .teaser,
        .why {
          margin: 10px 0 0;
          color: #2c241b;
          line-height: 1.45;
        }

        .why {
          color: #5a4a37;
        }

        .hint,
        .empty {
          margin: 0 0 12px;
          color: #5a4a37;
          font-size: 14px;
          line-height: 1.4;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          background: rgba(138, 90, 43, 0.1);
          color: #6f4720;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          font-size: 11px;
        }

        .jsonDetails {
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .jsonDetails summary {
          cursor: pointer;
          font-weight: 700;
          color: #6f4720;
        }

        .jsonDetails pre {
          overflow: auto;
          max-height: 70vh;
          margin: 14px 0 0;
          padding: 14px;
          border-radius: 16px;
          background: #2c241b;
          color: #fbf6ea;
          font-size: 12px;
          line-height: 1.45;
        }

        @media (max-width: 1000px) {
          .controls,
          .grid2,
          .grid3 {
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
