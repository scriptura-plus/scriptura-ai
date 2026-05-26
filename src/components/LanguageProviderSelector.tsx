"use client";

import { dictionary, LANGS, type Lang } from "@/lib/i18n/dictionary";

export function LanguageProviderSelector({
  lang,
  onLang,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const t = dictionary[lang];

  return (
    <div className="row" style={{ gap: 12 }}>
      <label style={{ flex: 1, minWidth: 140 }}>
        <div className="muted" style={{ marginBottom: 4 }}>{t.language}</div>
        <select
          className="select"
          value={lang}
          onChange={(e) => onLang(e.target.value as Lang)}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
