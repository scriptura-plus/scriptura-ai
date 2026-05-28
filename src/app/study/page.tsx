"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { VerseDisplay } from "@/components/VerseDisplay";
import { VersePicker } from "@/components/VersePicker";
import { LensTabs } from "@/components/LensTabs";
import { LensResults } from "@/components/LensResults";
import type { LensId } from "@/lib/prompts/buildLensPrompt";



function StudyInner() {
  const params = useSearchParams();
  const rawRef = params.get("ref")?.trim();
  const reference = rawRef || null;

  const lang = "ru" as const;
  const provider = "claude";
  const [lens, setLens] = useState<LensId>("angles");
  const [verseText, setVerseText] = useState<string>("");

  useEffect(() => {
    setVerseText("");
  }, [reference]);

  if (!reference) {
    return (
      <main className="container">
        <Header lang={lang} />
        <div className="spacer" />

        <VersePicker lang={lang} />
      </main>
    );
  }

  return (
    <main className="container">
      <Header lang={lang} />
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










