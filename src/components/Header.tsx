"use client";

import Link from "next/link";
import { dictionary, type Lang } from "@/lib/i18n/dictionary";

export function Header({ lang, showBack }: { lang: Lang; showBack?: boolean }) {
  const t = dictionary[lang];
  return (
    <header
      className="row"
      style={{ justifyContent: "space-between", marginBottom: 24 }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "var(--ink)",
        }}
      >
        <span aria-hidden style={{ fontSize: 22 }}>📜</span>
        <span style={{ fontFamily: "var(--serif)", fontSize: 22 }}>
          {t.appName}
        </span>
      </Link>
      {showBack && (
        <Link href="/" className="btn btn-ghost">
          ← {t.back}
        </Link>
      )}
    </header>
  );
}
