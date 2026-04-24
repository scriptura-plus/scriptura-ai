"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKS } from "@/lib/bible/bibleBooks";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";

export function VersePicker({ lang }: { lang: Lang }) {
  const t = dictionary[lang];
  const router = useRouter();

  const [bookId, setBookId] = useState<string>(BOOKS[0].id);
  const [chapter, setChapter] = useState<number>(1);
  const [verse, setVerse] = useState<number>(1);
  const [free, setFree] = useState("");

  const book = useMemo(
    () => BOOKS.find((b) => b.id === bookId) ?? BOOKS[0],
    [bookId],
  );
  const chapters = useMemo(
    () => Array.from({ length: book.chapters }, (_, i) => i + 1),
    [book],
  );
  // Up to 50 verse choices — the AI gracefully handles real chapter bounds.
  const verses = useMemo(
    () => Array.from({ length: 50 }, (_, i) => i + 1),
    [],
  );

  function go(ref: string) {
    const q = new URLSearchParams({ ref });
    router.push(`/study?${q.toString()}`);
  }

  function onSubmitPicker(e: React.FormEvent) {
    e.preventDefault();
    const ref = `${book[lang]} ${chapter}:${verse}`;
    go(ref);
  }

  function onSubmitFree(e: React.FormEvent) {
    e.preventDefault();
    const ref = free.trim();
    if (ref) go(ref);
  }

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <h2 className="h2">{t.chooseVerse}</h2>

      <form
        onSubmit={onSubmitPicker}
        className="row"
        style={{ gap: 8, alignItems: "flex-end" }}
      >
        <label style={{ flex: "1 1 200px", minWidth: 160 }}>
          <div className="muted" style={{ marginBottom: 4 }}>{t.book}</div>
          <select
            className="select"
            value={bookId}
            onChange={(e) => {
              setBookId(e.target.value);
              setChapter(1);
              setVerse(1);
            }}
          >
            {BOOKS.map((b) => (
              <option key={b.id} value={b.id}>{b[lang]}</option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 90px", minWidth: 80 }}>
          <div className="muted" style={{ marginBottom: 4 }}>{t.chapter}</div>
          <select
            className="select"
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value))}
          >
            {chapters.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 90px", minWidth: 80 }}>
          <div className="muted" style={{ marginBottom: 4 }}>{t.verse}</div>
          <select
            className="select"
            value={verse}
            onChange={(e) => setVerse(Number(e.target.value))}
          >
            {verses.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn btn-primary">
          {t.studyVerse}
        </button>
      </form>

      <div className="divider" style={{ margin: "4px 0" }} />

      <form onSubmit={onSubmitFree} className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder={t.enterReference}
          value={free}
          onChange={(e) => setFree(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn">{t.go}</button>
      </form>
    </div>
  );
}
