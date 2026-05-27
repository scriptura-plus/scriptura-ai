"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKS, type Book } from "@/lib/bible/bibleBooks";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";



/**
 * Canonical color-group system.
 *
 * darker  â€” Pentateuch Â· Major+Minor Prophets Â· Four Gospels Â· Revelation
 * lighter â€” Historical books (Joshâ€“Esther) Â· Acts
 * mid     â€” Wisdom/Poetic (Jobâ€“Song) Â· Epistles (Româ€“Jude)
 */
const DARKER_BOOKS = new Set([
  // Pentateuch
  "genesis","exodus","leviticus","numbers","deuteronomy",
  // Major + Minor Prophets
  "isaiah","jeremiah","lamentations","ezekiel","daniel",
  "hosea","joel","amos","obadiah","jonah","micah","nahum",
  "habakkuk","zephaniah","haggai","zechariah","malachi",
  // Four Gospels
  "matthew","mark","luke","john",
  // Revelation
  "revelation",
]);

const LIGHTER_BOOKS = new Set([
  // Historical books
  "joshua","judges","ruth",
  "1samuel","2samuel","1kings","2kings",
  "1chronicles","2chronicles","ezra","nehemiah","esther",
  // Acts
  "acts",
]);

// Mid = Wisdom/Poetic + Epistles â€” everything not in the above two sets

function bookGroupClass(id: string): string {
  if (DARKER_BOOKS.has(id)) return "picker-btn-group-darker";
  if (LIGHTER_BOOKS.has(id)) return "picker-btn-group-lighter";
  return "picker-btn-group-mid";
}

const OT = BOOKS.slice(0, 39);
const NT = BOOKS.slice(39);

type Step = "book" | "chapter" | "verse";

export function VersePicker({ lang }: { lang: Lang }) {
  const t = dictionary[lang];
  const router = useRouter();

  const [step, setStep] = useState<Step>("book");
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [freeOpen, setFreeOpen] = useState(false);
  const [free, setFree] = useState("");

  function go(ref: string) {
    router.push(`/study?${new URLSearchParams({ ref }).toString()}`);
  }

  function pickBook(b: Book) {
    setBook(b);
    setChapter(null);
    setStep("chapter");
  }

  function pickChapter(c: number) {
    setChapter(c);
    setStep("verse");
  }

  function pickVerse(v: number) {
    if (!book || !chapter) return;
    go(`${book[lang]} ${chapter}:${v}`);
  }

  function onFree(e: React.FormEvent) {
    e.preventDefault();
    const ref = free.trim();
    if (ref) go(ref);
  }

  if (step === "chapter" && book) {
    const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);
    return (
      <div className="picker-root">
        <button className="picker-back" onClick={() => setStep("book")}>
          {"\u2190"} {t.back}
        </button>
        <div className="picker-step-label">ВЫБЕРИТЕ ГЛАВУ</div>
        <div className="picker-book-title">{book[lang]}</div>
        <div className="picker-grid picker-grid-numbers">
          {chapters.map((c) => (
            <button
              key={c}
              className="picker-btn picker-btn-number"
              onClick={() => pickChapter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "verse" && book && chapter !== null) {
    const verseCount = book.versesPerChapter[chapter - 1] ?? 30;
    const verses = Array.from({ length: verseCount }, (_, i) => i + 1);
    return (
      <div className="picker-root">
        <button className="picker-back" onClick={() => setStep("chapter")}>
          {"\u2190"} {t.back}
        </button>
        <div className="picker-step-label">ВЫБЕРИТЕ СТИХ</div>
        <div className="picker-book-title">{book[lang]} {chapter}</div>
        <div className="picker-grid picker-grid-numbers">
          {verses.map((v) => (
            <button
              key={v}
              className="picker-btn picker-btn-number"
              onClick={() => pickVerse(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="picker-root">
      <div className="picker-section-header">ЕВРЕЙСКО-АРАМЕЙСКИЕ ПИСАНИЯ</div>
      <div className="picker-grid picker-grid-books">
        {OT.map((b) => (
          <button
            key={b.id}
            className={`picker-btn picker-btn-book ${bookGroupClass(b.id)}`}
            onClick={() => pickBook(b)}
          >
            {b.ru}
          </button>
        ))}
      </div>

      <div className="picker-section-header" style={{ marginTop: 22 }}>
        ХРИСТИАНСКИЕ ГРЕЧЕСКИЕ ПИСАНИЯ
      </div>
      <div className="picker-grid picker-grid-books">
        {NT.map((b) => (
          <button
            key={b.id}
            className={`picker-btn picker-btn-book ${bookGroupClass(b.id)}`}
            onClick={() => pickBook(b)}
          >
            {b.ru}
          </button>
        ))}
      </div>

    </div>
  );
}




