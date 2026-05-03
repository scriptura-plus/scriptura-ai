"use client";

import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import { LENS_ORDER, type LensId } from "@/lib/prompts/buildLensPrompt";

function getPublicLensLabel(lang: Lang, id: LensId, fallback: string): string {
  if (id !== "angles") return fallback;

  if (lang === "ru") return "Жемчужины";
  if (lang === "es") return "Perlas";
  return "Pearls";
}

export function LensTabs({
  lang,
  active,
  onChange,
}: {
  lang: Lang;
  active: LensId;
  onChange: (l: LensId) => void;
}) {
  const t = dictionary[lang].lenses;

  return (
    <>
      <style>{`
        .tab-row.scriptura-lens-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
          align-items: center;
        }

        .scriptura-lens-tabs .tab {
          min-width: 0;
          width: 100%;
          white-space: nowrap;
          justify-content: center;
          text-align: center;
          line-height: 1;
          transform: translateY(0);
          transition:
            transform 140ms ease,
            box-shadow 140ms ease,
            background 140ms ease,
            border-color 140ms ease,
            color 140ms ease;
        }

        .scriptura-lens-tabs .tab:active {
          transform: translateY(1px) scale(0.985);
        }

        .scriptura-lens-tabs .tab.active {
          box-shadow:
            0 10px 24px rgba(76, 112, 143, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        @media (max-width: 520px) {
          .tab-row.scriptura-lens-tabs {
            gap: 7px;
          }

          .scriptura-lens-tabs .tab {
            padding: 11px 8px;
            font-size: 14px;
            border-radius: 999px;
            letter-spacing: -0.02em;
          }
        }

        @media (max-width: 390px) {
          .tab-row.scriptura-lens-tabs {
            gap: 6px;
          }

          .scriptura-lens-tabs .tab {
            padding: 10px 6px;
            font-size: 13px;
            letter-spacing: -0.035em;
          }
        }
      `}</style>

      <div className="tab-row scriptura-lens-tabs" role="tablist">
        {LENS_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={`tab ${active === id ? "active" : ""}`}
            onClick={() => onChange(id)}
          >
            {getPublicLensLabel(lang, id, t[id])}
          </button>
        ))}
      </div>
    </>
  );
}
