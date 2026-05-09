import { createHash } from "node:crypto";
import type {
  AngleFamily,
  AngleFingerprint,
  CanonicalAnchorLang,
  VocabularyStatus,
} from "./types";

/**
 * Discovery Refinery v1 fingerprint rules:
 *
 * The hash must depend only on meaning-bearing identity fields:
 * - normalized canonical anchor text
 * - normalized phenomenon
 * - normalized interpretive_move
 * - angle_family
 *
 * It must NOT depend on:
 * - language surface wording
 * - reader_surprise_sentence
 * - title/card text
 * - vocabulary status
 * - risk flags
 * - evidence level
 * - created_at
 *
 * This keeps angle identity stable when a proposed vocabulary item is later
 * promoted to approved_vocab.
 */

const VOCAB_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "for",
  "from",
  "with",
  "and",
  "or",
  "as",
  "by",
  "is",
  "are",
  "be",
  "being",
  "that",
  "this",
  "it",
  "its",
  "into",
  "through",
  "в",
  "во",
  "на",
  "и",
  "или",
  "с",
  "со",
  "из",
  "к",
  "ко",
  "по",
  "для",
  "как",
  "это",
  "этот",
  "эта",
  "the",
]);

export type AngleFingerprintInput = {
  anchor_canonical: {
    lang: CanonicalAnchorLang;
    text: string;
    canonical_pending?: boolean;
  };
  phenomenon: string;
  phenomenon_status?: VocabularyStatus;
  interpretive_move: string;
  interpretive_move_status?: VocabularyStatus;
  angle_family: AngleFamily;
};

export type NormalizedFingerprintParts = {
  anchor_canonical_text: string;
  phenomenon: string;
  interpretive_move: string;
  angle_family: AngleFamily;
};

function stripCombiningMarks(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function collapseSeparators(value: string): string {
  return value
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Anchor normalization is intentionally conservative.
 *
 * We do NOT remove stopwords from anchors, because particles/connectors
 * such as "ибо", "for", "ἐγώ", etc. can be the actual discovery anchor.
 */
export function normalizeAnchorText(value: string): string {
  return collapseSeparators(stripCombiningMarks(value))
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;:!?()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vocabulary normalization is more aggressive than anchor normalization.
 *
 * This is used for phenomenon and interpretive_move, where values should
 * behave like controlled vocabulary keys.
 */
export function normalizeVocabularyValue(value: string): string {
  const normalized = collapseSeparators(stripCombiningMarks(value))
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9_ -]+/gi, " ")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const parts = normalized
    .split("_")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !VOCAB_STOPWORDS.has(part));

  return parts.join("_");
}

export function normalizeFingerprintParts(
  input: AngleFingerprintInput,
): NormalizedFingerprintParts {
  return {
    anchor_canonical_text: normalizeAnchorText(input.anchor_canonical.text),
    phenomenon: normalizeVocabularyValue(input.phenomenon),
    interpretive_move: normalizeVocabularyValue(input.interpretive_move),
    angle_family: input.angle_family,
  };
}

export function hashFingerprintParts(
  parts: NormalizedFingerprintParts,
): string {
  const stablePayload = {
    anchor_canonical_text: parts.anchor_canonical_text,
    phenomenon: parts.phenomenon,
    interpretive_move: parts.interpretive_move,
    angle_family: parts.angle_family,
  };

  const digest = createHash("sha256")
    .update(JSON.stringify(stablePayload))
    .digest("hex");

  return `sha256:${digest}`;
}

export function createAngleFingerprint(
  input: AngleFingerprintInput,
): AngleFingerprint {
  const normalized = normalizeFingerprintParts(input);
  const hash = hashFingerprintParts(normalized);

  return {
    anchor_canonical: {
      lang: input.anchor_canonical.lang,
      text: normalized.anchor_canonical_text,
      canonical_pending: input.anchor_canonical.canonical_pending ?? false,
    },
    phenomenon: normalized.phenomenon,
    phenomenon_status: input.phenomenon_status ?? "proposed_new",
    interpretive_move: normalized.interpretive_move,
    interpretive_move_status: input.interpretive_move_status ?? "proposed_new",
    angle_family: input.angle_family,
    hash,
  };
}

export function hasSameFingerprint(
  a: Pick<AngleFingerprint, "hash">,
  b: Pick<AngleFingerprint, "hash">,
): boolean {
  return Boolean(a.hash && b.hash && a.hash === b.hash);
}

export function explainFingerprintIdentity(
  fingerprint: AngleFingerprint,
): string {
  return [
    `anchor=${fingerprint.anchor_canonical.text}`,
    `phenomenon=${fingerprint.phenomenon}`,
    `interpretive_move=${fingerprint.interpretive_move}`,
    `angle_family=${fingerprint.angle_family}`,
    `hash=${fingerprint.hash}`,
  ].join(" | ");
}

export function createDeterministicId(prefix: string, value: unknown): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);

  return `${prefix}_${digest}`;
}
