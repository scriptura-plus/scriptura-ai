"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LanguageProviderSelector } from "@/components/LanguageProviderSelector";
import { VerseDisplay } from "@/components/VerseDisplay";
import { LensTabs } from "@/components/LensTabs";
import { LensResults } from "@/components/LensResults";
import { ExtraAnalysis } from "@/components/ExtraAnalysis";
import type { Lang } from "@/lib/i18n/dictionary";
import {
  defaultProvider,
  isProvider,
  type Provider,
} from "@/lib/ai/providers";
import type { LensId } from "@/lib/prompts/buildLensPrompt";

function StudyInner() {
  const params = useSearchParams();
  const reference = (params.get("ref") ?? "John 3:16").trim();

  const [lang, setLang] = useState<Lang>("en");
  const [provider, setProvider] = useState<Provider>(defaultProvider());
  const [lens, setLens] = useState<LensId>("angles");
  const [verseText, setVerseText] = useState<string>("");

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

  return (
    <main className="container">
      <Header lang={lang} showBack />
      <LanguageProviderSelector
        lang={lang}
        provider={provider}
        onLang={onLang}
        onProvider={onProvider}
      />
      <div className="spacer" />

      <VerseDisplay
        reference={reference}
        lang={lang}
        provider={provider}
        onLoaded={setVerseText}
      />

      <LensTabs lang={lang} active={lens} onChange={setLens} />

      {verseText ? (
        <LensResults
          lens={lens}
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      ) : (
        <div className="card">
          <div className="skeleton" style={{ width: "60%" }} />
          <div className="skeleton" style={{ width: "82%" }} />
        </div>
      )}

      {verseText && (
        <ExtraAnalysis
          reference={reference}
          verseText={verseText}
          lang={lang}
          provider={provider}
        />
      )}
    </main>
  );
}

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <main className="container">
          <div className="card">
            <div className="skeleton" style={{ width: "60%" }} />
            <div className="skeleton" style={{ width: "80%" }} />
          </div>
        </main>
      }
    >
      <StudyInner />
    </Suspense>
  );
}
