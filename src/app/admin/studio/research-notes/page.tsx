import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

type SearchParams = {
  canonical_ref?: string;
  lang?: string;
  limit?: string;
};

type ResearchNoteRow = {
  id: string;
  created_at: string | null;
  reference: string;
  canonical_ref: string | null;
  lang: string;
  note_kind: string;
  lens_id: string | null;
  source_kind: string | null;
  protocol_version: string | null;
  legacy_table: string | null;
  legacy_id: string | null;
  title: string | null;
  anchor: string | null;
  summary: string | null;
  body: string | null;
  status: string;
  score: number | null;
  evidence_level: string | null;
  content_json: {
    review_status?: string;
    published_set_id?: string;
    published_card_id?: string;
    position?: number;
    source_pipeline?: string;
    source_model?: string;
    [key: string]: unknown;
  } | null;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(200, Math.round(parsed)));
}

function getLang(value: string | undefined): string {
  if (value === "en" || value === "es" || value === "ru") return value;
  return "ru";
}

function truncate(value: string | null, max = 420): string {
  if (!value) return "â€”";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}â€¦`;
}

export default async function ResearchNotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const canonicalRef = getString(params.canonical_ref).trim();
  const lang = getLang(params.lang);
  const limit = getLimit(params.limit);

  const supabase = createAdminClient();

  let rows: ResearchNoteRow[] = [];
  let errorMessage: string | null = null;

  if (!supabase) {
    errorMessage = "Supabase admin client is unavailable.";
  } else {
    let query = supabase
      .from("research_notes")
      .select(
        [
          "id",
          "created_at",
          "reference",
          "canonical_ref",
          "lang",
          "note_kind",
          "lens_id",
          "source_kind",
          "protocol_version",
          "legacy_table",
          "legacy_id",
          "title",
          "anchor",
          "summary",
          "body",
          "status",
          "score",
          "evidence_level",
          "content_json",
        ].join(",")
      )
      .eq("note_kind", "generated_observation_card")
      .eq("lens_id", "pearl")
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (canonicalRef) {
      query = query.eq("canonical_ref", canonicalRef);
    }

    const { data, error } = await query;

    if (error) {
      errorMessage = error.message;
    } else {
      rows = (data ?? []) as unknown as ResearchNoteRow[];
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <Link className="backLink" href="/admin/studio">
          â† Studio
        </Link>
        <p className="eyebrow">Read-only diagnostic</p>
        <h1>Generated Observation Notes</h1>
        <p className="subtitle">
          Ð”Ð¸Ð°Ð³Ð½Ð¾ÑÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹ ÑÐºÑ€Ð°Ð½ Ð´Ð»Ñ research_notes Ñ note_kind =
          generated_observation_card. Ð—Ð´ÐµÑÑŒ Ð½ÐµÑ‚ Ñ€ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ, Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸Ð¸,
          ÑÐ¾Ñ€Ñ‚Ð¸Ñ€Ð¾Ð²ÐºÐ¸ Ð¸Ð»Ð¸ Ð·Ð°Ð¿Ð¸ÑÐ¸ Ð´Ð°Ð½Ð½Ñ‹Ñ….
        </p>
      </section>

      <section className="panel">
        <form className="filters">
          <label>
            canonical_ref
            <input
              name="canonical_ref"
              placeholder="nahum-1-7"
              defaultValue={canonicalRef}
            />
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
            limit
            <input name="limit" type="number" min="1" max="200" defaultValue={limit} />
          </label>

          <button type="submit">ÐŸÐ¾ÐºÐ°Ð·Ð°Ñ‚ÑŒ</button>
        </form>

        <div className="summary">
          <strong>{rows.length}</strong> rows Â· note_kind: generated_observation_card Â·
          lens_id: pearl
        </div>

        {errorMessage && <div className="error">{errorMessage}</div>}
      </section>

      <section className="list" aria-label="Generated observation notes">
        {rows.length === 0 && !errorMessage ? (
          <article className="empty">ÐÐµÑ‚ ÑÑ‚Ñ€Ð¾Ðº Ð¿Ð¾ Ñ‚ÐµÐºÑƒÑ‰ÐµÐ¼Ñƒ Ñ„Ð¸Ð»ÑŒÑ‚Ñ€Ñƒ.</article>
        ) : null}

        {rows.map((row) => {
          const json = row.content_json ?? {};
          return (
            <article className="noteCard" key={row.id}>
              <div className="noteTop">
                <div>
                  <p className="meta">
                    {row.reference} Â· {row.canonical_ref ?? "no canonical_ref"} Â·{" "}
                    {row.lang}
                  </p>
                  <h2>{row.title ?? "Ð‘ÐµÐ· Ð·Ð°Ð³Ð¾Ð»Ð¾Ð²ÐºÐ°"}</h2>
                </div>
                <div className="scoreBox">
                  <span>score</span>
                  <strong>{row.score ?? "â€”"}</strong>
                </div>
              </div>

              <div className="grid">
                <div>
                  <h3>ÐžÐ¿Ð¾Ñ€Ð°</h3>
                  <p>{row.anchor ?? "â€”"}</p>
                </div>
                <div>
                  <h3>ÐŸÐ¾Ñ‡ÐµÐ¼Ñƒ Ð²Ð°Ð¶Ð½Ð¾ / summary</h3>
                  <p>{row.summary ?? "â€”"}</p>
                </div>
              </div>

              <div className="bodyBlock">
                <h3>Body</h3>
                <p>{truncate(row.body)}</p>
              </div>

              <div className="chips">
                <span>status: {row.status}</span>
                <span>review: {json.review_status ?? "â€”"}</span>
                <span>source: {row.source_kind ?? "â€”"}</span>
                <span>protocol: {row.protocol_version ?? "â€”"}</span>
                <span>evidence: {row.evidence_level ?? "â€”"}</span>
              </div>

              <details>
                <summary>Provenance</summary>
                <dl>
                  <div>
                    <dt>created_at</dt>
                    <dd>{row.created_at ?? "â€”"}</dd>
                  </div>
                  <div>
                    <dt>legacy</dt>
                    <dd>
                      {row.legacy_table ?? "â€”"} / {row.legacy_id ?? "â€”"}
                    </dd>
                  </div>
                  <div>
                    <dt>published_set_id</dt>
                    <dd>{json.published_set_id ?? "â€”"}</dd>
                  </div>
                  <div>
                    <dt>published_card_id</dt>
                    <dd>{json.published_card_id ?? "â€”"}</dd>
                  </div>
                  <div>
                    <dt>position</dt>
                    <dd>{json.position ?? "â€”"}</dd>
                  </div>
                  <div>
                    <dt>source_pipeline</dt>
                    <dd>{json.source_pipeline ?? "â€”"}</dd>
                  </div>
                  <div>
                    <dt>source_model</dt>
                    <dd>{json.source_model ?? "â€”"}</dd>
                  </div>
                </dl>
              </details>
            </article>
          );
        })}
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          padding: 32px;
          background: #f7efe2;
          color: #2b241b;
          font-family:
            ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        }

        .hero,
        .panel,
        .list {
          max-width: 1180px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          margin-bottom: 18px;
        }

        .backLink {
          display: inline-flex;
          margin-bottom: 16px;
          color: #496f8f;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-weight: 700;
          text-decoration: none;
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

        .subtitle {
          max-width: 860px;
          margin: 12px 0 0;
          color: #66533e;
          font-size: 17px;
          line-height: 1.5;
        }

        .panel,
        .noteCard,
        .empty {
          border: 1px solid rgba(109, 82, 51, 0.16);
          border-radius: 22px;
          background: rgba(255, 252, 246, 0.94);
          box-shadow: 0 16px 42px rgba(92, 66, 36, 0.08);
        }

        .panel {
          padding: 18px;
          margin-bottom: 16px;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 140px 130px auto;
          gap: 12px;
          align-items: end;
        }

        label {
          display: grid;
          gap: 6px;
          color: #66533e;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        select {
          border: 1px solid rgba(109, 82, 51, 0.22);
          border-radius: 12px;
          padding: 10px 12px;
          background: white;
          color: #2b241b;
          font: inherit;
        }

        button {
          border: 0;
          border-radius: 12px;
          padding: 11px 16px;
          background: #496f8f;
          color: white;
          font-weight: 800;
          cursor: pointer;
        }

        .summary {
          margin-top: 14px;
          color: #66533e;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 14px;
        }

        .error {
          margin-top: 14px;
          color: #9b1c1c;
          font-weight: 700;
        }

        .list {
          display: grid;
          gap: 14px;
        }

        .empty,
        .noteCard {
          padding: 18px;
        }

        .noteTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .meta {
          margin: 0 0 6px;
          color: #7e6143;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 13px;
          font-weight: 700;
        }

        h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
        }

        .scoreBox {
          min-width: 72px;
          border-radius: 16px;
          background: #eee2d0;
          padding: 10px 12px;
          text-align: center;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .scoreBox span {
          display: block;
          color: #7a6650;
          font-size: 11px;
          text-transform: uppercase;
        }

        .scoreBox strong {
          display: block;
          margin-top: 2px;
          font-size: 22px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 14px;
        }

        h3 {
          margin: 0 0 6px;
          color: #7e6143;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        p {
          margin: 0;
          color: #4f402f;
          font-size: 16px;
          line-height: 1.55;
        }

        .bodyBlock {
          margin-bottom: 14px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 12px;
        }

        .chips span {
          border-radius: 999px;
          background: #eee2d0;
          color: #5f4c36;
          padding: 7px 10px;
        }

        details {
          border-top: 1px solid rgba(109, 82, 51, 0.14);
          padding-top: 10px;
        }

        summary {
          cursor: pointer;
          color: #496f8f;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-weight: 800;
        }

        dl {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 14px;
          margin: 12px 0 0;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 13px;
        }

        dl div {
          min-width: 0;
        }

        dt {
          color: #7e6143;
          font-weight: 800;
        }

        dd {
          margin: 3px 0 0;
          color: #2b241b;
          overflow-wrap: anywhere;
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .filters,
          .grid,
          dl {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 32px;
          }

          .noteTop {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

