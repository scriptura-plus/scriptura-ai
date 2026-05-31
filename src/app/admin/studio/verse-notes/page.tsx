import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

type ResearchNoteRow = {
  id: string;
  reference: string | null;
  canonical_ref: string | null;
  lang: string | null;
  title: string | null;
  anchor: string | null;
  summary: string | null;
  body: string | null;
  score: number | null;
  source_kind: string | null;
  created_at: string | null;
  content_json: unknown;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function prettyJson(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getPosition(row: ResearchNoteRow): number | null {
  return asNumber(asRecord(row.content_json).position);
}

function getReviewStatus(row: ResearchNoteRow): string {
  return asText(asRecord(row.content_json).review_status) ?? "unknown";
}

function getWhyItMatters(row: ResearchNoteRow): string | null {
  return asText(asRecord(row.content_json).why_it_matters) ?? row.summary;
}

function compareRows(a: ResearchNoteRow, b: ResearchNoteRow): number {
  const posA = getPosition(a) ?? 999999;
  const posB = getPosition(b) ?? 999999;
  if (posA !== posB) return posA - posB;

  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return timeA - timeB;
}

function buildHref(args: {
  canonicalRef: string;
  lang: string;
  reviewStatus?: string | null;
  sourceKind?: string | null;
  minScore?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("canonical_ref", args.canonicalRef);
  params.set("lang", args.lang);

  if (args.reviewStatus) params.set("review_status", args.reviewStatus);
  if (args.sourceKind) params.set("source_kind", args.sourceKind);
  if (args.minScore) params.set("min_score", args.minScore);

  return `/admin/studio/verse-notes?${params.toString()}`;
}

export default async function VerseNotesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const canonicalRef = firstParam(params.canonical_ref) ?? "john-17-3";
  const lang = firstParam(params.lang) ?? "ru";
  const reviewStatus = firstParam(params.review_status);
  const sourceKind = firstParam(params.source_kind);
  const minScoreRaw = firstParam(params.min_score);
  const minScore = asNumber(minScoreRaw);

  const supabase = createAdminClient();

  let rows: ResearchNoteRow[] = [];
  let errorMessage = "";

  if (!supabase) {
    errorMessage = "Supabase admin client is unavailable.";
  } else {
    let query = supabase
      .from("research_notes")
      .select(
        "id, reference, canonical_ref, lang, title, anchor, summary, body, score, source_kind, created_at, content_json"
      )
      .eq("note_kind", "generated_observation_card")
      .eq("lens_id", "pearl")
      .eq("canonical_ref", canonicalRef)
      .eq("lang", lang)
      .limit(200);

    if (sourceKind) {
      query = query.eq("source_kind", sourceKind);
    }

    if (typeof minScore === "number") {
      query = query.gte("score", minScore);
    }

    const { data, error } = await query;

    if (error) {
      errorMessage = error.message;
    } else {
      rows = ((data ?? []) as ResearchNoteRow[])
        .filter((row) => {
          if (!reviewStatus) return true;
          return getReviewStatus(row) === reviewStatus;
        })
        .sort(compareRows);
    }
  }

  const examples = ["john-17-3", "john-3-16", "malachi-3-10", "nahum-1-7"];
  const activeFilters = [
    reviewStatus ? `review_status=${reviewStatus}` : null,
    sourceKind ? `source_kind=${sourceKind}` : null,
    typeof minScore === "number" ? `min_score=${minScore}` : null,
  ].filter(Boolean);

  return (
    <main className="page">
      <div className="top">
        <Link href="/admin/studio/research-notes">← Research notes</Link>
      </div>

      <section className="hero">
        <p className="eyebrow">Verse Workspace v1 · Read-only</p>
        <h1>
          {canonicalRef} · {rows.length} notes
        </h1>
        <p>
          Observation cards are read from <code>research_notes</code>. This
          screen does not edit, publish, reorder, or write anything.
        </p>
      </section>

      <section className="examples">
        <span>Examples:</span>
        {examples.map((ref) => (
          <Link
            key={ref}
            href={buildHref({
              canonicalRef: ref,
              lang,
              reviewStatus,
              sourceKind,
              minScore: minScoreRaw,
            })}
          >
            {ref}
          </Link>
        ))}
      </section>

      <section className="filters">
        <form>
          <label>
            canonical_ref
            <input name="canonical_ref" defaultValue={canonicalRef} />
          </label>

          <label>
            lang
            <select name="lang" defaultValue={lang}>
              <option value="ru">ru</option>
              <option value="en">en</option>
              <option value="es">es</option>
            </select>
          </label>

          <label>
            review_status
            <input
              name="review_status"
              placeholder="backfilled_from_published"
              defaultValue={reviewStatus ?? ""}
            />
          </label>

          <label>
            source_kind
            <input
              name="source_kind"
              placeholder="published_lens_cards_backfill"
              defaultValue={sourceKind ?? ""}
            />
          </label>

          <label>
            min_score
            <input
              name="min_score"
              type="number"
              min="0"
              max="100"
              placeholder="90"
              defaultValue={minScoreRaw ?? ""}
            />
          </label>

          <button type="submit">Apply filters</button>
        </form>

        <div className="filterSummary">
          {activeFilters.length > 0 ? (
            <span>Active filters: {activeFilters.join(" · ")}</span>
          ) : (
            <span>No optional filters active.</span>
          )}
        </div>
      </section>

      <section className="summary">
        <div>
          <strong>{canonicalRef}</strong>
          <span>lang: {lang}</span>
        </div>
        <div>
          <strong>{rows.length}</strong>
          <span>found notes</span>
        </div>
      </section>

      {errorMessage ? <div className="error">{errorMessage}</div> : null}

      <section className="cards">
        {rows.length === 0 && !errorMessage ? (
          <article className="empty">No cards found for the current filters.</article>
        ) : null}

        {rows.map((row, index) => {
          const json = asRecord(row.content_json);
          const position = getPosition(row) ?? index + 1;
          const whyItMatters = getWhyItMatters(row);
          const review = getReviewStatus(row);
          const scorerReasoning = asText(json.scorer_reasoning);
          const weaknessRoot = asText(json.weakness_root);
          const weaknessDetail = asText(json.weakness_detail);
          const sourceAngle = json.source_angle;
          const rawScore = json.raw_score;

          return (
            <details className="card" key={row.id}>
              <summary>
                <div className="cardTop">
                  <div>
                    <p className="meta">
                      #{position} | {row.reference ?? "no reference"} |{" "}
                      {row.canonical_ref ?? "no canonical_ref"}
                    </p>
                    <h2>{row.title ?? "Untitled"}</h2>
                    <p className="anchorLine">{row.anchor ?? "—"}</p>
                  </div>

                  <div className="score">
                    <span>score</span>
                    <strong>{row.score ?? "—"}</strong>
                  </div>
                </div>

                <div className="badges">
                  <span>review: {review}</span>
                  <span>source: {row.source_kind ?? "unknown"}</span>
                </div>
              </summary>

              <div className="expanded">
                <div className="field">
                  <h3>Body / observation</h3>
                  <p>{row.body ?? "—"}</p>
                </div>

                <div className="field">
                  <h3>Why it matters / summary</h3>
                  <p>{whyItMatters ?? "—"}</p>
                </div>

                <div className="field">
                  <h3>Scorer reasoning</h3>
                  <p>{scorerReasoning ?? "—"}</p>
                </div>

                <div className="field">
                  <h3>Weakness</h3>
                  <p>
                    <strong>{weaknessRoot ?? "—"}</strong>
                    {weaknessDetail ? ` — ${weaknessDetail}` : ""}
                  </p>
                </div>

                <div className="grid">
                  <div className="jsonBlock">
                    <h3>source_angle</h3>
                    <pre>{prettyJson(sourceAngle) || "—"}</pre>
                  </div>

                  <div className="jsonBlock">
                    <h3>raw_score</h3>
                    <pre>{prettyJson(rawScore) || "—"}</pre>
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          padding: 48px;
          background: #f6ead7;
          color: #24180e;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .top {
          margin-bottom: 36px;
        }

        a {
          color: #8a4f18;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }

        .hero {
          max-width: 1040px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #85613f;
          margin-bottom: 8px;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0 0 16px;
          font-size: clamp(34px, 5vw, 52px);
          line-height: 1.05;
        }

        .hero p {
          font-size: 19px;
          line-height: 1.6;
        }

        code {
          background: rgba(255,255,255,0.55);
          padding: 2px 6px;
          border-radius: 6px;
        }

        .examples {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin: 0 0 24px;
          font-size: 16px;
        }

        .examples span {
          color: #6d5a45;
        }

        .filters {
          max-width: 1040px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid rgba(120, 84, 45, 0.18);
          border-radius: 20px;
          background: rgba(255, 250, 241, 0.48);
        }

        .filters form {
          display: grid;
          grid-template-columns: repeat(5, minmax(120px, 1fr)) auto;
          gap: 12px;
          align-items: end;
        }

        label {
          display: grid;
          gap: 6px;
          color: #6d5a45;
          font-size: 13px;
        }

        input,
        select,
        button {
          min-height: 38px;
          border: 1px solid rgba(120, 84, 45, 0.28);
          border-radius: 10px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.72);
          color: #24180e;
          font: inherit;
        }

        button {
          cursor: pointer;
          background: #8a4f18;
          color: white;
          border-color: #8a4f18;
        }

        .filterSummary {
          margin-top: 12px;
          color: #6d5a45;
          font-size: 14px;
        }

        .summary {
          max-width: 1040px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 24px;
          margin-bottom: 28px;
          border: 1px solid rgba(120, 84, 45, 0.18);
          border-radius: 20px;
          background: rgba(255, 250, 241, 0.48);
        }

        .summary div {
          display: grid;
          gap: 6px;
        }

        .summary strong {
          font-size: 24px;
        }

        .summary span {
          color: #6d5a45;
        }

        .error,
        .empty {
          max-width: 1040px;
          padding: 18px 22px;
          border-radius: 16px;
          background: #fff6f0;
          color: #a33a20;
          border: 1px solid rgba(163, 58, 32, 0.25);
        }

        .cards {
          max-width: 1040px;
          display: grid;
          gap: 18px;
        }

        .card {
          padding: 0;
          border-radius: 22px;
          background: rgba(255, 253, 248, 0.86);
          border: 1px solid rgba(120, 84, 45, 0.18);
          box-shadow: 0 14px 36px rgba(54, 36, 18, 0.08);
          overflow: hidden;
        }

        .card > summary {
          list-style: none;
          cursor: pointer;
          padding: 24px;
        }

        .card > summary::-webkit-details-marker {
          display: none;
        }

        .cardTop {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .meta {
          margin: 0 0 10px;
          color: #6f7b88;
          font-size: 15px;
        }

        h2 {
          margin: 0;
          font-size: 25px;
          line-height: 1.25;
        }

        .anchorLine {
          margin: 10px 0 0;
          color: #5a4630;
          font-size: 17px;
          line-height: 1.45;
        }

        .score {
          min-width: 72px;
          padding: 12px;
          text-align: center;
          border-radius: 16px;
          background: #f6ead7;
        }

        .score span {
          display: block;
          color: #7a6650;
          font-size: 12px;
          text-transform: uppercase;
        }

        .score strong {
          font-size: 25px;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .badges span {
          padding: 7px 10px;
          border-radius: 999px;
          background: #f4eadb;
          color: #6d5a45;
          font-size: 13px;
        }

        .expanded {
          padding: 0 24px 24px;
          border-top: 1px solid rgba(120, 84, 45, 0.12);
        }

        .field {
          margin-top: 20px;
        }

        .field h3,
        .jsonBlock h3 {
          margin: 0 0 8px;
          font-size: 15px;
          color: #6d5a45;
        }

        .field p {
          margin: 0;
          font-size: 18px;
          line-height: 1.62;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 20px;
        }

        pre {
          max-height: 360px;
          overflow: auto;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          margin: 0;
          padding: 14px;
          border-radius: 14px;
          background: #f4eadb;
          font-size: 13px;
          line-height: 1.45;
        }

        @media (max-width: 900px) {
          .filters form,
          .grid {
            grid-template-columns: 1fr;
          }

          .summary,
          .cardTop {
            display: grid;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 28px 18px;
          }
        }
      `}</style>
    </main>
  );
}
