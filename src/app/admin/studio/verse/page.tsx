"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const futureScreens = [
  "Сортировка карточек — позже",
  "Добавить карточки — позже",
  "Собрать статью — позже",
  "Материалы / Knowledge Index — позже",
];

export default function VerseWorkspaceEntryPage() {
  const router = useRouter();
  const [reference, setReference] = useState("John 17:3");
  const [lang, setLang] = useState("ru");

  function openOverview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanReference = reference.trim() || "John 17:3";
    const params = new URLSearchParams({
      reference: cleanReference,
      lang,
    });

    router.push(`/admin/studio/verse-public-inventory?${params.toString()}`);
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Scriptura Studio</p>
        <h1>Кабинет стиха</h1>
        <p className="subtitle">
          Выберите стих, чтобы открыть read-only обзор готовых публичных материалов.
        </p>
      </section>

      <section className="panel">
        <form onSubmit={openOverview} className="form">
          <label>
            Reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="John 17:3"
            />
          </label>

          <label>
            Lang
            <select value={lang} onChange={(event) => setLang(event.target.value)}>
              <option value="ru">ru</option>
              <option value="en">en</option>
              <option value="es">es</option>
            </select>
          </label>

          <button type="submit">Открыть обзор</button>
        </form>
      </section>

      <section className="future">
        <h2>Будущие рабочие экраны</h2>
        <p>
          Эти процессы будут отдельными экранами Кабинета стиха. Сейчас они показаны
          только как структура будущей навигации.
        </p>

        <div className="futureGrid">
          {futureScreens.map((item) => (
            <div className="futureCard" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
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
        .future {
          max-width: 960px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          margin-bottom: 24px;
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
          font-size: 42px;
          line-height: 1.05;
        }

        h2 {
          margin: 0 0 10px;
          font-size: 24px;
        }

        .subtitle,
        .future p {
          max-width: 760px;
          margin: 12px 0 0;
          color: #66533e;
          font-size: 18px;
          line-height: 1.5;
        }

        .panel,
        .future {
          border: 1px solid rgba(109, 82, 51, 0.16);
          border-radius: 24px;
          background: rgba(255, 252, 246, 0.92);
          box-shadow: 0 16px 42px rgba(92, 66, 36, 0.08);
        }

        .panel {
          padding: 20px;
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

        .future {
          padding: 20px;
        }

        .futureGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .futureCard {
          border-radius: 18px;
          background: #f4eadb;
          color: #6b563f;
          padding: 16px;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-weight: 700;
        }

        @media (max-width: 820px) {
          .page {
            padding: 18px;
          }

          .form,
          .futureGrid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}
