"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LanguageProviderSelector } from "@/components/LanguageProviderSelector";
import { VerseDisplay } from "@/components/VerseDisplay";
import { VersePicker } from "@/components/VersePicker";
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

const entryText = {
  title: "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0438\u0445",
  subtitle:
    "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043d\u0438\u0433\u0443, \u0433\u043b\u0430\u0432\u0443 \u0438 \u0441\u0442\u0438\u0445, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c.",
};

function StudyInner() {
  const params = useSearchParams();
  const rawRef = params.get("ref")?.trim();
  const reference = rawRef || null;

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

  useEffect(() => {
    setVerseText("");
  }, [reference]);

  function onLang(l: Lang) {
    setLang(l);
    localStorage.setItem("scriptura.lang", l);
  }
  function onProvider(p: Provider) {
    setProvider(p);
    localStorage.setItem("scriptura.provider", p);
  }

  if (!reference) {
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

        <section className="card">
          <h1 style={{ marginTop: 0 }}>{entryText.title}</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            {entryText.subtitle}
          </p>
        </section>

        <VersePicker lang={lang} />
      </main>
    );
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

