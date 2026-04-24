/**
 * Robust JSON extractor for AI responses.
 * Handles: pure JSON, ```json fences, prose before/after JSON.
 * Safe for both client and server (no server-only imports).
 */

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

// Common keys Gemini may use to wrap an array
const ARRAY_WRAPPER_KEYS = [
  "angles", "cards", "items", "results", "data", "words",
  "ракурсы", "карточки", "слова", "анализ",
];

export function extractJSONArray<T>(raw: string): T[] | null {
  const cleaned = stripFences(raw);

  // 1. Direct parse — Gemini with responseMimeType returns clean JSON
  try {
    const val = JSON.parse(cleaned);
    if (Array.isArray(val)) return val as T[];
    // Unwrap known wrapper keys first, then any array-valued key
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      for (const key of ARRAY_WRAPPER_KEYS) {
        if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
          return obj[key] as T[];
        }
      }
      for (const v of Object.values(obj)) {
        if (Array.isArray(v) && v.length > 0) return v as T[];
      }
    }
  } catch { /* fall through */ }

  // 2. Greedy regex — find first [ ... ] span
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const val = JSON.parse(m[0]);
      if (Array.isArray(val)) return val as T[];
    } catch { /* fall through */ }
  }

  console.error("[parseJSON] extractJSONArray failed. Raw preview:", cleaned.slice(0, 300));
  return null;
}

export function extractJSONObject<T extends object>(raw: string): T | null {
  const cleaned = stripFences(raw);

  // 1. Direct parse
  try {
    const val = JSON.parse(cleaned);
    if (val && typeof val === "object" && !Array.isArray(val)) return val as T;
  } catch { /* fall through */ }

  // 2. Greedy regex — find last { ... } span
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const val = JSON.parse(m[0]);
      if (val && typeof val === "object" && !Array.isArray(val)) return val as T;
    } catch { /* fall through */ }
  }

  console.error("[parseJSON] extractJSONObject failed. Raw preview:", cleaned.slice(0, 300));
  return null;
}
