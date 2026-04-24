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
    `Verse: ${args.reference}\n"${args.verseText}"\n\n${VOICE(langName)}\n\n`;
  const tail = `\n\nREMINDER: Respond ONLY in ${langName}. Do not use English unless ${langName} is English.`;

  switch (args.lens) {
    case "angles":
      return (
        head +
        `Task: Propose 4 NON-OBVIOUS research angles through which a serious reader could study this verse more deeply. ` +
        `These are not summaries or moral lessons — they are doorways. ` +
        `Each angle must (a) name a specific tension, gap, or hidden structure in or around the verse, ` +
        `(b) state in one sentence why it matters, ` +
        `(c) suggest one concrete next move (e.g. compare with passage X, look up the Hebrew/Greek of word Y, read alongside text Z). ` +
        `Format as four short numbered sections, each opening with a magazine-style headline.` +
        tail
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
