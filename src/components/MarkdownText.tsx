"use client";

import React from "react";

/**
 * Tiny, dependency-free Markdown renderer for AI lens output.
 * Supports: # ## ### headings, **bold**, *italic*, `code`,
 * bullet lists (- or *), numbered lists, and paragraphs with soft line breaks.
 * Intentionally minimal — no links, no tables, no HTML.
 */
export function MarkdownText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
}

function renderBlock(block: string, key: number): React.ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n");

  // Single-line heading
  const h = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (h && lines.length === 1) {
    const level = Math.min(h[1].length + 1, 4); // h2..h4
    const tag = (`h${level}` as unknown) as keyof React.JSX.IntrinsicElements;
    return React.createElement(tag, { key }, renderInline(h[2]));
  }

  // Bullet list
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
    return (
      <ul key={key}>
        {lines.map((l, j) => (
          <li key={j}>{renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  // Numbered list
  if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
    return (
      <ol key={key}>
        {lines.map((l, j) => (
          <li key={j}>{renderInline(l.replace(/^\s*\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }

  // Paragraph: keep soft line breaks within a block
  return (
    <p key={key}>
      {lines.map((l, j) => (
        <React.Fragment key={j}>
          {j > 0 && <br />}
          {renderInline(l)}
        </React.Fragment>
      ))}
    </p>
  );
}

function renderInline(s: string): React.ReactNode {
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      parts.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    } else {
      parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
