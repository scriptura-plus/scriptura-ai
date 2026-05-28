"use client";

import { useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";
import type { Provider } from "@/lib/ai/providers";

const RU_BOOK_DISPLAY: Record<string, string> = {
  genesis: "Бытие",
  exodus: "Исход",
  leviticus: "Левит",
  numbers: "Числа",
  deuteronomy: "Второзаконие",
  joshua: "Иисус Навин",
  judges: "Судей",
  ruth: "Руфь",
  "1 samuel": "1 Самуила",
  "2 samuel": "2 Самуила",
  "1 kings": "1 Царей",
  "2 kings": "2 Царей",
  "1 chronicles": "1 Летопись",
  "2 chronicles": "2 Летопись",
  ezra: "Ездра",
  nehemiah: "Неемия",
  esther: "Есфирь",
  job: "Иов",
  psalms: "Псалмы",
  proverbs: "Притчи",
  ecclesiastes: "Екклесиаст",
  "song of solomon": "Песнь песней",
  isaiah: "Исаия",
  jeremiah: "Иеремия",
  lamentations: "Плач Иеремии",
  ezekiel: "Иезекииль",
  daniel: "Даниил",
  hosea: "Осия",
  joel: "Иоиль",
  amos: "Амос",
  obadiah: "Авдий",
  jonah: "Иона",
  micah: "Михей",
  nahum: "Наум",
  habakkuk: "Аввакум",
  zephaniah: "Софония",
  haggai: "Аггей",
  zechariah: "Захария",
  malachi: "Малахия",
  matthew: "Матфея",
  mark: "Марка",
  luke: "Луки",
  john: "Иоанна",
  acts: "Деяния",
  romans: "Римлянам",
  "1 corinthians": "1 Коринфянам",
  "2 corinthians": "2 Коринфянам",
  galatians: "Галатам",
  ephesians: "Эфесянам",
  philippians: "Филиппийцам",
  colossians: "Колоссянам",
  "1 thessalonians": "1 Фессалоникийцам",
  "2 thessalonians": "2 Фессалоникийцам",
  "1 timothy": "1 Тимофею",
  "2 timothy": "2 Тимофею",
  titus: "Титу",
  philemon: "Филимону",
  hebrews: "Евреям",
  james: "Иакова",
  "1 peter": "1 Петра",
  "2 peter": "2 Петра",
  "1 john": "1 Иоанна",
  "2 john": "2 Иоанна",
  "3 john": "3 Иоанна",
  jude: "Иуды",
  revelation: "Откровение",
};

function displayReference(reference: string, lang: Lang): string {
  if (lang !== "ru") return reference;

  const match = reference.trim().match(/^(.+?)\s+(\d+:\d+(?:-\d+)?)$/);
  if (!match) return reference;

  const book = match[1].trim().toLowerCase();
  const chapterVerse = match[2];
  const ruBook = RU_BOOK_DISPLAY[book];

  return ruBook ? `${ruBook} ${chapterVerse}` : reference;
}

export function VerseDisplay({
  reference,
  lang,
  provider,
  onLoaded,
}: {
  reference: string;
  lang: Lang;
  provider: Provider;
  onLoaded?: (text: string) => void;
}) {
  const t = dictionary[lang];
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const visibleReference = displayReference(reference, lang);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setText("");

    fetch("/api/verse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, lang, provider }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || t.error);
        return j;
      })
      .then((j: { text?: string }) => {
        if (cancelled) return;
        const v = j.text ?? "";
        setText(v);
        onLoaded?.(v);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, lang, provider]);

  return (
    <div className="card">
      <div className="muted" style={{ marginBottom: 8 }}>
        {visibleReference}
      </div>
      {loading && (
        <>
          <div className="skeleton" style={{ width: "92%" }} />
          <div className="skeleton" style={{ width: "80%" }} />
        </>
      )}
      {!loading && error && <div className="error">{error}</div>}
      {!loading && !error && <div className="verse-text">{text}</div>}
    </div>
  );
}