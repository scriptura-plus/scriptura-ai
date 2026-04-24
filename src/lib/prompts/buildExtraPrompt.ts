import type { Lang } from "../i18n/dictionary";

export type ExtraId =
  | "genre"
  | "rhetorical"
  | "structure"
  | "socio"
  | "intertext"
  | "linguistic";

export const EXTRA_ORDER: ExtraId[] = [
  "genre",
  "rhetorical",
  "structure",
  "socio",
  "intertext",
  "linguistic",
];

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
  `Write in ${langName}. Editorial voice: long-form magazine — hook first, story-driven, ` +
  `scientifically rigorous, never preachy. No moralizing. No academic throat-clearing. ` +
  `Find what most readers miss. Markdown allowed. 250–400 words.`;

const TASKS: Record<ExtraId, string> = {
  genre:
    `Identify the literary genre(s) at work in and around this verse ` +
    `(e.g. wisdom poetry, apocalyptic, parable, prophetic oracle, epistolary argument, narrative). ` +
    `Show how the genre's conventions shape what the verse can and cannot be doing.`,
  rhetorical:
    `Surface the rhetorical devices operating in this verse — chiasm, parallelism, inclusio, irony, ` +
    `repetition, rhetorical question, hyperbole, etc. ` +
    `Quote the verse where the device lives. Don't list devices abstractly.`,
  structure:
    `Map the verse's internal structure and its placement in the chapter and book. ` +
    `Use a tiny outline if useful. Show what the structure is doing — what it builds toward, what it cuts away.`,
  socio:
    `Place the verse in its socio-historical setting: who was writing, to whom, ` +
    `under what political, economic, and religious conditions. ` +
    `Lead with the detail a modern reader is most likely to be missing.`,
  intertext:
    `Trace 2–4 intertextual connections — earlier scripture quoted or echoed here, ` +
    `and later texts that reach back to this one. ` +
    `For each: what is the link, and what does the link do to the meaning?`,
  linguistic:
    `Do a tight linguistic analysis: original-language word choice, syntax, verbal aspect, ` +
    `and ambiguities the translations smooth over. Be specific. Cite the Hebrew or Greek with transliteration.`,
};

export function buildExtraPrompt(args: {
  id: ExtraId;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);
  const tail = `\n\nREMINDER: Respond ONLY in ${langName}. Do not use English unless ${langName} is English.`;
  return (
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n${VOICE(langName)}\n\n` +
    `Task: ${TASKS[args.id]}` +
    tail
  );
}
