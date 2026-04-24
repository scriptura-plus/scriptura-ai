"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LanguageProviderSelector } from "@/components/LanguageProviderSelector";
import { VersePicker } from "@/components/VersePicker";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import {
  defaultProvider,
  isProvider,
  type Provider,
} from "@/lib/ai/providers";

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [provider, setProvider] = useState<Provider>(defaultProvider());

  useEffect(() => {
    const storedLang = localStorage.getItem("scriptura.lang");
    if (storedLang === "en" || storedLang === "ru" || storedLang === "es") {
      setLang(storedLang);
    }
    const storedProvider = localStorage.getItem("scriptura.provider");
    if (isProvider(storedProvider)) setProvider(storedProvider);
  }, []);

  function onLang(l: Lang) {
    setLang(l);
    localStorage.setItem("scriptura.lang", l);
  }
  function onProvider(p: Provider) {
    setProvider(p);
    localStorage.setItem("scriptura.provider", p);
  }

  const t = dictionary[lang];
  return (
    <main className="container">
      <Header lang={lang} />
      <h1 className="h1">{t.appName}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{t.tagline}</p>
      <div className="spacer" />
      <LanguageProviderSelector
        lang={lang}
        provider={provider}
        onLang={onLang}
        onProvider={onProvider}
      />
      <div className="spacer" />
      <VersePicker lang={lang} />
    </main>
  );
}
