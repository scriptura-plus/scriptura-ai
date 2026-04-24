"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKS, type Book } from "@/lib/bible/bibleBooks";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";

const ABBR: Record<string, string> = {
  genesis: "Ge", exodus: "Ex", leviticus: "Le", numbers: "Nu",
  deuteronomy: "De", joshua: "Jos", judges: "Jg", ruth: "Ru",
  "1samuel": "1Sa", "2samuel": "2Sa", "1kings": "1Ki", "2kings": "2Ki",
  "1chronicles": "1Ch", "2chronicles": "2Ch", ezra: "Ezr", nehemiah: "Ne",
  esther: "Es", job: "Job", psalms: "Ps", proverbs: "Pr",
  ecclesiastes: "Ec", song: "Ca", isaiah: "Isa", jeremiah: "Jer",
  lamentations: "La", ezekiel: "Eze", daniel: "Da", hosea: "Ho",
  joel: "Joe", amos: "Am", obadiah: "Ob", jonah: "Jon",
  micah: "Mic", nahum: "Na", habakkuk: "Hab", zephaniah: "Zep",
  haggai: "Hag", zechariah: "Zec", malachi: "Mal",
  matthew: "Mt", mark: "Mr", luke: "Lu", john: "Joh",
  acts: "Ac", romans: "Ro", "1corinthians": "1Co", "2corinthians": "2Co",
  galatians: "Ga", ephesians: "Eph", philippians: "Php", colossians: "Col",
  "1thessalonians": "1Th", "2thessalonians": "2Th", "1timothy": "1Ti",
  "2timothy": "2Ti", titus: "Tit", philemon: "Phm", hebrews: "Heb",
  james: "Jas", "1peter": "1Pe", "2peter": "2Pe", "1john": "1Jo",
  "2john": "2Jo", "3john": "3Jo", jude: "Jude", revelation: "Re",
};

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
          ← {t.back}
        </button>
        <div className="picker-step-label">SELECT CHAPTER</div>
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
          ← {t.back}
        </button>
        <div className="picker-step-label">SELECT VERSE</div>
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
      <div className="picker-section-header">Hebrew-Aramaic Scriptures</div>
      <div className="picker-grid picker-grid-books">
        {OT.map((b) => (
          <button
            key={b.id}
            className="picker-btn picker-btn-book picker-btn-ot"
            onClick={() => pickBook(b)}
          >
            {ABBR[b.id] ?? b.id}
          </button>
        ))}
      </div>

      <div className="picker-section-header" style={{ marginTop: 22 }}>
        Christian Greek Scriptures
      </div>
      <div className="picker-grid picker-grid-books">
        {NT.map((b) => (
          <button
            key={b.id}
            className="picker-btn picker-btn-book picker-btn-nt"
            onClick={() => pickBook(b)}
          >
            {ABBR[b.id] ?? b.id}
          </button>
        ))}
      </div>

      <div className="picker-free-row">
        {!freeOpen ? (
          <button
            className="picker-free-toggle"
            onClick={() => setFreeOpen(true)}
          >
            {t.enterReference}
          </button>
        ) : (
          <form onSubmit={onFree} className="row" style={{ gap: 8, width: "100%" }}>
            <input
              className="input"
              placeholder={t.enterReference}
              value={free}
              onChange={(e) => setFree(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            <button type="submit" className="btn">{t.go}</button>
          </form>
        )}
      </div>
    </div>
  );
}
