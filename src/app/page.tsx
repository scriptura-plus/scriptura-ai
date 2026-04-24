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

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [provider, setProvider] = useState<Provider>(defaultProvider());

  useEffect(() => {
    const sl = localStorage.getItem("scriptura.lang");
    if (sl === "en" || sl === "ru" || sl === "es") setLang(sl as Lang);
    const sp = localStorage.getItem("scriptura.provider");
    if (isProvider(sp)) setProvider(sp);
  }, []);

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
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <select
            className="home-select"
            value={provider}
            onChange={(e) => onProvider(e.target.value as Provider)}
            aria-label="AI provider"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <VersePicker lang={lang} />
    </main>
  );
}
