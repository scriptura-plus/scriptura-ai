"use client";

import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import { LENS_ORDER, type LensId } from "@/lib/prompts/buildLensPrompt";

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
    <div className="tab-row" role="tablist">
      {LENS_ORDER.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={`tab ${active === id ? "active" : ""}`}
          onClick={() => onChange(id)}
        >
          {t[id]}
        </button>
      ))}
    </div>
  );
}
