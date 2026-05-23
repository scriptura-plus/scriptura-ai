"use client";

import Link from "next/link";

type StudioCard = {
  title: string;
  description: string;
  href?: string;
  badge: string;
};

const mainSections: StudioCard[] = [
  {
    title: "Activity",
    description:
      "Наблюдение за тем, какие стихи открывают пользователи и где появляется интерес. Будущий отдельный экран.",
    badge: "будет позже",
  },
  {
    title: "Кабинет стиха",
    description:
      "Работа с одним выбранным стихом: обзор, будущая сортировка, добавление карточек и сборка статьи.",
    href: "/admin/studio/verse-public-inventory",
    badge: "текущий read-only обзор",
  },
  {
    title: "Knowledge Index",
    description:
      "Будущая библиотека материалов и находок. Не смешиваем с экраном добавления карточек.",
    badge: "будет позже",
  },
  {
    title: "Prompt Library",
    description:
      "Будущий каталог промтов для внешних исследовательских и редакторских процессов.",
    badge: "будет позже",
  },
];

export default function StudioHomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Scriptura Studio</p>
        <h1>Рабочий кабинет</h1>
        <p className="subtitle">
          Навигационный каркас Studio vNext. Один процесс — один экран.
          Здесь нет генерации, редактирования, публикации или записи данных.
        </p>
      </section>

      <section className="grid" aria-label="Studio sections">
        {mainSections.map((section) => (
          <article className={section.href ? "card" : "card muted"} key={section.title}>
            <div className="cardTop">
              <h2>{section.title}</h2>
              <span>{section.badge}</span>
            </div>
            <p>{section.description}</p>

            {section.href ? (
              <Link className="cardLink" href={section.href}>
                Открыть
              </Link>
            ) : (
              <div className="disabledLink">Появится позже</div>
            )}
          </article>
        ))}
      </section>

      <section className="note">
        <h2>Текущие безопасные инструменты</h2>
        <p>
          Текущий read-only обзор стиха остаётся на своём адресе и не ломается.
          Старый большой экран модератора временно сохранён отдельно, чтобы не
          потерять доступ во время перехода к Studio vNext.
        </p>
        <div className="links">
          <Link href="/admin/studio/verse-public-inventory">
            Read-only обзор стиха
          </Link>
          <Link href="/admin/studio/legacy">Старый экран модератора</Link>
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
        .grid,
        .note {
          max-width: 1120px;
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

        .subtitle {
          max-width: 780px;
          margin: 12px 0 0;
          color: #66533e;
          font-size: 18px;
          line-height: 1.5;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .card,
        .note {
          border: 1px solid rgba(109, 82, 51, 0.16);
          border-radius: 24px;
          background: rgba(255, 252, 246, 0.92);
          box-shadow: 0 16px 42px rgba(92, 66, 36, 0.08);
        }

        .card {
          padding: 20px;
        }

        .card.muted {
          opacity: 0.78;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        h2 {
          margin: 0;
          font-size: 22px;
        }

        .cardTop span {
          border-radius: 999px;
          background: #eee2d0;
          color: #5f4c36;
          padding: 7px 10px;
          font-size: 12px;
          white-space: nowrap;
        }

        .card p,
        .note p {
          margin: 0;
          color: #66533e;
          font-size: 16px;
          line-height: 1.5;
        }

        .cardLink,
        .disabledLink {
          display: inline-flex;
          margin-top: 18px;
          border-radius: 14px;
          padding: 11px 14px;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .cardLink {
          background: #496f8f;
          color: white;
        }

        .disabledLink {
          background: #eee2d0;
          color: #7a6650;
        }

        .note {
          padding: 20px;
        }

        .note h2 {
          margin-bottom: 10px;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .links a {
          border-radius: 14px;
          background: #eee2d0;
          color: #5f4c36;
          padding: 10px 13px;
          font-family:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        @media (max-width: 820px) {
          .page {
            padding: 18px;
          }

          .grid {
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

