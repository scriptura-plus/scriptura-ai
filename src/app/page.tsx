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
      button: "О проекте",
      close: "Закрыть",
      eyebrow: "Источник и доверие",
      title: "Scriptura AI",
      subtitle:
        "Инструмент для внимательного чтения библейского текста с помощью AI — с опорой на текст, оригинальные языки и проверяемые данные.",
      bibleTitle: "Русский библейский текст",
      bibleBody:
        "В приложении используется рабочая русская редакция на основе синодальной традиции. В местах тетраграмматона имя Бога восстановлено в форме «Яхвэ», чтобы читатель видел личное имя там, где оно стоит в исходном еврейском тексте.",
      languageTitle: "Греческий, еврейский и арамейский слой",
      languageBody:
        "Для анализа оригинальных языков используются открытые tagged datasets STEPBible / Tyndale House, Cambridge: формы слов, леммы, морфология и базовые подсказки по смыслу. Эти данные помогают AI не выдумывать греческий или еврейский текст, а сверяться с подготовленным языковым слоем.",
      licenseTitle: "Открытые академические данные",
      licenseBody:
        "Данные STEPBible распространяются как открытый ресурс, включая материалы под лицензией CC BY 4.0 там, где это указано в источнике. Мы используем их как справочную основу, а не как готовый комментарий.",
      aiTitle: "Роль AI",
      aiBody:
        "AI помогает находить формулировки и углы чтения. Важные выводы следует воспринимать как исследовательские подсказки и при необходимости сверять с первоисточниками и печатными изданиями.",
      badges: ["Текст", "Оригинальные языки", "CC BY 4.0", "AI-помощник"],
    };
  }

  if (lang === "es") {
    return {
      button: "Acerca de",
      close: "Cerrar",
      eyebrow: "Fuentes y confianza",
      title: "Scriptura AI",
      subtitle:
        "Una herramienta para leer el texto bíblico con atención usando AI, con apoyo del texto, los idiomas originales y datos verificables.",
      bibleTitle: "Texto bíblico ruso",
      bibleBody:
        "La aplicación usa una edición rusa de trabajo basada en la tradición sinodal. En los lugares del tetragrámaton, el nombre divino se restaura como «Yahvé» para que el lector vea el nombre personal donde aparece en el texto hebreo original.",
      languageTitle: "Capa griega, hebrea y aramea",
      languageBody:
        "Para los idiomas originales usamos datasets etiquetados de STEPBible / Tyndale House, Cambridge: formas, lemas, morfología y ayudas básicas de significado. Esto ayuda a que la AI no invente griego o hebreo, sino que consulte una capa lingüística preparada.",
      licenseTitle: "Datos académicos abiertos",
      licenseBody:
        "Los datos de STEPBible se publican como recurso abierto, incluyendo materiales bajo licencia CC BY 4.0 cuando así se indica en la fuente. Los usamos como base de referencia, no como comentario final.",
      aiTitle: "Papel de la AI",
      aiBody:
        "La AI ayuda a encontrar formulaciones y ángulos de lectura. Las conclusiones importantes deben tratarse como pistas de investigación y, cuando sea necesario, verificarse con fuentes primarias y ediciones impresas.",
      badges: ["Texto", "Idiomas originales", "CC BY 4.0", "AI asistente"],
    };
  }

  return {
    button: "About",
    close: "Close",
    eyebrow: "Sources and trust",
    title: "Scriptura AI",
    subtitle:
      "A tool for attentive Bible reading with AI — grounded in the text, original-language data, and verifiable sources.",
    bibleTitle: "Russian Bible text",
    bibleBody:
      "The app uses a working Russian edition based on the Synodal tradition. Where the tetragrammaton stands in the Hebrew text, the divine name is restored in the form “Yahweh,” so the reader can see the personal name rather than only a title.",
    languageTitle: "Greek, Hebrew, and Aramaic layer",
    languageBody:
      "For original-language analysis we use open tagged datasets from STEPBible / Tyndale House, Cambridge: word forms, lemmas, morphology, and basic sense helps. This lets AI check a prepared language layer instead of inventing Greek or Hebrew.",
    licenseTitle: "Open academic data",
    licenseBody:
      "STEPBible data is published as an open resource, including materials under CC BY 4.0 where indicated by the source. We use it as a reference layer, not as a finished commentary.",
    aiTitle: "Role of AI",
    aiBody:
      "AI helps find wording and reading angles. Important conclusions should be treated as research prompts and, when needed, checked against primary sources and printed editions.",
    badges: ["Text", "Original languages", "CC BY 4.0", "AI assistant"],
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
        className="scriptura-about-button"
        onClick={() => setAboutOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={aboutOpen}
      >
        <span aria-hidden="true">◦</span>
        {about.button}
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
                  📜 {about.title}
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

            <p className="scriptura-about-subtitle">{about.subtitle}</p>

            <div className="scriptura-about-badges" aria-label="Trust badges">
              {about.badges.map((badge) => (
                <span key={badge} className="scriptura-about-badge">
                  {badge}
                </span>
              ))}
            </div>

            <div className="scriptura-about-sections">
              <article className="scriptura-about-section">
                <span className="scriptura-about-section-number">01</span>
                <div>
                  <h3>{about.bibleTitle}</h3>
                  <p>{about.bibleBody}</p>
                </div>
              </article>

              <article className="scriptura-about-section">
                <span className="scriptura-about-section-number">02</span>
                <div>
                  <h3>{about.languageTitle}</h3>
                  <p>{about.languageBody}</p>
                </div>
              </article>

              <article className="scriptura-about-section">
                <span className="scriptura-about-section-number">03</span>
                <div>
                  <h3>{about.licenseTitle}</h3>
                  <p>{about.licenseBody}</p>
                </div>
              </article>

              <article className="scriptura-about-section">
                <span className="scriptura-about-section-number">04</span>
                <div>
                  <h3>{about.aiTitle}</h3>
                  <p>{about.aiBody}</p>
                </div>
              </article>
            </div>

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
  .scriptura-about-button {
    position: fixed;
    right: max(22px, env(safe-area-inset-right));
    bottom: max(22px, env(safe-area-inset-bottom));
    z-index: 40;
    appearance: none;
    border: 1px solid rgba(138, 90, 43, 0.2);
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(255, 252, 246, 0.88), rgba(244, 233, 213, 0.82));
    color: #6f4720;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.035em;
    text-transform: uppercase;
    box-shadow:
      0 16px 34px rgba(76, 58, 35, 0.13),
      0 2px 7px rgba(76, 58, 35, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      border-color 150ms ease;
  }

  .scriptura-about-button:hover {
    transform: translateY(-2px);
    border-color: rgba(138, 90, 43, 0.34);
    box-shadow:
      0 20px 42px rgba(76, 58, 35, 0.17),
      0 3px 10px rgba(76, 58, 35, 0.09),
      inset 0 1px 0 rgba(255, 255, 255, 0.78);
  }

  .scriptura-about-button:active {
    transform: translateY(1px) scale(0.985);
  }

  .scriptura-about-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 50% 0%, rgba(251, 246, 234, 0.45), transparent 38%),
      rgba(44, 36, 27, 0.34);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: scripturaAboutBackdropIn 180ms ease both;
  }

  .scriptura-about-modal {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    width: min(680px, 100%);
    max-height: min(82vh, 760px);
    overflow-y: auto;
    border: 1px solid rgba(138, 90, 43, 0.2);
    border-radius: 30px;
    background:
      linear-gradient(145deg, rgba(255, 252, 246, 0.97), rgba(246, 238, 222, 0.96));
    box-shadow:
      0 34px 90px rgba(42, 32, 22, 0.26),
      0 8px 24px rgba(42, 32, 22, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
    padding: 28px;
    animation: scripturaAboutModalIn 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .scriptura-about-glow {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.86), transparent 31%),
      radial-gradient(circle at 98% 18%, rgba(95, 120, 144, 0.12), transparent 32%),
      radial-gradient(circle at 10% 100%, rgba(138, 90, 43, 0.08), transparent 34%);
  }

  .scriptura-about-topline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .scriptura-about-eyebrow {
    margin: 0 0 8px;
    color: rgba(166, 116, 72, 0.88);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .scriptura-about-title {
    margin: 0;
    color: #2c241b;
    font-family: var(--font-serif, Georgia, serif);
    font-size: clamp(30px, 4vw, 44px);
    line-height: 1.02;
    letter-spacing: -0.04em;
  }

  .scriptura-about-close {
    appearance: none;
    border: 1px solid rgba(138, 90, 43, 0.16);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.56);
    color: rgba(90, 74, 55, 0.8);
    cursor: pointer;
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    font-size: 24px;
    line-height: 1;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
  }

  .scriptura-about-subtitle {
    margin: 18px 0 0;
    max-width: 58ch;
    color: rgba(44, 36, 27, 0.76);
    font-size: 17px;
    line-height: 1.62;
  }

  .scriptura-about-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 22px;
  }

  .scriptura-about-badge {
    border: 1px solid rgba(95, 120, 144, 0.18);
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(239, 229, 208, 0.48));
    color: #5f7890;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  }

  .scriptura-about-sections {
    display: grid;
    gap: 12px;
    margin-top: 24px;
  }

  .scriptura-about-section {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    border: 1px solid rgba(138, 90, 43, 0.12);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.36);
    padding: 16px;
  }

  .scriptura-about-section-number {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgba(95, 120, 144, 0.18);
    border-radius: 999px;
    background: rgba(245, 249, 252, 0.68);
    color: rgba(95, 120, 144, 0.82);
    font-size: 12px;
    font-weight: 800;
  }

  .scriptura-about-section h3 {
    margin: 1px 0 7px;
    color: #2c241b;
    font-family: var(--font-serif, Georgia, serif);
    font-size: 19px;
    line-height: 1.18;
    letter-spacing: -0.025em;
  }

  .scriptura-about-section p {
    margin: 0;
    color: rgba(44, 36, 27, 0.72);
    font-size: 15px;
    line-height: 1.58;
  }

  .scriptura-about-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(138, 90, 43, 0.14);
    color: rgba(90, 74, 55, 0.58);
    font-family: var(--font-serif, Georgia, serif);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .scriptura-about-done {
    appearance: none;
    border: 1px solid rgba(95, 120, 144, 0.22);
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(247, 238, 222, 0.72));
    color: #5f7890;
    cursor: pointer;
    min-height: 36px;
    padding: 0 15px;
    font-size: 13px;
    font-weight: 700;
    box-shadow:
      0 8px 18px rgba(76, 112, 143, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
  }

  @keyframes scripturaAboutBackdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scripturaAboutModalIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scriptura-about-button,
    .scriptura-about-backdrop,
    .scriptura-about-modal {
      animation: none;
      transition: none;
    }

    .scriptura-about-button,
    .scriptura-about-button:hover,
    .scriptura-about-button:active {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .scriptura-about-button {
      right: max(14px, env(safe-area-inset-right));
      bottom: max(14px, env(safe-area-inset-bottom));
      min-height: 38px;
      padding: 0 13px;
      font-size: 12px;
    }

    .scriptura-about-backdrop {
      padding: 12px;
      align-items: end;
    }

    .scriptura-about-modal {
      max-height: 88vh;
      border-radius: 26px;
      padding: 22px;
    }

    .scriptura-about-section {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .scriptura-about-footer {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
