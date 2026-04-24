import { LANG_NAME, LANG_FENCE, EDITORIAL_VOICE, JARGON_BAN } from "./editorial";
import type { Lang } from "./editorial";

export type ContextLevel = "narrow" | "wide";

export function buildContextPrompt(args: {
  level: ContextLevel;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);

  const shared =
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `All string values must be written in ${langName}.\n\n` +
    `${EDITORIAL_VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n` +
    `STYLE: You are a brilliant friend explaining this at a dinner table — not lecturing, not writing a commentary. ` +
    `You say things like "here's what's interesting" and "most people miss this." ` +
    `Every observation must make the reader feel: I learned something I could not have seen on my own.\n\n`;

  if (args.level === "narrow") {
    return (
      shared +
      `STEP 1 — FORMULATE ONE SHARP THESIS:\n` +
      `Before building cards, write one sentence that reframes how this verse is usually read. ` +
      `This must be a surprise — a contrast between how the verse looks in isolation vs what it does in context.\n` +
      `Format: {"thesis": "..."}\n\n` +
      `Examples of strong thesis:\n` +
      `- "This verse looks like comfort — but in context it follows an accusation, making it a command."\n` +
      `- "Most readers take this as encouragement. In the surrounding argument, it is the conclusion of a proof."\n` +
      `- "Extracted, this sounds gentle. Inside the paragraph, it is the sharpest line Paul writes."\n\n` +
      `STEP 2 — GENERATE 6 NARROW CONTEXT CANDIDATES:\n` +
      `Read 3–5 verses immediately before and after. Generate 6 observations about what changes ` +
      `when this verse is read inside that local movement.\n\n` +
      `For each candidate ask: Is this verse an answer? A climax? A pivot? A correction? A reversal? ` +
      `What does the immediate argument do to this line?\n\n` +
      `STEP 3 — REJECTION TEST:\n` +
      `Reject any candidate that could be written without reading the surrounding verses. ` +
      `Only observations that require the immediate context survive.\n\n` +
      `STEP 4 — BUILD 3 STRONGEST CARDS:\n` +
      `Choose 3 survivors. Each card:\n` +
      `- "title": sharp reframing statement, max 12 words, in ${langName}\n` +
      `- "teaser": 2–3 sentences, dinner-table style, starts with the discovery, in ${langName}\n` +
      `- "shift": exactly what changes in how the verse reads — one sentence, in ${langName}\n` +
      `- "why_it_matters": perceptual shift, one sentence, in ${langName}\n\n` +
      `Output — a single JSON object:\n` +
      `{"thesis":"...","cards":[` +
      `{"title":"...","teaser":"...","shift":"...","why_it_matters":"..."},` +
      `{"title":"...","teaser":"...","shift":"...","why_it_matters":"..."},` +
      `{"title":"...","teaser":"...","shift":"...","why_it_matters":"..."}` +
      `]}\n\n` +
      `JSON only. No markdown fences. All strings in ${langName}.`
    );
  }

  // wide
  return (
    shared +
    `STEP 1 — GENERATE 6 WIDE CONTEXT CANDIDATES:\n` +
    `Step back to the chapter, the book, and the moment of writing. ` +
    `Generate 6 observations about what this verse carries in the larger argument.\n\n` +
    `For each candidate ask: Is this verse doing local work or carrying a whole-book argument? ` +
    `What was at stake — politically, emotionally, rhetorically — in this moment? ` +
    `What would the original audience have understood that a modern reader misses entirely?\n\n` +
    `STEP 2 — REJECTION TEST:\n` +
    `Reject any candidate that is generic historical background. ` +
    `Every surviving observation must land directly on a specific word or phrase in this verse ` +
    `and make it read differently.\n\n` +
    `STEP 3 — BUILD 3 STRONGEST CARDS:\n` +
    `Choose 3 survivors. Each card:\n` +
    `- "title": sharp reframing statement, max 12 words, in ${langName}\n` +
    `- "teaser": 2–3 sentences, dinner-table style, starts with the discovery, in ${langName}\n` +
    `- "shift": exactly what changes in how the verse reads — one sentence, in ${langName}\n` +
    `- "why_it_matters": perceptual shift, one sentence, in ${langName}\n\n` +
    `Output — a JSON array of exactly 3 cards:\n` +
    `[{"title":"...","teaser":"...","shift":"...","why_it_matters":"..."},` +
    `{"title":"...","teaser":"...","shift":"...","why_it_matters":"..."},` +
    `{"title":"...","teaser":"...","shift":"...","why_it_matters":"..."}]\n\n` +
    `JSON only. No markdown fences. All strings in ${langName}.`
  );
}
