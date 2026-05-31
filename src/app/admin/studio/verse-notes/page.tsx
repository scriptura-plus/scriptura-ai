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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

export default async function VerseNotesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const canonicalRef = firstParam(params.canonical_ref) ?? "john-17-3";
  const lang = firstParam(params.lang) ?? "ru";

  const supabase = createAdminClient();

  let rows: ResearchNoteRow[] = [];
  let errorMessage = "";

  if (!supabase) {
    errorMessage = "Supabase admin client is unavailable.";
  } else {
    const { data, error } = await supabase
      .from("research_notes")
      .select(
        "id, reference, canonical_ref, lang, title, anchor, summary, body, score, source_kind, created_at, content_json"
      )
      .eq("note_kind", "generated_observation_card")
      .eq("lens_id", "pearl")
      .eq("canonical_ref", canonicalRef)
      .eq("lang", lang)
      .limit(200);

    if (error) {
      errorMessage = error.message;
    } else {
      rows = ((data ?? []) as ResearchNoteRow[]).sort(compareRows);
    }
  }

  const examples = ["john-17-3", "john-3-16", "malachi-3-10", "nahum-1-7"];

  return (
    <main className="page">
      <div className="top">
        <Link href="/admin/studio/research-notes">? Research notes</Link>
      </div>

      <section className="hero">
        <p className="eyebrow">Read-only Verse Notes Workspace</p>
        <h1>
          {canonicalRef} · {rows.length} notes
        </h1>
        <p>
          Cards are read from <code>research_notes</code> only. No editing,
          publishing, sorting, or write operations.
        </p>
      </section>

      <section className="examples">
        <span>Examples:</span>
        {examples.map((ref) => (
          <Link
            key={ref}
            href={`/admin/studio/verse-notes?canonical_ref=${ref}&lang=${lang}`}
          >
            {ref}
          </Link>
        ))}
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
          <article className="empty">No cards found for this verse.</article>
        ) : null}

        {rows.map((row, index) => {
          const position = getPosition(row) ?? index + 1;
          const whyItMatters = getWhyItMatters(row);
          const reviewStatus = getReviewStatus(row);

          return (
            <article className="card" key={row.id}>
              <div className="cardTop">
                <div>
                  <p className="meta">
                    #{position} | {row.reference ?? "no reference"} |{" "}
                    {row.canonical_ref ?? "no canonical_ref"}
                  </p>
                  <h2>{row.title ?? "Untitled"}</h2>
                </div>

                <div className="score">
                  <span>score</span>
                  <strong>{row.score ?? "—"}</strong>
                </div>
              </div>

              <div className="field">
                <h3>Anchor</h3>
                <p>{row.anchor ?? "—"}</p>
              </div>

              <div className="field">
                <h3>Body / observation</h3>
                <p>{row.body ?? "—"}</p>
              </div>

              <div className="field">
                <h3>Why it matters / summary</h3>
                <p>{whyItMatters ?? "—"}</p>
              </div>

              <div className="badges">
                <span>review: {reviewStatus}</span>
                <span>source: {row.source_kind ?? "unknown"}</span>
              </div>
            </article>
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

        .top a,
        .examples a {
          color: #8a4f18;
          text-decoration: none;
        }

        .top a:hover,
        .examples a:hover {
          text-decoration: underline;
        }

        .hero {
          max-width: 980px;
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

        .summary {
          max-width: 980px;
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
          max-width: 980px;
          padding: 18px 22px;
          border-radius: 16px;
          background: #fff6f0;
          color: #a33a20;
          border: 1px solid rgba(163, 58, 32, 0.25);
        }

        .cards {
          max-width: 980px;
          display: grid;
          gap: 24px;
        }

        .card {
          padding: 28px;
          border-radius: 22px;
          background: rgba(255, 253, 248, 0.86);
          border: 1px solid rgba(120, 84, 45, 0.18);
          box-shadow: 0 14px 36px rgba(54, 36, 18, 0.08);
        }

        .cardTop {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .meta {
          margin: 0 0 12px;
          color: #6f7b88;
          font-size: 15px;
        }

        h2 {
          margin: 0;
          font-size: 28px;
          line-height: 1.25;
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

        .field {
          margin-top: 18px;
        }

        .field h3 {
          margin: 0 0 8px;
          font-size: 16px;
        }

        .field p {
          margin: 0;
          font-size: 19px;
          line-height: 1.65;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }

        .badges span {
          padding: 7px 10px;
          border-radius: 999px;
          background: #f4eadb;
          color: #6d5a45;
          font-size: 13px;
        }

        @media (max-width: 720px) {
          .page {
            padding: 28px 18px;
          }

          .summary,
          .cardTop {
            display: grid;
          }

          .card {
            padding: 22px;
          }
        }
      `}</style>
    </main>
  );
}
