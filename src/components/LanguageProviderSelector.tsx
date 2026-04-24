"use client";

import { dictionary, LANGS, type Lang } from "@/lib/i18n/dictionary";
import { PROVIDERS, type Provider } from "@/lib/ai/providers";

export function LanguageProviderSelector({
  lang,
  provider,
  onLang,
  onProvider,
}: {
  lang: Lang;
  provider: Provider;
  onLang: (l: Lang) => void;
  onProvider: (p: Provider) => void;
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

      <label style={{ flex: 1, minWidth: 140 }}>
        <div className="muted" style={{ marginBottom: 4 }}>{t.provider}</div>
        <select
          className="select"
          value={provider}
          onChange={(e) => onProvider(e.target.value as Provider)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
