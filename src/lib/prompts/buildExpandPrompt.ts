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
    `Angle to expand: "${args.angleTitle}"\n` +
    `Anchor phrase from the verse: "${args.anchor}"\n\n` +
    `Write in ${langName}. Editorial voice: New Yorker meets Arzamas — precise, story-driven, never preachy.\n\n` +

    `OPENING RULE — this is mandatory:\n` +
    `Your first sentence must directly engage the anchor phrase: "${args.anchor}". ` +
    `Quote it, point at it, or state the observation about it immediately. ` +
    `Do NOT open with any of the following types of sentence:\n` +
    `- A general statement about life, humanity, or the world ("In a world full of...", "Throughout history...", "One of the most important...")\n` +
    `- A moral or inspirational statement ("Forgiveness is a powerful force...", "Kindness transforms lives...")\n` +
    `- A summary of what the verse is generally about\n` +
    `- A rhetorical question about broad human experience\n` +
    `The first sentence must be specific, grounded in the text, and immediately surprising.\n\n` +

    `Task: Write a focused article (350–500 words) that unfolds this specific angle step by step.\n\n` +

    `Structure:\n` +
    `1. HOOK — Open directly with the anchor phrase. State the observation that most readers miss. ` +
    `One or two sentences, no more. The reader should immediately feel: "I never read it that way."\n\n` +
    `2. WHY IT'S EASY TO MISS — Show the reader exactly where their eye slides past this detail. ` +
    `What does the reader assume? What does that assumption make them skip? Be specific.\n\n` +
    `3. UNFOLD — Work through the observation methodically. ` +
    `What is the text actually doing here? Why did the author make this choice? ` +
    `What changes in the verse — or in the surrounding passage — once you see it?\n\n` +
    `4. TAKEAWAY — One or two sentences, compact and precise. ` +
    `State what is now visible that wasn't before. Do not moralize. Do not generalize.\n\n` +

    `Hard rules:\n` +
    `- Stay inside the angle. Every sentence must serve the observation in the title.\n` +
    `- No psychology, sociology, or cultural comparison unless demanded by the anchor itself.\n` +
    `- No sermon language: no "we should", "we must", "let us", "God calls us to".\n` +
    `- No motivational filler: no "this reminds us", "this encourages us", "what a beautiful truth".\n` +
    `- No "in conclusion". Just end when the insight is landed.\n` +
    `- Markdown allowed for emphasis (**bold**) and short structure. No h1 headings.` +
    tail
  );
}
