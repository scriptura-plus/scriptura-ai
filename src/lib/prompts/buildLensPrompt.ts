import type { Lang } from "../i18n/dictionary";

export type LensId = "angles" | "word" | "context" | "translations";

export const LENS_ORDER: LensId[] = ["angles", "word", "context", "translations"];

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
};

const LANG_FENCE = (langName: string) =>
  `LANGUAGE RULE: Your ENTIRE response must be written in ${langName}. ` +
  `Do not use English or any other language. Not a single word. ` +
  `If you are unsure of a term, use the ${langName} equivalent.`;

const VOICE = (langName: string) =>
  `Write in ${langName}. Editorial voice: long-form magazine — New Yorker meets Arzamas. ` +
  `Hook first. Story-driven. Scientifically rigorous, never preachy. ` +
  `No moralizing, no theology lecture, no "in conclusion", no academic throat-clearing. ` +
  `Find the surprising structure, tension, wording, or context most readers miss. ` +
  `Markdown allowed for short headings and bullets. Stay tight: 300–450 words.`;

const JARGON_BAN = `VOICE RULE — MANDATORY:
Write as a premium intellectual magazine explaining an ancient text to an educated secular reader.
The reader is intelligent, curious, and non-devotional. They have not been to church.
Your tone is: calm, precise, warm, intellectually generous. Never devotional, never churchy.

BANNED WORDS — do not use these. If a concept requires one, restate it in plain modern language immediately:
In Russian: благодать, духовный обмен, духовная глубина, духовный рост, божественная практика, моральная обязанность, добродетель, греховность, назидание, назидательный, духовный, благочестие, благочестивый, поучительный, проповеднический, дидактический, сакральный, пастырский
In English: grace (when used as theological jargon), virtue, spiritual depth, spiritual growth, divine practice, moral obligation, sanctification, edifying, piety, pious, didactic, sermonic, sacred (as a dismissive label), pastoral
In Spanish: gracia (teológica), virtud, profundidad espiritual, práctica divina, obligación moral, santificación, edificante, piedad, piadoso, didáctico

SUBSTITUTE PLAIN LANGUAGE:
Instead of "благодать" → "незаслуженная доброта", "уже полученное прощение", "Божьё уже проявленное прощение" (depending on context)
Instead of "grace" → "unearned kindness", "forgiveness already given", "mercy that preceded the request"
Instead of "virtue" → "a way of behaving", "a quality the verse is pointing to"
Instead of "духовный" → "внутренний", "личный", "касающийся отношения человека к миру"

RELIGIOUS TERM RULE: If a term from the original text is genuinely religious and cannot be avoided, name it and then immediately explain it in one plain-language phrase. Do not let religious language pass without translation into normal human speech.`;

export function buildLensPrompt(args: {
  lens: LensId;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);
  const head =
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n${VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n`;
  const tail = `\n\nREMINDER: Respond ONLY in ${langName}. Do not use English unless ${langName} is English.`;

  switch (args.lens) {
    case "angles":
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `All string values must be written in ${langName}.\n\n` +

        `${JARGON_BAN}\n\n` +

        `WHAT AN ANGLE IS:\n` +
        `An angle is a precise observation about how this verse is constructed — how it works mechanically. ` +
        `It is NOT a theme, a topic, a moral lesson, or a broad subject area.\n\n` +

        `WHAT AN ANGLE IS NOT — reject these immediately:\n` +
        `- Abstract noun phrases: "Compassion as the basis of kindness", "Forgiveness as a divine gift"\n` +
        `- Academic topics: "Psychology of forgiveness", "Social dynamics of kindness", "Historical context"\n` +
        `- Moral summaries: "The obligation to forgive", "Ethical dilemmas"\n` +
        `- Religious platitudes: anything that sounds like a sermon point or a devotional thought\n` +
        `- Anything that could appear as a textbook chapter heading\n\n` +

        `THE 7 VALID ANGLE TYPES — each angle must belong to one of these:\n` +
        `1. SEQUENCE — the verse presents ideas in a specific order; the order is the argument\n` +
        `2. CONTRAST — the verse sets two things against each other explicitly or implicitly\n` +
        `3. WORD WEIGHT — a single word carries more force than its plain reading suggests\n` +
        `4. STRUCTURE — the verse has a repeated, chiastic, or ladder-like pattern\n` +
        `5. CAUSE/MEASURE — one clause sets the standard or measure for another\n` +
        `6. INCLUSION/OMISSION — the verse includes or leaves out something a reader expects\n` +
        `7. PHRASE FORCE — a small phrase (often overlooked) changes the emotional pressure of the whole sentence\n\n` +

        `EXAMPLES OF GOOD ANGLES (for Ephesians 4:32 as reference):\n` +
        `- "Paul opens with tenderness, not forgiveness — the sequence is deliberate" (SEQUENCE)\n` +
        `- "Three actions form a ladder, not a list" (STRUCTURE)\n` +
        `- "Forgiveness is measured not by the offense but by mercy already received" (CAUSE/MEASURE)\n` +
        `- "The phrase 'one another' makes this verse mutual, not individual" (PHRASE FORCE)\n` +
        `- "Compassion here is not politeness but an inner response" (WORD WEIGHT)\n\n` +

        `EXAMPLES OF BAD ANGLES (never return these):\n` +
        `- "Compassion as the foundation of kindness"\n` +
        `- "Forgiveness as a divine gift"\n` +
        `- "The importance of being kind to others"\n` +
        `- "Psychological dimensions of forgiveness"\n` +
        `- "Socio-historical setting of Ephesus"\n` +
        `- "God's grace as the model for human behavior" ← uses banned framing\n\n` +

        `TITLE FORMAT RULE:\n` +
        `The title must describe what the verse DOES, not what it is ABOUT. ` +
        `It must read like a specific observation, not a noun phrase or topic. ` +
        `Valid opening patterns: "Paul leads with...", "The verse omits...", "Three words form...", "The phrase X shifts...", "The order here is not what it seems..."\n` +
        `Write titles in ${langName}. Do not use any banned words in titles.\n\n` +

        `Task: Return a JSON array of exactly 4 angle objects. Output JSON only — no markdown fences, no prose, no explanation before or after.\n\n` +

        `Each object must have exactly these keys:\n` +
        `- "title": concrete observation as a statement (not a topic), max 12 words, in ${langName}, no banned words\n` +
        `- "teaser": 2-3 sentences — explain what the reader probably missed, starting from the specific textual detail, plain modern language, in ${langName}\n` +
        `- "anchor": exact word, phrase, or structural pattern quoted from the verse that grounds this angle, in ${langName}\n` +
        `- "why_it_matters": 1 sentence — how noticing this changes how the verse reads, in plain language, in ${langName}\n\n` +

        `Additional rules:\n` +
        `- The 4 angles must belong to 4 different angle types from the list above\n` +
        `- Each angle must be grounded in a specific textual detail, not the verse's general subject\n` +
        `- No two angles may make the same basic point in different words\n` +
        `- No banned jargon in any field\n\n` +

        `Output format — valid JSON array only, nothing else:\n` +
        `[{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."},{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."},{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."},{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."}]` +
        `\n\nREMINDER: Return JSON only. All string values in ${langName}. No banned words.`
      );

    case "word":
      return (
        head +
        `Task: Pick 2–3 individual words or short phrases in this verse whose original-language meaning, etymology, ` +
        `or usage elsewhere in scripture changes how the verse lands. ` +
        `For each: the original word (Hebrew or Greek, with transliteration), what it normally means, what it does here, ` +
        `and where else it shows up that's worth knowing. Be precise. No hand-waving.` +
        tail
      );

    case "context":
      return (
        head +
        `Task: Build the context around this verse in three layers, then close with one short payoff. ` +
        `Use these section headings exactly (written in ${langName}):\n\n` +
        `**Narrow context** — what comes in the few verses immediately before and after, ` +
        `and how that frame changes the way this verse reads. Quote a short connecting phrase or two.\n\n` +
        `**Wider context** — where this verse sits inside the chapter, the book's overall arc, ` +
        `and the historical moment the book belongs to. What is the writer building toward at this point?\n\n` +
        `**What only context reveals** — name 1–2 things in the verse that look ordinary on their own ` +
        `but become surprising, ironic, urgent, or pointed once the surrounding material is in view. ` +
        `Be specific; cite the line that does the revealing.\n\n` +
        `**Payoff** — one sentence that lands the insight.\n\n` +
        `Avoid devotional throat-clearing, generic commentary, and textbook recap. ` +
        `Lead the Narrow context paragraph with the most under-appreciated detail, not chronology.` +
        tail
      );

    case "translations":
      return (
        head +
        `Task: Compare 3–4 notable translations of this verse (across English, Russian, and Spanish traditions as relevant) ` +
        `and surface the places where they diverge. For each divergence: which word or phrase, how the translations differ, ` +
        `and what is actually at stake in that choice. ` +
        `End with a one-sentence verdict on which choice you find most defensible and why.` +
        tail
      );
  }
}
