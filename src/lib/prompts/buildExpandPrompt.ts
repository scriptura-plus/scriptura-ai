import type { Lang } from "../i18n/dictionary";

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
};

const LANG_FENCE = (langName: string) =>
  `LANGUAGE RULE: Your ENTIRE response must be written in ${langName}. ` +
  `Do not use English or any other language. Not a single word.`;

export function buildExpandPrompt(args: {
  angleTitle: string;
  anchor: string;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);
  const tail = `\n\nREMINDER: Write your entire response in ${langName} only.`;

  return (
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `Selected angle: "${args.angleTitle}"\n` +
    `Grounding detail in the verse: "${args.anchor}"\n\n` +
    `Write in ${langName}. Editorial voice: long-form magazine — New Yorker meets Arzamas. ` +
    `Hook first. Story-driven. Precise. Never preachy.\n\n` +
    `Task: Write a focused article (350–500 words) that unfolds this specific angle.\n\n` +
    `Structure your response as follows:\n` +
    `1. Open with a hook — a surprising observation rooted directly in the grounding detail.\n` +
    `2. Explain what makes this detail easy to miss. Show the reader where their eye slides past it.\n` +
    `3. Unfold the insight step by step — what is actually happening here, why the text is doing it, ` +
    `what it changes in how we read the verse.\n` +
    `4. End with a clear, precise takeaway. One or two sentences. No moralizing.\n\n` +
    `Rules:\n` +
    `- Stay rooted in the selected angle and its grounding detail. Do not wander.\n` +
    `- Do not summarize the verse generically.\n` +
    `- Do not add psychology, sociology, or cultural comparison unless the verse demands it.\n` +
    `- No "in conclusion", no sermon language, no throat-clearing.\n` +
    `- Markdown allowed for emphasis and short structure. No h1 headings.` +
    tail
  );
}
