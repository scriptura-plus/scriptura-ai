import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

type SectionStatus = "ready" | "partial" | "missing" | "hidden";

type OverviewSection = {
  key: string;
  title: string;
  status: SectionStatus;
  visibleCount: number;
  description: string;
  href?: string;
};

type PublishedSetRow = {
  id: string;
  canonical_ref: string | null;
  reference_label: string | null;
  lang: string | null;
  lens_id: string | null;
  status: string | null;
};

type ResearchNoteRow = {
  id: string;
  canonical_ref: string | null;
  lang: string | null;
  note_kind: string | null;
  lens_id: string | null;
  source_kind: string | null;
  status: string | null;
};

type ResearchArticleRow = {
  id: string;
  canonical_ref: string | null;
  lang: string | null;
  article_type: string | null;
  status: string | null;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeReference(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.:]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function statusLabel(status: SectionStatus): string {
  if (status === "ready") return "Готово";
  if (status === "partial") return "Частично";
  if (status === "hidden") return "Есть материал";
  return "Пусто";
}

function statusClass(status: SectionStatus): string {
  return `status ${status}`;
}

function buildHref(path: string, canonicalRef: string, lang: string): string {
  const params = new URLSearchParams();
  params.set("canonical_ref", canonicalRef);
  params.set("lang", lang);
  return `${path}?${params.toString()}`;
}

function buildTechnicalHref(reference: string, lang: string): string {
  const params = new URLSearchParams();
  params.set("reference", reference);
  params.set("lang", lang);
  return `/admin/studio/verse-public-inventory?${params.toString()}`;
}

function sectionStatus(visibleCount: number, hiddenCount = 0): SectionStatus {
  if (visibleCount > 0) return "ready";
  if (hiddenCount > 0) return "hidden";
  return "missing";
}

function countByLens(sets: PublishedSetRow[], lensId: string): number {
  return sets.filter((set) => set.lens_id === lensId && set.status === "published").length;
}

function countNotes(notes: ResearchNoteRow[], lensId: string): number {
  return notes.filter((note) => note.lens_id === lensId && note.status !== "deleted").length;
}

function countArticles(articles: ResearchArticleRow[], articleTypes: string[]): number {
  return articles.filter((article) => {
    if (article.status === "deleted" || article.status === "archived") return false;
    return article.article_type ? articleTypes.includes(article.article_type) : false;
  }).length;
}

export default async function VerseOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const referenceParam = firstParam(params.reference);
  const canonicalParam = firstParam(params.canonical_ref);
  const lang = firstParam(params.lang) ?? "ru";
  const canonicalRef = normalizeReference(canonicalParam ?? referenceParam ?? "john-17-3");
  const referenceLabel = referenceParam ?? canonicalParam ?? canonicalRef;

  const supabase = createAdminClient();

  let errorMessage = "";
  let publishedSets: PublishedSetRow[] = [];
  let researchNotes: ResearchNoteRow[] = [];
  let researchArticles: ResearchArticleRow[] = [];

  if (!supabase) {
    errorMessage = "Supabase admin client is unavailable.";
  } else {
    const [setsResult, notesResult, articlesResult] = await Promise.all([
      supabase
        .from("published_lens_sets")
        .select("id, canonical_ref, reference_label, lang, lens_id, status")
        .eq("canonical_ref", canonicalRef)
        .eq("lang", lang),
      supabase
        .from("research_notes")
        .select("id, canonical_ref, lang, note_kind, lens_id, source_kind, status")
        .eq("canonical_ref", canonicalRef)
        .eq("lang", lang),
      supabase
        .from("research_articles")
        .select("id, canonical_ref, lang, article_type, status")
        .eq("canonical_ref", canonicalRef)
        .eq("lang", lang),
    ]);

    if (setsResult.error) errorMessage = setsResult.error.message;
    if (notesResult.error) errorMessage = notesResult.error.message;
    if (articlesResult.error) errorMessage = articlesResult.error.message;

    publishedSets = (setsResult.data ?? []) as PublishedSetRow[];
    researchNotes = (notesResult.data ?? []) as ResearchNoteRow[];
    researchArticles = (articlesResult.data ?? []) as ResearchArticleRow[];
  }

  const bestReference =
    publishedSets.find((set) => set.reference_label)?.reference_label ??
    referenceLabel;

  const observationCount =
    countNotes(researchNotes, "pearl") ||
    countByLens(publishedSets, "pearl");

  const lexiconCount =
    countNotes(researchNotes, "word") ||
    countByLens(publishedSets, "word") ||
    countByLens(publishedSets, "lexicon");

  const translationsCount =
    countNotes(researchNotes, "translations") ||
    countByLens(publishedSets, "translations");

  const contextCount =
    countNotes(researchNotes, "context") ||
    countByLens(publishedSets, "context");

  const articlesCount = countArticles(researchArticles, [
    "expanded",
    "expanded_article",
    "text_findings",
    "historical_scene",
    "scripture_links",
    "context",
  ]);

  const sections: OverviewSection[] = [
    {
      key: "observations",
      title: "Наблюдения",
      status: sectionStatus(observationCount),
      visibleCount: observationCount,
      description:
        observationCount > 0
          ? "Карточки наблюдений уже доступны для чтения в рабочем разделе."
          : "Пока нет сохранённых карточек наблюдений для этого стиха.",
      href: buildHref("/admin/studio/verse-notes", canonicalRef, lang),
    },
    {
      key: "lexicon",
      title: "Лексика",
      status: sectionStatus(lexiconCount),
      visibleCount: lexiconCount,
      description:
        lexiconCount > 0
          ? "Есть лексические материалы или опубликованный лексический слой."
          : "Лексический раздел пока не готов для этого стиха.",
    },
    {
      key: "translations",
      title: "Переводы",
      status: sectionStatus(translationsCount),
      visibleCount: translationsCount,
      description:
        translationsCount > 0
          ? "Есть материалы, связанные с переводом и вариантами передачи мысли."
          : "Раздел переводов пока пуст.",
    },
    {
      key: "context",
      title: "Контекст",
      status: sectionStatus(contextCount),
      visibleCount: contextCount,
      description:
        contextCount > 0
          ? "Есть материалы, помогающие увидеть ближайший контекст стиха."
          : "Контекстный раздел пока пуст.",
    },
    {
      key: "articles",
      title: "Статьи / Углубления",
      status: sectionStatus(articlesCount),
      visibleCount: articlesCount,
      description:
        articlesCount > 0
          ? "Есть длинные материалы или углубления по этому стиху."
          : "Длинные материалы пока не подготовлены.",
    },
  ];

  const readySections = sections.filter((section) => section.status === "ready").length;
  const emptySections = sections.filter((section) => section.status === "missing").length;

  return (
    <main className="page">
      <div className="top">
        <Link href="/admin/studio/verse">← Кабинет стиха</Link>
      </div>

      <section className="hero">
        <p className="eyebrow">Обзор стиха · read-only</p>
        <h1>{bestReference}</h1>
        <p>
          {canonicalRef} · {lang}
        </p>
      </section>

      {errorMessage ? <section className="error">{errorMessage}</section> : null}

      <section className="summary">
        <p className="kicker">Что сейчас доступно</p>
        <strong>
          Готовых разделов: {readySections}. Пустых разделов: {emptySections}.
        </strong>
        <p>
          Этот экран показывает человеческую сводку по стиху. Техническая диагностика
          остаётся отдельно и не смешивается с рабочим обзором.
        </p>
      </section>

      <section className="sections">
        {sections.map((section) => {
          const card = (
            <article className="sectionCard">
              <div className="sectionTop">
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
                <span className={statusClass(section.status)}>
                  {statusLabel(section.status)}
                </span>
              </div>

              <div className="countLine">
                <strong>{section.visibleCount}</strong>
                <span>видимых материалов</span>
              </div>

              {section.href ? <span className="openHint">Открыть раздел →</span> : null}
            </article>
          );

          return section.href ? (
            <Link className="cardLink" href={section.href} key={section.key}>
              {card}
            </Link>
          ) : (
            <div key={section.key}>{card}</div>
          );
        })}
      </section>

      <section className="links">
        <Link href={buildHref("/admin/studio/verse-notes", canonicalRef, lang)}>
          Открыть Наблюдения
        </Link>

        <Link href={buildTechnicalHref(bestReference, lang)}>
          Техническая диагностика
        </Link>
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          padding: 48px;
          background: #f6ead7;
          color: #24180e;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .top,
        .hero,
        .summary,
        .sections,
        .links,
        .error {
          max-width: 1040px;
          margin-left: auto;
          margin-right: auto;
        }

        .top {
          margin-bottom: 34px;
        }

        a {
          color: #8a4f18;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }

        .hero {
          margin-bottom: 24px;
        }

        .eyebrow,
        .kicker {
          margin: 0 0 8px;
          color: #85613f;
          font-size: 14px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: clamp(42px, 6vw, 70px);
          line-height: 1.02;
        }

        .hero p {
          margin: 14px 0 0;
          color: #5d4934;
          font-size: 20px;
        }

        .summary,
        .error {
          padding: 24px;
          margin-bottom: 22px;
          border-radius: 24px;
          border: 1px solid rgba(120, 84, 45, 0.18);
          background: rgba(255, 250, 241, 0.62);
        }

        .summary strong {
          display: block;
          margin-bottom: 8px;
          font-size: 25px;
        }

        .summary p {
          margin: 0;
          color: #5d4934;
          font-size: 17px;
          line-height: 1.55;
        }

        .error {
          color: #9a2f19;
          background: #fff4ed;
        }

        .sections {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .cardLink {
          color: inherit;
          text-decoration: none;
        }

        .cardLink:hover {
          text-decoration: none;
        }

        .sectionCard {
          min-height: 188px;
          padding: 24px;
          border-radius: 24px;
          border: 1px solid rgba(120, 84, 45, 0.18);
          background: rgba(255, 253, 248, 0.88);
          box-shadow: 0 14px 36px rgba(54, 36, 18, 0.07);
        }

        .cardLink .sectionCard:hover {
          border-color: rgba(138, 79, 24, 0.55);
          transform: translateY(-1px);
        }

        .sectionTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        h2 {
          margin: 0 0 10px;
          font-size: 28px;
        }

        .sectionTop p {
          margin: 0;
          color: #5d4934;
          font-size: 17px;
          line-height: 1.48;
        }

        .status {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 8px 11px;
          background: #eee2d0;
          color: #5f4c36;
          font-size: 13px;
          white-space: nowrap;
        }

        .status.ready {
          background: #dbeedc;
          color: #235827;
        }

        .status.partial,
        .status.hidden {
          background: #fff0c7;
          color: #745000;
        }

        .status.missing {
          background: #f4d7cf;
          color: #7c2d1d;
        }

        .countLine {
          display: flex;
          gap: 10px;
          align-items: baseline;
          margin-top: 22px;
        }

        .countLine strong {
          font-size: 34px;
        }

        .countLine span {
          color: #6d5a45;
        }

        .openHint {
          display: inline-block;
          margin-top: 18px;
          color: #8a4f18;
          font-weight: 700;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }

        .links a {
          padding: 11px 14px;
          border-radius: 999px;
          background: rgba(255, 250, 241, 0.72);
          border: 1px solid rgba(120, 84, 45, 0.18);
        }

        @media (max-width: 820px) {
          .page {
            padding: 28px 18px;
          }

          .sections {
            grid-template-columns: 1fr;
          }

          .sectionTop {
            display: grid;
          }
        }
      `}</style>
    </main>
  );
}
