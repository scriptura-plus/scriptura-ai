"use client";

import { useEffect, useState } from "react";
import { VersePicker } from "@/components/VersePicker";
import { LANGS, type Lang } from "@/lib/i18n/dictionary";
import {
  defaultProvider,
  isProvider,
  PROVIDERS,
  type Provider,
} from "@/lib/ai/providers";

function getAboutCopy(lang: Lang) {
  if (lang === "ru") {
    return {
      close: "Close",
      eyebrow: "SOURCES",
      title: "Scriptura AI",
      intro:
        "Scriptura AI помогает читать библейский текст внимательнее: видеть переводческие различия, контекст и детали оригинальных языков, которые легко пропустить при обычном чтении.",
      bible:
        "Библейский текст основан на Синодальном переводе 1876 года — классической русской библейской традиции, связанной с Российским Библейским Обществом и переводческой школой XIX века. В редакции RSTJ 1876 («Синодальная, Яхвэ версия») тетраграмматон יהוה последовательно передаётся как «Яхвэ».",
      original:
        "Оригинально-языковой слой основан на открытых данных STEPBible-Data — академическом ресурсе, подготовленном для проекта STEP Bible при Tyndale House, Cambridge. Данные используются по лицензии Creative Commons Attribution 4.0 International (CC BY 4.0).",
      sourceLineOne:
        "RSTJ 1876 · Синодальный перевод · Российское Библейское Общество",
      sourceLineTwo:
        "STEPBible-Data · STEP Bible · Tyndale House, Cambridge · CC BY 4.0",
      note:
        "AI помогает формулировать наблюдения, но источником авторитета остаётся текст.",
    };
  }

  if (lang === "es") {
    return {
      close: "Close",
      eyebrow: "SOURCES",
      title: "Scriptura AI",
      intro:
        "Scriptura AI ayuda a leer el texto bíblico con más atención: diferencias de traducción, contexto y detalles de los idiomas originales que se pierden fácilmente en una lectura rápida.",
      bible:
        "El texto bíblico se basa en la Traducción Sinodal de 1876, una tradición bíblica rusa clásica vinculada con la Sociedad Bíblica Rusa y la escuela de traducción del siglo XIX. En la edición RSTJ 1876 («Sinodal, versión Yahvé»), el tetragrámaton יהוה se transmite consistentemente como «Yahvé».",
      original:
        "La capa de idiomas originales se basa en los datos abiertos STEPBible-Data, un recurso académico preparado para el proyecto STEP Bible en Tyndale House, Cambridge. Los datos se usan bajo la licencia Creative Commons Attribution 4.0 International (CC BY 4.0).",
      sourceLineOne:
        "RSTJ 1876 · Traducción Sinodal · Sociedad Bíblica Rusa",
      sourceLineTwo:
        "STEPBible-Data · STEP Bible · Tyndale House, Cambridge · CC BY 4.0",
      note:
        "La AI ayuda a formular observaciones, pero la autoridad permanece en el texto.",
    };
  }

  return {
    close: "Close",
    eyebrow: "SOURCES",
    title: "Scriptura AI",
    intro:
      "Scriptura AI helps readers notice the biblical text more carefully: translation differences, context, and original-language details that are easy to miss in ordinary reading.",
    bible:
      "The Bible text is based on the 1876 Synodal Translation, a classic Russian biblical tradition associated with the Russian Bible Society and the nineteenth-century translation school. In the RSTJ 1876 edition (“Synodal, Yahweh version”), the tetragrammaton יהוה is consistently rendered as “Yahweh.”",
    original:
      "The original-language layer is based on STEPBible-Data, an open academic resource prepared for the STEP Bible project at Tyndale House, Cambridge. The data is used under the Creative Commons Attribution 4.0 International license (CC BY 4.0).",
    sourceLineOne:
      "RSTJ 1876 · Synodal Translation · Russian Bible Society",
    sourceLineTwo:
      "STEPBible-Data · STEP Bible · Tyndale House, Cambridge · CC BY 4.0",
    note:
      "AI helps formulate observations, but the authority remains in the text.",
  };
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [provider, setProvider] = useState<Provider>(defaultProvider());
  const [aboutOpen, setAboutOpen] = useState(false);

  const about = getAboutCopy(lang);

  useEffect(() => {
    const sl = localStorage.getItem("scriptura.lang");
    if (sl === "en" || sl === "ru" || sl === "es") setLang(sl as Lang);
    const sp = localStorage.getItem("scriptura.provider");
    if (isProvider(sp)) setProvider(sp);
  }, []);

  useEffect(() => {
    if (!aboutOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAboutOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [aboutOpen]);

  function onLang(l: Lang) {
    setLang(l);
    localStorage.setItem("scriptura.lang", l);
  }

  function onProvider(p: Provider) {
    setProvider(p);
    localStorage.setItem("scriptura.provider", p);
  }

  return (
    <main className="home-main">
      <style>{aboutStyles}</style>

      <div className="home-topbar">
        <span className="home-brand">📜 Scriptura AI</span>
        <div className="home-controls">
          <select
            className="home-select"
            value={lang}
            onChange={(e) => onLang(e.target.value as Lang)}
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            className="home-select"
            value={provider}
            onChange={(e) => onProvider(e.target.value as Provider)}
            aria-label="AI provider"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <VersePicker lang={lang} />

      <button
        type="button"
        className="scriptura-about-link"
        onClick={() => setAboutOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={aboutOpen}
      >
        About
      </button>

      {aboutOpen && (
        <div
          className="scriptura-about-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAboutOpen(false);
          }}
        >
          <section
            className="scriptura-about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scriptura-about-title"
          >
            <div className="scriptura-about-glow" aria-hidden="true" />

            <div className="scriptura-about-topline">
              <div>
                <p className="scriptura-about-eyebrow">{about.eyebrow}</p>
                <h2 id="scriptura-about-title" className="scriptura-about-title">
                  {about.title}
                </h2>
              </div>

              <button
                type="button"
                className="scriptura-about-close"
                onClick={() => setAboutOpen(false)}
                aria-label={about.close}
              >
                ×
              </button>
            </div>

            <div className="scriptura-about-body">
              <p>{about.intro}</p>
              <p>{about.bible}</p>
              <p>{about.original}</p>
            </div>

            <div className="scriptura-source-lines" aria-label="Sources">
              <p>{about.sourceLineOne}</p>
              <p>{about.sourceLineTwo}</p>
            </div>

            <p className="scriptura-about-note">{about.note}</p>

            <div className="scriptura-about-footer">
              <span>Scriptura AI</span>
              <button
                type="button"
                className="scriptura-about-done"
                onClick={() => setAboutOpen(false)}
              >
                {about.close}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const aboutStyles = `
  .scriptura-about-link {
    position: fixed;
    right: max(22px, env(safe-area-inset-right));
    bottom: max(20px, env(safe-area-inset-bottom));
    z-index: 40;
    appearance: none;
    border: 0;
    border-bottom: 1px solid rgba(90, 74, 55, 0.22);
    border-radius: 0;
    background: transparent;
    color: rgba(90, 74, 55, 0.48);
    cursor: pointer;
    padding: 3px 1px 4px;
    font-family: var(--font-serif, Georgia, serif);
    font-size: 13px;
    letter-spacing: 0.035em;
    line-height: 1;
    text-transform: none;
    transition:
      color 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }

  .scriptura-about-link:hover {
    color: rgba(90, 74, 55, 0.78);
    border-color: rgba(90, 74, 55, 0.42);
    transform: translateY(-1px);
  }

  .scriptura-about-link:active {
    transform: translateY(0);
  }

  .scriptura-about-link:focus-visible {
    outline: 2px solid rgba(95, 120, 144, 0.24);
    outline-offset: 5px;
    border-radius: 4px;
  }

  .scriptura-about-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 18px;
    background:
      radial-gradient(circle at 50% 0%, rgba(251, 246, 234, 0.36), transparent 42%),
      rgba(44, 36, 27, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: scripturaAboutBackdropIn 180ms ease both;
  }

  .scriptura-about-modal {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    width: min(560px, 100%);
    max-height: min(82vh, 690px);
    overflow-y: auto;
    border: 1px solid rgba(138, 90, 43, 0.17);
    border-radius: 28px;
    background:
      linear-gradient(145deg, rgba(255, 252, 246, 0.98), rgba(246, 238, 222, 0.97));
    box-shadow:
      0 32px 82px rgba(42, 32, 22, 0.25),
      0 8px 22px rgba(42, 32, 22, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
    padding: 30px 30px 24px;
    animation: scripturaAboutModalIn 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .scriptura-about-glow {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.82), transparent 30%),
      radial-gradient(circle at 100% 18%, rgba(95, 120, 144, 0.1), transparent 32%),
      radial-gradient(circle at 8% 100%, rgba(138, 90, 43, 0.07), transparent 34%);
  }

  .scriptura-about-topline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .scriptura-about-eyebrow {
    margin: 0 0 8px;
    color: rgba(166, 116, 72, 0.78);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.24em;
    text-transform: uppercase;
  }

  .scriptura-about-title {
    margin: 0;
    color: #2c241b;
    font-family: var(--font-serif, Georgia, serif);
    font-size: clamp(32px, 5vw, 46px);
    line-height: 1;
    letter-spacing: -0.045em;
  }

  .scriptura-about-close {
    appearance: none;
    border: 0;
    background: transparent;
    color: rgba(90, 74, 55, 0.46);
    cursor: pointer;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    padding: 0;
    font-size: 26px;
    line-height: 1;
    transition: color 140ms ease, transform 140ms ease;
  }

  .scriptura-about-close:hover {
    color: rgba(90, 74, 55, 0.78);
    transform: rotate(4deg);
  }

  .scriptura-about-body {
    margin-top: 22px;
  }

  .scriptura-about-body p {
    margin: 0;
    color: rgba(44, 36, 27, 0.76);
    font-size: 15.5px;
    line-height: 1.68;
  }

  .scriptura-about-body p + p {
    margin-top: 15px;
  }

  .scriptura-source-lines {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid rgba(138, 90, 43, 0.14);
  }

  .scriptura-source-lines p {
    margin: 0;
    color: rgba(95, 120, 144, 0.86);
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.075em;
    line-height: 1.55;
    text-transform: uppercase;
  }

  .scriptura-source-lines p + p {
    margin-top: 5px;
  }

  .scriptura-about-note {
    margin: 18px 0 0;
    color: rgba(90, 74, 55, 0.66);
    font-family: var(--font-serif, Georgia, serif);
    font-size: 16px;
    font-style: italic;
    line-height: 1.48;
  }

  .scriptura-about-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid rgba(138, 90, 43, 0.12);
    color: rgba(90, 74, 55, 0.5);
    font-family: var(--font-serif, Georgia, serif);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .scriptura-about-done {
    appearance: none;
    border: 0;
    border-bottom: 1px solid rgba(95, 120, 144, 0.22);
    background: transparent;
    color: rgba(95, 120, 144, 0.78);
    cursor: pointer;
    padding: 3px 0 4px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  @keyframes scripturaAboutBackdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scripturaAboutModalIn {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.988);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scriptura-about-link,
    .scriptura-about-backdrop,
    .scriptura-about-modal,
    .scriptura-about-close {
      animation: none;
      transition: none;
    }

    .scriptura-about-link,
    .scriptura-about-link:hover {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .scriptura-about-link {
      right: max(16px, env(safe-area-inset-right));
      bottom: max(14px, env(safe-area-inset-bottom));
      font-size: 12px;
      color: rgba(90, 74, 55, 0.4);
    }

    .scriptura-about-backdrop {
      padding: 12px;
      align-items: end;
    }

    .scriptura-about-modal {
      max-height: 86vh;
      border-radius: 26px;
      padding: 25px 22px 20px;
    }

    .scriptura-about-body p {
      font-size: 14.5px;
      line-height: 1.62;
    }

    .scriptura-source-lines p {
      font-size: 10.5px;
      letter-spacing: 0.065em;
    }

    .scriptura-about-footer {
      margin-top: 20px;
    }
  }
`;
