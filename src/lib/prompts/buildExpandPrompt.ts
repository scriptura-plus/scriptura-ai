import type { Lang } from "../i18n/dictionary";

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
};

const LANG_FENCE = (langName: string) =>
  `LANGUAGE RULE: Your ENTIRE response must be written in ${langName}. ` +
  `Do not use English or any other language. Not a single word.`;

const JARGON_BAN = `VOICE RULE — MANDATORY:
You are writing for a premium intellectual magazine. Your reader is educated, curious, and non-devotional.
Write as if explaining an ancient text to someone who has never been to church and has no interest in going.
Tone: calm, precise, warm, intellectually generous. Never devotional. Never churchy. Never inspirational.

BANNED WORDS — if a concept requires one, restate it in plain modern language immediately:
In Russian: благодать, духовный обмен, духовная глубина, духовный рост, божественная практика, моральная обязанность, добродетель, греховность, назидание, духовный, благочестие, поучительный, проповеднический, сакральный
In English: grace (as theological jargon), virtue, spiritual depth, spiritual growth, divine practice, moral obligation, sanctification, edifying, piety, pious, sermonic, pastoral
In Spanish: gracia (teológica), virtud, profundidad espiritual, santificación, edificante, piedad, piadoso

PLAIN LANGUAGE SUBSTITUTES:
"благодать" → "незаслуженная доброта", "уже полученное прощение", "Божьё уже проявленное прощение"
"grace" → "unearned kindness", "forgiveness already given", "mercy that preceded any request"
"virtue" → "a quality the verse names", "the way of behaving the text is pointing to"
"духовный" → "внутренний", "личный", "относящийся к тому, как человек относится к другим"

RELIGIOUS TERM RULE: If the verse contains a term that is genuinely theological and cannot be avoided,
name it once, then immediately explain it in one plain-language phrase in parentheses or with a dash.
Do not let it sit alone as if its meaning is obvious.`;

export function buildExpandPrompt(args: {
  angleTitle: string;
  anchor: string;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);
  const tail = `\n\nREMINDER: Write your entire response in ${langName} only. No banned words.`;

  return (
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `Angle to expand: "${args.angleTitle}"\n` +
    `Anchor phrase from the verse: "${args.anchor}"\n\n` +

    `${JARGON_BAN}\n\n` +

    `OPENING RULE — this is mandatory:\n` +
    `Your first sentence must directly engage the anchor phrase: "${args.anchor}". ` +
    `Quote it, point at it, or immediately state the observation about it. ` +
    `Do NOT open with any of the following:\n` +
    `- A general statement about life, humanity, or the world ("In a world full of...", "Throughout history...", "One of the most important...")\n` +
    `- A moral or inspirational statement ("Forgiveness is a powerful force...", "Kindness transforms us...")\n` +
    `- A devotional opener ("This verse teaches us...", "God reminds us here...")\n` +
    `- A summary of what the verse is generally about\n` +
    `- A rhetorical question about broad human experience\n` +
    `The first sentence must be specific, grounded in the text, and immediately surprising or precise.\n\n` +

    `Task: Write a focused article (350–500 words) that unfolds this specific angle step by step. Write in ${langName}.\n\n` +

    `Structure:\n` +
    `1. HOOK — Open directly with the anchor phrase. State the observation that most readers miss. ` +
    `One or two sentences. The reader should immediately feel: "I never read it that way."\n\n` +
    `2. WHY IT'S EASY TO MISS — Show exactly where the reader's eye slides past this detail. ` +
    `What does the reader assume on a first pass? What does that assumption cause them to skip? Be specific.\n\n` +
    `3. UNFOLD — Work through the observation methodically. ` +
    `What is the text actually doing here? Why this word order, this phrasing, this structure? ` +
    `What changes in the verse once you see it?\n\n` +
    `4. TAKEAWAY — One or two sentences, compact and precise. ` +
    `State what is now visible that wasn't before. Do not moralize. Do not generalize.\n\n` +

    `Hard rules:\n` +
    `- Stay inside the angle. Every sentence must serve the observation named in the title.\n` +
    `- No psychology, sociology, or cultural comparison unless demanded by the anchor word itself.\n` +
    `- No sermon language: no "we should", "we must", "let us", "God calls us to", "this verse teaches".\n` +
    `- No motivational filler: no "this reminds us", "this encourages us", "what a beautiful truth".\n` +
    `- No banned words. If a religious term appears in the verse, translate it immediately into plain language.\n` +
    `- No "in conclusion". Just end when the insight is complete.\n` +
    `- Markdown allowed for emphasis (**bold**) and short structure. No h1 headings.` +
    tail
  );
}
