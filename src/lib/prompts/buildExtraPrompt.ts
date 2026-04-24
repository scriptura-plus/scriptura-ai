import {
  LANG_NAME,
  LANG_FENCE,
  LANG_TAIL,
  EDITORIAL_VOICE,
  JARGON_BAN,
  OUTPUT_STRUCTURE,
} from "./editorial";
import type { Lang } from "./editorial";

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

const TASKS: Record<ExtraId, string> = {

  genre:
    `Task: Analyze the literary genre of this verse in 2–3 discovery blocks.\n\n` +
    `For each block:\n` +
    `- Find one specific thing the genre does in this verse that would surprise a modern reader\n` +
    `- Show what the genre promises its original audience — and where this verse fulfills or breaks that promise\n` +
    `- Write in dinner-table style: smart, direct, no academic throat-clearing\n\n` +
    `REJECT any block that could be written without knowing this specific verse.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `2–3 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  rhetorical:
    `Task: Find 2–3 rhetorical devices in this verse that actually do something surprising.\n\n` +
    `For each block:\n` +
    `- Name the exact phrase where the device operates\n` +
    `- Show what the device produces — not "this creates emphasis" but precisely how it shifts the reader's experience\n` +
    `- Go deep on 1 device rather than listing many shallowly\n` +
    `- Write in dinner-table style: smart, direct, concrete\n\n` +
    `REJECT any block that names a device without showing its specific effect in this verse.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `2–3 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  structure:
    `Task: Map the internal structure of this verse in 2–3 discovery blocks.\n\n` +
    `For each block:\n` +
    `- Show what the arrangement produces — not "first this, then that" but why the order matters\n` +
    `- Ask: what would the verse lose if reordered? What does the structure make feel inevitable?\n` +
    `- Zoom out: what structural work does this verse do inside the larger argument?\n` +
    `- Write in dinner-table style: smart, direct, concrete\n\n` +
    `REJECT any block that describes structure without connecting it to meaning.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `2–3 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  socio:
    `Task: Reconstruct 2–3 things the original audience knew that a modern reader misses.\n\n` +
    `For each block:\n` +
    `- Lead with one precise social, historical, or cultural detail\n` +
    `- Show exactly how it lands on a specific word or phrase in this verse\n` +
    `- Make it feel revelatory — not encyclopedic\n` +
    `- Write in dinner-table style: "here's what's interesting — ancient readers would have heard X"\n\n` +
    `REJECT any block that gives generic historical background without changing how a specific word reads.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `2–3 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  intertext:
    `Task: Find 2–3 intertextual connections that actually change how this verse reads.\n\n` +
    `For each block:\n` +
    `- Name the connection clearly\n` +
    `- Show what new meaning emerges when the two texts are heard together\n` +
    `- Do not settle for "this echoes Genesis" — show what the echo does\n` +
    `- Write in dinner-table style: smart, direct, surprising\n\n` +
    `REJECT any connection that does not change how the verse reads.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `2–3 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  linguistic:
    `Task: Do a close linguistic analysis in 2–3 discovery blocks.\n\n` +
    `For each block:\n` +
    `- Cite the original Greek or Hebrew word with transliteration\n` +
    `- Show what it carries that the translation cannot capture\n` +
    `- Show how that gap changes what a reader understands\n` +
    `- Write as discoveries, not grammar notes\n` +
    `- Dinner-table style: "the translation gives you X — the Greek says something closer to Y"\n\n` +
    `REJECT any block that describes a word without showing what the translation loses.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `2–3 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,
};

export function buildExtraPrompt(args: {
  id: ExtraId;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);

  const task = TASKS[args.id].replace(/TARGET_LANGUAGE/g, langName);

  return (
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `${EDITORIAL_VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n` +
    task
  );
}
