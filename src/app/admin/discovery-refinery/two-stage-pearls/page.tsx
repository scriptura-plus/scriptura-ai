"use client";

import { useMemo, useState, type ReactNode } from "react";

type LabResponse = {
  ok?: boolean;
  error?: string;
  reference?: string;
  canonical_ref?: string;
  passage_id?: string;
  summary?: {
    existing_card_count?: number;
    angle_count?: number;
    draft_card_count?: number;
    evaluated_card_count?: number;
    rewrite_candidate_count?: number;
    rewritten_card_count?: number;
    recommended_card_count?: number;
    public_ready_count?: number;
    needs_evidence_count?: number;
    strong_count?: number;
    usable_count?: number;
    errors?: string[];
  };
  result?: {
    angles?: Angle[];
    evaluated_cards?: EvaluatedCard[];
    rewritten_cards?: EvaluatedCard[];
    recommended_cards?: EvaluatedCard[];
    existing_cards?: ExistingCard[];
  };
  raw?: unknown;
};

type Angle = {
  angle_id?: string;
  title?: string;
  anchor?: string;
  discovery?: string;
  why_surprising?: string;
  angle_type?: string;
  evidence_need?: string;
  risk_note?: string | null;
};

type EvaluatedCard = {
  card_id?: string;
  title?: string;
  anchor?: string;
  teaser?: string;
  why_it_matters?: string;
  source_angle_ids?: string[];
  score_total?: number | null;
  wow_score?: number | null;
  textual_anchor_score?: number | null;
  freshness_score?: number | null;
  safety_score?: number | null;
  verdict?: string | null;
  risk_flags?: string[];
  rewrite_instruction?: string | null;
  evaluator_note?: string | null;
  original_card_id?: string;
  public_ready?: boolean;
  public_status?: string;
  public_blockers?: string[];
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
};

type CandidateSnapshot = {
  id?: string;
  title?: string;
  anchor?: string | null;
  teaser?: string | null;
  why_it_matters?: string | null;
};

type PreviewDuplicateInfo = {
  matched_card_id?: string | null;
  existing_score?: number | null;
  candidate_score?: number | null;
  score_delta?: number | null;
  same_angle?: boolean | null;
  similarity_confidence?: number | null;
  battle_action?: string | null;
  battle_reason?: string | null;
  reason?: string | null;
  existing_card?: ExistingCard | null;
  candidate_card?: CandidateSnapshot | null;
};

type ReviewCandidate = {
  type?: "near_replacement" | "strong_duplicate" | string;
  reason?: string;
  reference?: string;
  canonical_ref?: string;
  candidate_title?: string;
  candidate_score_v2?: number | null;
  preview_score?: number | null;
  old_pipeline_status?: string | null;
  existing_card_id?: string | null;
  existing_title?: string | null;
  existing_score?: number | null;
  score_delta?: number | null;
  candidate?: CandidateSnapshot;
  preview_duplicate?: PreviewDuplicateInfo | null;
  suggested_actions?: string[];
  preview_response?: unknown;
};

type TopupResultItem = {
  candidate_title?: string;
  candidate_score_v2?: number | null;
  candidate_public_ready_v2?: boolean;
  candidate_public_status_v2?: string | null;
  candidate_lexicon_claim_status_v2?: string | null;
  candidate_lexicon_note_v2?: string | null;
  skipped?: boolean;
  skip_reason?: string | null;
  saved_id?: string | null;
  final_score?: number | null;
  preview_score?: number | null;
  preview_skipped?: boolean;
  preview_skip_reason?: string | null;
  preview_would_save?: boolean | null;
  preview_duplicate_existing_id?: string | null;
  old_pipeline_status?: string | null;
  forced_status?: string | null;
  has_evidence_risk?: boolean;
  lexicon_cleared_by_v2?: boolean;
  review_candidate?: ReviewCandidate | null;
};

type TopupResponse = {
  ok?: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  existing_count_before?: number;
  target_count?: number;
  process_limit?: number;
  v2_cards_total?: number;
  selected_for_old_pipeline?: number;
  processed_count?: number;
  saved_count?: number;
  skipped_count?: number;
  failed_count?: number;
  review_candidate_count?: number;
  review_candidates?: ReviewCandidate[];
  results?: TopupResultItem[];
};

function getStoredSecret(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("scriptura_admin_secret") ?? "";
}

function storeSecret(secret: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("scriptura_admin_secret", secret);
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="jsonDetails">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function Score({ value }: { value?: number | null }) {
  if (typeof value !== "number") return <span className="score muted">—</span>;
  return <span className={value >= 82 ? "score high" : value >= 74 ? "score mid" : "score"}>{value}</span>;
}

function Delta({ value }: { value?: number | null }) {
  if (typeof value !== "number") return <span className="delta muted">Δ —</span>;
  return <span className={value > 0 ? "delta positive" : value < 0 ? "delta negative" : "delta"}>Δ {value > 0 ? `+${value}` : value}</span>;
}

function MiniCard({ title, card }: { title: string; card?: CandidateSnapshot | ExistingCard | null }) {
  if (!card) return null;

  return (
    <div className="miniCard">
      <div className="miniTitle">{title}</div>
      <h4>{card.title || "Untitled"}</h4>
      {"score_total" in card && typeof card.score_total === "number" ? (
        <p className="miniMeta">score {card.score_total}</p>
      ) : null}
      {"status" in card && card.status ? <p className="miniMeta">status {card.status}</p> : null}
      {card.anchor ? <p className="anchor">“{card.anchor}”</p> : null}
      {card.teaser ? <p className="text">{card.teaser}</p> : null}
      {card.why_it_matters ? <p className="why">{card.why_it_matters}</p> : null}
    </div>
  );
}

function CardView({ card, index }: { card: EvaluatedCard; index: number }) {
  return (
    <article className="card">
      <div className="top">
        <span>Card {index + 1}</span>
        <Score value={card.score_total} />
      </div>
      <h3>{card.title || "Untitled"}</h3>
      {card.anchor ? <p className="anchor">“{card.anchor}”</p> : null}
      {card.teaser ? <p className="text">{card.teaser}</p> : null}
      {card.why_it_matters ? <p className="why">{card.why_it_matters}</p> : null}

      <div className="pills">
        {card.verdict ? <Pill>{card.verdict}</Pill> : null}
        {typeof card.wow_score === "number" ? <Pill>wow {card.wow_score}</Pill> : null}
        {typeof card.safety_score === "number" ? <Pill>safety {card.safety_score}</Pill> : null}
        {card.public_ready ? <Pill>public-ready</Pill> : null}
        {!card.public_ready && card.public_status ? <Pill>{card.public_status}</Pill> : null}
        {card.original_card_id ? <Pill>rewrite of {card.original_card_id}</Pill> : null}
        {(card.public_blockers ?? []).slice(0, 3).map((blocker) => (
          <Pill key={blocker}>{blocker}</Pill>
        ))}
        {(card.risk_flags ?? []).map((flag) => (
          <Pill key={flag}>{flag}</Pill>
        ))}
      </div>

      {card.evaluator_note ? <p className="note">{card.evaluator_note}</p> : null}
      {card.rewrite_instruction ? (
        <p className="rewrite">Rewrite: {card.rewrite_instruction}</p>
      ) : null}
    </article>
  );
}

function AngleView({ angle, index }: { angle: Angle; index: number }) {
  return (
    <article className="smallCard">
      <div className="top">
        <span>Angle {index + 1}</span>
        <span>{angle.angle_id}</span>
      </div>
      <h3>{angle.title || "Untitled angle"}</h3>
      {angle.anchor ? <p className="anchor">“{angle.anchor}”</p> : null}
      {angle.discovery ? <p className="text">{angle.discovery}</p> : null}
      <div className="pills">
        {angle.angle_type ? <Pill>{angle.angle_type}</Pill> : null}
        {angle.evidence_need ? <Pill>{angle.evidence_need}</Pill> : null}
      </div>
      {angle.risk_note ? <p className="note">{angle.risk_note}</p> : null}
    </article>
  );
}

function ExistingCardView({ card, index }: { card: ExistingCard; index: number }) {
  return (
    <article className="smallCard existing">
      <div className="top">
        <span>Existing {index + 1}</span>
        <span>{card.status || "—"}</span>
      </div>
      <h3>{card.title || "Untitled"}</h3>
      {card.anchor ? <p className="anchor">“{card.anchor}”</p> : null}
      {card.teaser ? <p className="text">{card.teaser}</p> : null}
      <div className="pills">
        {typeof card.score_total === "number" ? <Pill>{card.score_total}/100</Pill> : null}
        {card.coverage_type ? <Pill>{card.coverage_type}</Pill> : null}
      </div>
    </article>
  );
}

function ReviewCandidateView({ item, index }: { item: ReviewCandidate; index: number }) {
  const duplicate = item.preview_duplicate ?? null;
  const existingCard = duplicate?.existing_card ?? null;
  const candidateCard = item.candidate ?? duplicate?.candidate_card ?? null;

  return (
    <article className="reviewCard">
      <div className="reviewHeader">
        <div>
          <p className="reviewKicker">Review candidate {index + 1}</p>
          <h3>{item.candidate_title || candidateCard?.title || "Untitled candidate"}</h3>
        </div>
        <div className="scoreCluster">
          <Score value={item.preview_score} />
          <Delta value={item.score_delta} />
        </div>
      </div>

      <div className="pills">
        {item.type ? <Pill>{item.type}</Pill> : null}
        {item.reason ? <Pill>{item.reason}</Pill> : null}
        {item.old_pipeline_status ? <Pill>old: {item.old_pipeline_status}</Pill> : null}
        {typeof item.candidate_score_v2 === "number" ? <Pill>v2 {item.candidate_score_v2}</Pill> : null}
        {typeof item.existing_score === "number" ? <Pill>existing {item.existing_score}</Pill> : null}
        {item.existing_card_id ? <Pill>matched {item.existing_card_id.slice(0, 8)}</Pill> : null}
      </div>

      <p className="reviewSummary">
        Это не было сохранено автоматически, потому что old pipeline увидел сильное пересечение с уже существующей карточкой.
        Но кандидат достаточно сильный, чтобы не потеряться: редактор должен решить, заменить, объединить идею, сохранить вручную в reserve или отклонить.
      </p>

      <div className="compareGrid">
        <MiniCard title="Candidate" card={candidateCard} />
        <MiniCard title="Existing match" card={existingCard} />
      </div>

      {duplicate?.battle_reason ? <p className="note strongNote">Battle: {duplicate.battle_reason}</p> : null}
      {duplicate?.reason ? <p className="note">Reason: {duplicate.reason}</p> : null}

      {item.suggested_actions?.length ? (
        <div className="actionsRow">
          <span>Suggested actions</span>
          {item.suggested_actions.map((action) => (
            <Pill key={action}>{action}</Pill>
          ))}
        </div>
      ) : null}

      <JsonDetails title="Review candidate JSON" value={item} />
    </article>
  );
}

export default function PearlsV2LabPage() {
  const [reference, setReference] = useState("Иоанна 17:7");
  const [adminSecret, setAdminSecret] = useState(getStoredSecret);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupResult, setTopupResult] = useState<TopupResponse | null>(null);
  const [topupError, setTopupError] = useState<string | null>(null);

  const angles = result?.result?.angles ?? [];
  const cards =
    result?.result?.recommended_cards ??
    result?.result?.evaluated_cards ??
    [];
  const rewrittenCards = result?.result?.rewritten_cards ?? [];
  const originalCards = result?.result?.evaluated_cards ?? [];
  const existing = result?.result?.existing_cards ?? [];
  const topupReviewCandidates = topupResult?.review_candidates ?? [];

  const summary = useMemo(() => {
    if (!result) return null;
    return [
      `Reference: ${result.reference ?? reference}`,
      `Canonical: ${result.canonical_ref ?? "—"}`,
      `Passage: ${result.passage_id ?? "—"}`,
      `Existing cards: ${result.summary?.existing_card_count ?? 0}`,
      `Angles harvested: ${result.summary?.angle_count ?? 0}`,
      `Cards written: ${result.summary?.draft_card_count ?? 0}`,
      `Cards evaluated: ${result.summary?.evaluated_card_count ?? 0}`,
      `Rewrite candidates: ${result.summary?.rewrite_candidate_count ?? 0}`,
      `Rewritten cards: ${result.summary?.rewritten_card_count ?? 0}`,
      `Recommended cards: ${result.summary?.recommended_card_count ?? 0}`,
      `Public-ready: ${result.summary?.public_ready_count ?? 0}`,
      `Needs evidence: ${result.summary?.needs_evidence_count ?? 0}`,
      `Strong 82+: ${result.summary?.strong_count ?? 0}`,
      `Usable 74+: ${result.summary?.usable_count ?? 0}`,
      `Errors: ${(result.summary?.errors ?? []).length}`,
    ].join("\n");
  }, [reference, result]);

  async function runLab() {
    setLoading(true);
    setError(null);
    setResult(null);
    setTopupResult(null);
    setTopupError(null);
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
            maxAngles: 14,
            maxCards: 8,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as LabResponse | null;

      if (!response.ok || !data) {
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      if (data.error) throw new Error(data.error);

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function runTopup() {
    if (!result) {
      setTopupError("Run Pearls v2 first.");
      return;
    }

    setTopupLoading(true);
    setTopupError(null);
    setTopupResult(null);
    storeSecret(adminSecret);

    try {
      const response = await fetch(
        "/api/admin/discovery-refinery/run-pearls-v2-topup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({
            reference: result.reference ?? reference,
            lang: "ru",
            targetCount: 12,
            processLimit: 3,
            force: false,
            includeStrongNonPublic: false,
            cards,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as TopupResponse | null;

      if (!response.ok || !data) {
        throw new Error(data?.error || `Top-up failed with status ${response.status}`);
      }

      if (data.error) throw new Error(data.error);

      setTopupResult(data);
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : String(err));
    } finally {
      setTopupLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Scriptura Studio</p>
        <h1>Pearls v2 Lab</h1>
        <p className="subtitle">
          Углы → сильные карточки → оценка. Preview ничего не сохраняет; top-up отправляет текущие V2-карточки в старый pipeline.
        </p>
      </section>

      <section className="panel controls">
        <label>
          <span>Admin secret</span>
          <input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            type="password"
          />
        </label>

        <label>
          <span>Reference</span>
          <input value={reference} onChange={(event) => setReference(event.target.value)} />
        </label>

        <button disabled={loading || !reference.trim() || !adminSecret.trim()} onClick={runLab}>
          {loading ? "Running..." : "Run Pearls v2"}
        </button>
      </section>

      {error ? <section className="errorBox">{error}</section> : null}

      {summary ? (
        <section className="panel">
          <h2>Readable Summary</h2>
          <pre className="summary">{summary}</pre>
        </section>
      ) : null}

      <section className="panel topupPanel">
        <div>
          <h2>V2 top-up through old pipeline</h2>
          <p className="subtitleSmall">
            Sends current Pearls v2 cards into process-angle-candidate. Strong duplicate / near-replacement candidates are now returned for editor review instead of disappearing.
          </p>
        </div>
        <button
          disabled={topupLoading || !reference.trim() || !adminSecret.trim() || !result}
          onClick={runTopup}
          type="button"
        >
          {topupLoading ? "Sending..." : "Send current V2 cards to old pipeline"}
        </button>
        {topupError ? <p className="topupError">{topupError}</p> : null}
        {topupResult ? (
          <pre className="topupResult">
{`ok: ${topupResult.ok ? "yes" : "no"}
skipped: ${topupResult.skipped ? "yes" : "no"}
reason: ${topupResult.reason ?? "—"}
existing before: ${topupResult.existing_count_before ?? "—"}
target count: ${topupResult.target_count ?? "—"}
process limit: ${topupResult.process_limit ?? "—"}
v2 cards: ${topupResult.v2_cards_total ?? "—"}
selected: ${topupResult.selected_for_old_pipeline ?? "—"}
processed: ${topupResult.processed_count ?? 0}
saved: ${topupResult.saved_count ?? 0}
skipped by old pipeline: ${topupResult.skipped_count ?? 0}
failed: ${topupResult.failed_count ?? 0}
review candidates: ${topupResult.review_candidate_count ?? topupReviewCandidates.length}`}
          </pre>
        ) : null}
        {topupResult?.results?.length ? (
          <JsonDetails title="Top-up details" value={topupResult.results} />
        ) : null}
      </section>

      {topupReviewCandidates.length > 0 ? (
        <section className="panel reviewPanel">
          <div className="reviewIntro">
            <p className="eyebrow">Editor queue</p>
            <h2>Review Candidates / Near replacements</h2>
            <p className="subtitleSmall">
              Эти карточки old pipeline не сохранил автоматически из-за duplicate/battle logic, но они достаточно сильные для ручного решения.
            </p>
          </div>

          <div className="reviewGrid">
            {topupReviewCandidates.map((item, index) => (
              <ReviewCandidateView
                item={item}
                index={index}
                key={`${item.existing_card_id ?? "review"}_${item.candidate_title ?? index}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="panel">
            <h2>Recommended Pearls v2 cards</h2>
            <div className="cardGrid">
              {cards.length > 0 ? (
                cards.map((card, index) => (
                  <CardView card={card} index={index} key={card.card_id ?? index} />
                ))
              ) : (
                <p className="empty">No cards written.</p>
              )}
            </div>
          </section>

          {rewrittenCards.length > 0 ? (
            <section className="panel">
              <h2>Rewritten cards</h2>
              <div className="cardGrid">
                {rewrittenCards.map((card, index) => (
                  <CardView card={card} index={index} key={`rewrite_${card.card_id ?? index}`} />
                ))}
              </div>
            </section>
          ) : null}

          {rewrittenCards.length > 0 ? (
            <section className="panel">
              <JsonDetails title="Original evaluated cards" value={originalCards} />
            </section>
          ) : null}

          <section className="split">
            <div className="panel">
              <h2>Harvested angles</h2>
              <div className="stack">
                {angles.length > 0 ? (
                  angles.map((angle, index) => (
                    <AngleView angle={angle} index={index} key={angle.angle_id ?? index} />
                  ))
                ) : (
                  <p className="empty">No angles.</p>
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Existing cards</h2>
              <div className="stack">
                {existing.length > 0 ? (
                  existing.slice(0, 12).map((card, index) => (
                    <ExistingCardView card={card} index={index} key={card.id ?? index} />
                  ))
                ) : (
                  <p className="empty">No existing cards.</p>
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <JsonDetails title="Raw result" value={result.raw ?? result} />
          </section>
        </>
      ) : null}

      <style jsx global>{`
        .page {
          min-height: 100vh;
          padding: 28px;
          background: #f6efe1;
          color: #2c241b;
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        }

        .hero,
        .controls,
        .panel {
          max-width: 1160px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font: 700 12px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8a5a2b;
        }

        h1 {
          margin: 0;
          font-size: clamp(38px, 7vw, 76px);
          line-height: 0.9;
          letter-spacing: -0.06em;
        }

        h2 {
          margin: 0 0 14px;
          font-size: 26px;
          letter-spacing: -0.04em;
        }

        h3 {
          margin: 8px 0;
          font-size: 21px;
          line-height: 1.08;
          letter-spacing: -0.03em;
        }

        h4 {
          margin: 7px 0;
          font-size: 18px;
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .subtitle {
          margin: 14px 0 0;
          font-size: 18px;
          color: #5a4a37;
        }

        .panel {
          border: 1px solid rgba(111, 71, 32, 0.18);
          border-radius: 24px;
          padding: 18px;
          background: rgba(251, 246, 234, 0.94);
          box-shadow: 0 18px 48px rgba(44, 36, 27, 0.08);
          margin-bottom: 18px;
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }

        label {
          display: grid;
          gap: 6px;
          font: 600 13px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #5a4a37;
        }

        input {
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
          font-weight: 800;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .errorBox {
          max-width: 1160px;
          margin: 0 auto 18px;
          border-radius: 18px;
          padding: 16px;
          background: #fff0ed;
          color: #8a1f16;
        }

        .summary {
          margin: 0;
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.55;
        }

        .cardGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
        }

        .split {
          max-width: 1160px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
        }

        .stack {
          display: grid;
          gap: 12px;
        }

        .card,
        .smallCard {
          border: 1px solid rgba(111, 71, 32, 0.14);
          border-radius: 18px;
          padding: 15px;
          background: #fffaf0;
          overflow-wrap: anywhere;
        }

        .smallCard {
          background: #fbf6ea;
        }

        .existing {
          opacity: 0.92;
        }

        .top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          color: #8a5a2b;
          font: 700 12px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .score,
        .delta {
          display: inline-flex;
          min-width: 42px;
          justify-content: center;
          text-align: center;
          border-radius: 999px;
          padding: 6px 9px;
          background: rgba(138, 90, 43, 0.1);
          color: #6f4720;
          font: 800 12px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .score.high {
          background: rgba(95, 120, 90, 0.18);
          color: #3d5a38;
        }

        .score.mid {
          background: rgba(160, 120, 60, 0.16);
        }

        .score.muted,
        .delta.muted {
          color: #8a7a67;
        }

        .delta.positive {
          background: rgba(95, 120, 90, 0.18);
          color: #3d5a38;
        }

        .delta.negative {
          background: rgba(138, 63, 43, 0.12);
          color: #8a3f2b;
        }

        .anchor {
          margin: 8px 0;
          color: #6f4720;
          font-size: 15px;
        }

        .text,
        .why,
        .note,
        .rewrite {
          margin: 10px 0 0;
          line-height: 1.45;
        }

        .why,
        .note {
          color: #5a4a37;
        }

        .rewrite {
          color: #8a3f2b;
        }

        .pills {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .pill {
          border-radius: 999px;
          padding: 4px 8px;
          background: rgba(138, 90, 43, 0.1);
          color: #6f4720;
          font: 700 11px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .empty {
          color: #5a4a37;
        }

        .jsonDetails summary {
          cursor: pointer;
          color: #6f4720;
          font-weight: 800;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .jsonDetails pre {
          overflow: auto;
          max-height: 70vh;
          padding: 14px;
          border-radius: 16px;
          background: #2c241b;
          color: #fbf6ea;
          font-size: 12px;
          line-height: 1.45;
        }

        .topupPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }

        .subtitleSmall {
          margin: 0;
          color: #5a4a37;
          font-size: 15px;
        }

        .topupResult,
        .topupError {
          grid-column: 1 / -1;
          margin: 0;
          padding: 12px;
          border-radius: 14px;
          background: rgba(95, 120, 90, 0.12);
          color: #3d5a38;
          white-space: pre-wrap;
        }

        .topupError {
          background: #fff0ed;
          color: #8a1f16;
        }

        .reviewPanel {
          background:
            radial-gradient(circle at top left, rgba(95, 120, 144, 0.12), transparent 38%),
            rgba(251, 246, 234, 0.96);
          border-color: rgba(95, 120, 144, 0.24);
        }

        .reviewIntro {
          margin-bottom: 16px;
        }

        .reviewGrid {
          display: grid;
          gap: 14px;
        }

        .reviewCard {
          border: 1px solid rgba(95, 120, 144, 0.24);
          border-radius: 22px;
          padding: 16px;
          background: rgba(255, 250, 240, 0.94);
          box-shadow: 0 14px 36px rgba(44, 36, 27, 0.06);
          overflow-wrap: anywhere;
        }

        .reviewHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .reviewKicker,
        .miniTitle,
        .actionsRow > span {
          margin: 0;
          color: #5f7890;
          font: 800 11px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .scoreCluster {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .reviewSummary {
          margin: 12px 0 0;
          color: #3d4b58;
          line-height: 1.45;
        }

        .compareGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 12px;
          margin-top: 14px;
        }

        .miniCard {
          border: 1px solid rgba(111, 71, 32, 0.12);
          border-radius: 16px;
          padding: 13px;
          background: rgba(251, 246, 234, 0.82);
        }

        .miniMeta {
          margin: 4px 0 0;
          color: #8a5a2b;
          font: 700 12px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .strongNote {
          color: #2f4858;
        }

        .actionsRow {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(111, 71, 32, 0.12);
        }

        @media (max-width: 900px) {
          .page {
            padding: 18px;
          }

          .controls,
          .split,
          .topupPanel,
          .compareGrid {
            grid-template-columns: 1fr;
          }

          .reviewHeader {
            display: grid;
          }

          .scoreCluster {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
