"use client";

import { useEffect, useMemo, useState } from "react";

type InventoryResponse = {
  ok?: boolean;
  mode?: string;
  generated?: boolean;
  reference?: string;
  canonical_ref?: string | null;
  lang?: string;
  sections?: {
    observations?: InventorySection;
    lexicon?: InventorySection;
    translations?: InventorySection;
    context?: InventorySection;
    expanded_articles?: InventorySection;
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
  relationConfidence?: string;
  wouldGenerateIfOpenedPublicly?: boolean;
  canOpenReadOnly?: boolean;
  notes?: string[];
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Готово",
  partial: "Частично",
  missing: "Пусто",
  legacy_only: "Только старый кэш",
  generated_but_not_published: "Есть материал",
};

const SECTION_TITLES = {
  observations: "Наблюдения",
  lexicon: "Лексика",
  translations: "Переводы",
  context: "Контекст",
  expanded: "Развернутые статьи",
  textFindings: "Текстовые находки",
  historicalScene: "Историческая сцена",
  scriptureLinks: "Связи с другими стихами",
};

function n(section: InventorySection | undefined, key: string): number {
  const value = section?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function publicVisibleCount(section?: InventorySection): number {
  return n(section, "publishedCards") || n(section, "researchArticles") || n(section, "activeResearchArticles");
}

function hiddenMaterialCount(section?: InventorySection): number {
  return n(section, "researchArticles") + n(section, "lensDiscoveryActive") + n(section, "cachedResults");
}

function statusText(status?: string): string {
  if (!status) return "Неизвестно";
  return STATUS_LABELS[status] ?? status;
}

function statusClass(status?: string): string {
  if (status === "ready") return "status ready";
  if (status === "partial" || status === "generated_but_not_published") return "status partial";
  if (status === "legacy_only") return "status legacy";
  if (status === "missing") return "status missing";
  return "status";
}

function boolText(value?: boolean): string {
  return value ? "да" : "нет";
}

function itemWord(title: string): string {
  if (title === SECTION_TITLES.observations) return "наблюдений";
  if (title === SECTION_TITLES.lexicon) return "лексических материалов";
  if (title === SECTION_TITLES.translations) return "материалов по переводам";
  if (title === SECTION_TITLES.context) return "контекстных материалов";
  return "статей";
}

function readerLine(title: string, section?: InventorySection): string {
  const visible = publicVisibleCount(section);

  if (section?.status === "ready" && visible > 0) {
    return `Читатель сейчас видит: ${visible} ${itemWord(title)}.`;
  }

  if (
    section?.status === "generated_but_not_published" ||
    section?.status === "partial" ||
    section?.status === "legacy_only"
  ) {
    return "Есть материал, но он ещё не в публичной витрине.";
  }

  return "Пусто: читатель пока ничего не видит.";
}

function makeHumanSummary(data: InventoryResponse | null): string {
  if (!data || data.error) return "Пока нет данных. Введите стих и нажмите «Проверить».";

  const sections = data.sections ?? {};
  const mainSections = [
    sections.observations,
    sections.lexicon,
    sections.translations,
    sections.context,
  ];

  const visibleCount = mainSections.filter(
    (section) => section?.status === "ready" && publicVisibleCount(section) > 0,
  ).length;

  const hiddenCount = mainSections.filter(
    (section) =>
      section?.status === "generated_but_not_published" ||
      section?.status === "partial" ||
      section?.status === "legacy_only",
  ).length;

  const emptyCount = mainSections.filter(
    (section) => !section || section.status === "missing",
  ).length;

  const parts: string[] = [];
  if (visibleCount > 0) parts.push(`видно сейчас: ${visibleCount}`);
  if (hiddenCount > 0) parts.push(`есть материал вне витрины: ${hiddenCount}`);
  if (emptyCount > 0) parts.push(`пусто: ${emptyCount}`);

  return `Что видит читатель: ${parts.join(" · ") || "пока ничего"}.`;
}

function SectionCard({
  title,
  section,
}: {
  title: string;
  section?: InventorySection;
}) {
  const visible = publicVisibleCount(section);
  const hidden = hiddenMaterialCount(section);
  const notes = section?.notes ?? [];

  return (
    <article className="sectionCard">
      <div className="sectionHeader">
        <div>
          <h3>{title}</h3>
          <p className="readerLine">{readerLine(title, section)}</p>
        </div>
        <span className={statusClass(section?.status)}>{statusText(section?.status)}</span>
      </div>

      <div className="humanFacts">
        {section?.status === "ready" && visible > 0 ? (
          <p>
            В публичной витрине: <strong>{visible}</strong>
          </p>
        ) : null}

        {section?.status !== "ready" && hidden > 0 ? (
          <p>
            Есть материал вне публичной витрины: <strong>{hidden}</strong>
          </p>
        ) : null}

        <p>
          Можно читать сохранённое: <strong>{boolText(section?.canOpenReadOnly)}</strong>
        </p>

        <p>
          Если открыть публично, может начаться генерация:{" "}
          <strong>{boolText(section?.wouldGenerateIfOpenedPublicly)}</strong>
        </p>

        {section?.relationConfidence === "needs_verification" ? (
          <p className="verificationNote">Связь требует проверки</p>
        ) : null}
      </div>

      {notes.length > 0 ? (
        <details className="notesDetails">
          <summary>notes</summary>
          <ul>
            {notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export default function VersePublicInventoryPage() {
  const [reference, setReference] = useState("John 17:3");
  const [lang, setLang] = useState("ru");
  const [adminSecret, setAdminSecret] = useState("");
  const [secretSaved, setSecretSaved] = useState(false);
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const savedSecret = window.localStorage.getItem("scriptura_admin_secret");
    if (savedSecret) {
      setAdminSecret(savedSecret);
      setSecretSaved(true);
    }
  }, []);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ reference, lang });
    return `/api/admin/studio/verse-public-inventory?${params.toString()}`;
  }, [reference, lang]);

  const humanSummary = useMemo(() => makeHumanSummary(data), [data]);

  const technicalSummary = useMemo(() => {
    if (!data || data.error) return "";
    return `${data.reference ?? "-"} · ${data.canonical_ref ?? "-"} · ${data.lang ?? "-"} · ${data.mode ?? "-"} · generated:${String(Boolean(data.generated))}`;
  }, [data]);

  const rawJson = data ? JSON.stringify(data, null, 2) : "";

  async function copyText(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  async function loadInventory() {
    setLoading(true);
    setError("");
    setData(null);
    setCopied("");

    try {
      const cleanSecret = adminSecret.trim();
      if (cleanSecret) {
        window.localStorage.setItem("scriptura_admin_secret", cleanSecret);
        setSecretSaved(true);
      }

      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "x-admin-secret": cleanSecret },
      });

      const text = await res.text();
      let json: InventoryResponse;

      try {
        json = JSON.parse(text) as InventoryResponse;
      } catch {
        throw new Error("Endpoint returned non-JSON response.");
      }

      if (!res.ok) setError(json.error || `Request failed with status ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const deep = data?.sections?.deep ?? {};

  return (
    <main className="page">
      <section className="topHeader">
        <p className="eyebrow">Scriptura Studio</p>
        <h1>Обзор стиха</h1>
        <p className="subtitle">Карта того, что читатель уже видит, что пусто, и где есть риск генерации.</p>
      </section>

      <section className="controlPanel">
        <label>
          reference
          <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="John 17:3" />
        </label>

        <label>
          lang
          <select value={lang} onChange={(event) => setLang(event.target.value)}>
            <option value="ru">ru</option>
            <option value="en">en</option>
            <option value="es">es</option>
          </select>
        </label>

        <label>
          admin secret
          <input value={adminSecret} onChange={(event) => setAdminSecret(event.target.value)} placeholder="Admin Secret" type="password" />
        </label>

        <button onClick={loadInventory} disabled={loading}>
          {loading ? "Проверяю..." : "Проверить"}
        </button>
      </section>

      <section className="utilityRow">
        <span>{secretSaved ? "Admin Secret сохранён в этом браузере." : "Admin Secret сохранится в этом браузере после проверки."}</span>
        <button
          className="softButton"
          type="button"
          onClick={() => {
            window.localStorage.removeItem("scriptura_admin_secret");
            setAdminSecret("");
            setSecretSaved(false);
          }}
        >
          Clear saved secret
        </button>
      </section>

      {error ? <div className="errorBox">{error}</div> : null}

      <section className="verseHero">
        <div>
          <p className="sectionKicker">Стих</p>
          <h2>{data?.reference || reference}</h2>
          <p className="versePlaceholder">
            Текст стиха пока не входит в inventory JSON. Место оставлено для будущего подключения текста стиха без запуска генерации.
          </p>
        </div>
        {data ? <div className="systemBadge">{data.mode || "read_only"} · generated:{String(Boolean(data.generated))}</div> : null}
      </section>

      <section className="summaryBox">
        <p className="sectionKicker">Что видит читатель</p>
        <strong>{humanSummary}</strong>
        {data ? (
          <div className="summaryActions">
            <button className="softButton" type="button" onClick={() => copyText(humanSummary, "summary")}>
              Скопировать сводку
            </button>
            <button className="softButton" type="button" onClick={() => copyText(rawJson, "raw")}>
              Скопировать Raw JSON
            </button>
          </div>
        ) : null}
      </section>

      {copied ? <div className="copiedHint">Скопировано</div> : null}

      {data ? (
        <>
          <section className="overviewBlock">
            <div className="blockIntro">
              <h2>Публичная витрина</h2>
              <p>Главные разделы, которые важны читателю. Внутренняя pipeline-модель здесь не показывается.</p>
            </div>
            <div className="publicGrid">
              <SectionCard title={SECTION_TITLES.observations} section={data.sections?.observations} />
              <SectionCard title={SECTION_TITLES.lexicon} section={data.sections?.lexicon} />
              <SectionCard title={SECTION_TITLES.translations} section={data.sections?.translations} />
              <SectionCard title={SECTION_TITLES.context} section={data.sections?.context} />
            </div>
          </section>

          <section className="overviewBlock">
            <div className="blockIntro">
              <h2>Длинные материалы / Углубления</h2>
              <p>Статьи и дополнительные материалы, которые помогают разворачивать стих глубже.</p>
            </div>
            <div className="publicGrid">
              <SectionCard title={SECTION_TITLES.expanded} section={data.sections?.expanded_articles} />
              <SectionCard title={SECTION_TITLES.textFindings} section={deep.text_findings} />
              <SectionCard title={SECTION_TITLES.historicalScene} section={deep.historical_scene} />
              <SectionCard title={SECTION_TITLES.scriptureLinks} section={deep.scripture_links} />
            </div>
          </section>

          {data.warnings && data.warnings.length > 0 ? (
            <section className="warningsBox">
              <h2>Предупреждения</h2>
              <ul>
                {data.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <details className="technicalData">
            <summary>Технические данные</summary>
            <p>
              Здесь спрятаны технические поля inventory JSON. Они не являются пользовательской моделью Studio vNext.
            </p>
            <p className="technicalSummary">{technicalSummary}</p>

            {data.rawCounts ? (
              <>
                <h3>rawCounts</h3>
                <div className="rawCountsGrid">
                  {Object.entries(data.rawCounts).map(([key, value]) => (
                    <div className="rawCount" key={key}>
                      <span>{key}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <h3>Raw JSON</h3>
            <pre>{rawJson}</pre>
          </details>
        </>
      ) : null}

      <style jsx global>{`
        .page {
          min-height: 100vh;
          padding: 32px;
          background: #f7efe2;
          color: #2b241b;
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        }

        .topHeader,
        .controlPanel,
        .utilityRow,
        .verseHero,
        .summaryBox,
        .overviewBlock,
        .warningsBox,
        .technicalData,
        .errorBox,
        .copiedHint {
          max-width: 1120px;
          margin-left: auto;
          margin-right: auto;
        }

        .topHeader {
          margin-bottom: 22px;
        }

        .eyebrow,
        .sectionKicker {
          margin: 0 0 8px;
          color: #7e6143;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: 42px;
          line-height: 1.05;
        }

        h2 {
          margin: 0;
          font-size: 24px;
        }

        h3 {
          margin: 0;
          font-size: 18px;
        }

        .subtitle {
          max-width: 760px;
          margin: 12px 0 0;
          color: #66533e;
          font-size: 18px;
          line-height: 1.5;
        }

        .controlPanel,
        .verseHero,
        .summaryBox,
        .overviewBlock,
        .warningsBox,
        .technicalData {
          border: 1px solid rgba(109, 82, 51, 0.16);
          border-radius: 24px;
          background: rgba(255, 252, 246, 0.9);
          box-shadow: 0 16px 42px rgba(92, 66, 36, 0.08);
        }

        .controlPanel {
          display: grid;
          grid-template-columns: 1.5fr 120px 1.2fr auto;
          gap: 12px;
          align-items: end;
          padding: 18px;
          margin-bottom: 12px;
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

        .softButton {
          background: #eee2d0;
          color: #5f4c36;
          padding: 10px 13px;
          font-size: 13px;
        }

        .utilityRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
          color: #7c6650;
          font-size: 13px;
        }

        .errorBox {
          margin-bottom: 16px;
          padding: 14px 16px;
          border: 1px solid #d08a77;
          border-radius: 18px;
          background: #fff0ec;
          color: #8a2e1e;
        }

        .verseHero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          padding: 22px;
          margin-bottom: 16px;
        }

        .verseHero h2 {
          margin-bottom: 10px;
          font-size: 30px;
        }

        .versePlaceholder {
          max-width: 760px;
          margin: 0;
          color: #6c5842;
          font-size: 17px;
          line-height: 1.55;
        }

        .systemBadge {
          flex: 0 0 auto;
          border-radius: 999px;
          background: #eee2d0;
          color: #5f4c36;
          padding: 8px 12px;
          font-size: 13px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        .summaryBox {
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .summaryBox strong {
          display: block;
          max-width: 860px;
          color: #33281c;
          font-size: 19px;
          line-height: 1.45;
        }

        .summaryActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .copiedHint {
          margin-top: -8px;
          margin-bottom: 12px;
          color: #476f48;
          font-size: 13px;
        }

        .overviewBlock {
          padding: 20px;
          margin-bottom: 16px;
        }

        .blockIntro {
          margin-bottom: 16px;
        }

        .blockIntro p {
          margin: 7px 0 0;
          color: #6c5842;
          line-height: 1.45;
        }

        .publicGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .sectionCard {
          border: 1px solid rgba(109, 82, 51, 0.14);
          border-radius: 20px;
          background: #fffaf2;
          padding: 16px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .readerLine {
          margin: 7px 0 0;
          color: #6c5842;
          font-size: 15px;
          line-height: 1.45;
        }

        .status {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 7px 11px;
          background: #eee2d0;
          color: #5f4c36;
          font-size: 13px;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          white-space: nowrap;
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

        .humanFacts {
          display: grid;
          gap: 7px;
          color: #6c5842;
          font-size: 14px;
        }

        .humanFacts p {
          margin: 0;
        }

        .verificationNote {
          color: #745000;
        }

        .notesDetails {
          margin-top: 12px;
          color: #6c5842;
          font-size: 13px;
        }

        .notesDetails summary {
          cursor: pointer;
        }

        .notesDetails ul {
          margin: 8px 0 0;
          padding-left: 18px;
          line-height: 1.45;
        }

        .warningsBox {
          padding: 18px;
          margin-bottom: 16px;
          border-color: rgba(173, 98, 52, 0.3);
        }

        .warningsBox ul {
          margin: 12px 0 0;
          padding-left: 18px;
          color: #5d4b39;
          line-height: 1.45;
        }

        .technicalData {
          padding: 16px 18px;
        }

        .technicalData summary {
          cursor: pointer;
          font-weight: 700;
        }

        .technicalData p {
          color: #6c5842;
          line-height: 1.45;
        }

        .technicalSummary {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
        }

        .technicalData h3 {
          margin-top: 18px;
          margin-bottom: 10px;
        }

        .rawCountsGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }

        .rawCount {
          display: grid;
          gap: 5px;
          border-radius: 14px;
          background: #f8f0e3;
          padding: 11px 12px;
        }

        .rawCount span {
          color: #7b6750;
          font-size: 12px;
        }

        .rawCount strong {
          font-size: 20px;
        }

        pre {
          overflow: auto;
          border-radius: 16px;
          background: #251f18;
          color: #f8ead6;
          padding: 16px;
          font-size: 13px;
          line-height: 1.45;
        }

        @media (max-width: 900px) {
          .page {
            padding: 18px;
          }

          .controlPanel,
          .publicGrid {
            grid-template-columns: 1fr;
          }

          .verseHero,
          .utilityRow {
            align-items: flex-start;
            flex-direction: column;
          }

          .systemBadge {
            align-self: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
