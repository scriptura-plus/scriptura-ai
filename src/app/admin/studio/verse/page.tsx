"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

const examples = [
  { label: "Иоанна 17:3", canonicalRef: "john-17-3" },
  { label: "Иоанна 3:16", canonicalRef: "john-3-16" },
  { label: "Малахия 3:10", canonicalRef: "malachi-3-10" },
  { label: "Наум 1:7", canonicalRef: "nahum-1-7" },
];

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

function buildHref(path: string, canonicalRef: string, lang: string): string {
  const params = new URLSearchParams();
  params.set("canonical_ref", canonicalRef);
  params.set("lang", lang);
  return `${path}?${params.toString()}`;
}

export default function VerseWorkspaceHubPage() {
  const [reference, setReference] = useState("john-17-3");
  const [lang, setLang] = useState("ru");
  const [selectedRef, setSelectedRef] = useState("john-17-3");

  const canonicalRef = useMemo(() => {
    return normalizeReference(selectedRef) || "john-17-3";
  }, [selectedRef]);

  function openVerse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedRef(normalizeReference(reference) || "john-17-3");
  }

  const activeSections = [
    {
      title: "Обзор",
      description: "Посмотреть, что уже есть по этому стиху в публичном наборе.",
      href: buildHref("/admin/studio/verse/overview", canonicalRef, lang),
    },
    {
      title: "Наблюдения",
      description: "Открыть карточки Наблюдений из research_notes.",
      href: buildHref("/admin/studio/verse-notes", canonicalRef, lang),
    },
  ];

  const futureSections = [
    "Лексика",
    "Переводы",
    "Статьи",
    "Материалы",
    "Работа с Opus",
    "Добавить карточки",
  ];

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Scriptura Studio</p>
        <h1>Кабинет стиха</h1>
        <p className="subtitle">
          Выберите стих и откройте нужный раздел. Сейчас доступны read-only
          обзор и Наблюдения; остальные рабочие разделы будут добавлены позже.
        </p>
      </section>

      <section className="panel">
        <h2>Выберите стих</h2>

        <form onSubmit={openVerse} className="form">
          <label>
            canonical_ref или reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="john-17-3"
            />
          </label>

          <label>
            Язык
            <select value={lang} onChange={(event) => setLang(event.target.value)}>
              <option value="ru">ru</option>
              <option value="en">en</option>
              <option value="es">es</option>
            </select>
          </label>

          <button type="submit">Открыть стих</button>
        </form>

        <div className="examples">
          <span>Быстрые примеры:</span>
          {examples.map((item) => (
            <button
              key={item.canonicalRef}
              type="button"
              onClick={() => {
                setReference(item.canonicalRef);
                setSelectedRef(item.canonicalRef);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="current">
        <div>
          <span>Текущий стих</span>
          <strong>{canonicalRef}</strong>
        </div>
        <div>
          <span>Язык</span>
          <strong>{lang}</strong>
        </div>
      </section>

      <section className="sections">
        <h2>Откройте раздел</h2>

        <div className="grid">
          {activeSections.map((section) => (
            <Link className="sectionCard active" href={section.href} key={section.title}>
              <span>Доступно</span>
              <strong>{section.title}</strong>
              <p>{section.description}</p>
            </Link>
          ))}

          {futureSections.map((title) => (
            <div className="sectionCard disabled" key={title} aria-disabled="true">
              <span>Скоро</span>
              <strong>{title}</strong>
              <p>Этот раздел будет добавлен позже.</p>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 42px;
          background: #f6ead7;
          color: #24180e;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .hero,
        .panel,
        .current,
        .sections {
          max-width: 1040px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          margin-bottom: 24px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #8a5a2b;
          font-size: 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: clamp(42px, 7vw, 72px);
          line-height: 0.98;
        }

        h2 {
          margin: 0 0 16px;
          font-size: 26px;
        }

        .subtitle {
          max-width: 760px;
          margin: 18px 0 0;
          color: #5d4934;
          font-size: 20px;
          line-height: 1.6;
        }

        .panel,
        .current,
        .sections {
          border: 1px solid rgba(120, 84, 45, 0.18);
          border-radius: 24px;
          background: rgba(255, 250, 241, 0.62);
          box-shadow: 0 14px 36px rgba(54, 36, 18, 0.07);
        }

        .panel {
          padding: 24px;
          margin-bottom: 18px;
        }

        .form {
          display: grid;
          grid-template-columns: 1fr 140px auto;
          gap: 12px;
          align-items: end;
        }

        label {
          display: grid;
          gap: 7px;
          color: #6d5a45;
          font-size: 14px;
        }

        input,
        select,
        button {
          min-height: 42px;
          border: 1px solid rgba(120, 84, 45, 0.28);
          border-radius: 12px;
          padding: 9px 12px;
          background: rgba(255,255,255,0.76);
          color: #24180e;
          font: inherit;
        }

        button {
          cursor: pointer;
          background: #8a4f18;
          border-color: #8a4f18;
          color: white;
          font-weight: 700;
        }

        .examples {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-top: 18px;
        }

        .examples span {
          color: #6d5a45;
        }

        .examples button {
          min-height: 34px;
          padding: 7px 10px;
          background: #fffaf1;
          color: #8a4f18;
          border-color: rgba(120, 84, 45, 0.24);
          font-weight: 600;
        }

        .current {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          margin-bottom: 18px;
        }

        .current div {
          display: grid;
          gap: 6px;
        }

        .current span {
          color: #6d5a45;
          font-size: 14px;
        }

        .current strong {
          font-size: 28px;
        }

        .sections {
          padding: 24px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .sectionCard {
          display: block;
          min-height: 144px;
          padding: 20px;
          border-radius: 20px;
          text-decoration: none;
          border: 1px solid rgba(120, 84, 45, 0.16);
        }

        .sectionCard span {
          display: inline-block;
          margin-bottom: 12px;
          color: #7b6851;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sectionCard strong {
          display: block;
          margin-bottom: 10px;
          color: #24180e;
          font-size: 26px;
        }

        .sectionCard p {
          margin: 0;
          color: #5d4934;
          font-size: 16px;
          line-height: 1.45;
        }

        .sectionCard.active {
          background: rgba(255, 253, 248, 0.92);
        }

        .sectionCard.active:hover {
          border-color: rgba(138, 79, 24, 0.55);
          transform: translateY(-1px);
        }

        .sectionCard.disabled {
          background: rgba(244, 234, 219, 0.68);
          opacity: 0.72;
        }

        @media (max-width: 820px) {
          .page {
            padding: 24px 18px;
          }

          .form,
          .grid,
          .current {
            grid-template-columns: 1fr;
            display: grid;
          }
        }
      `}</style>
    </main>
  );
}
