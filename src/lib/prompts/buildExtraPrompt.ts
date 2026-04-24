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

  // ─── GENRE ────────────────────────────────────────────────────────────────
  genre:
    `Task: Identify the literary genre at work in this verse — but do not just name it. ` +
    `Treat genre as a set of promises the text makes to its original audience. ` +
    `Then show how this verse fulfills, exploits, or quietly breaks those promises.\n\n` +
    `Ask:\n` +
    `- What expectations does this genre create in its original audience?\n` +
    `- What can this genre say that another genre (narrative, lament, law, apocalypse) could not say here?\n` +
    `- Where does the verse behave according to convention — and where does it push against it?\n` +
    `- What happens when a modern reader mistakes the genre? What do they hear that isn't there?\n\n` +
    `Lead with the observation that will surprise the reader most. ` +
    `Genre must feel like a discovery, not a classification. ` +
    `Avoid: "This verse belongs to the epistolary genre." ` +
    `Aim for: "Paul is writing argument here, not instruction — and that changes everything about how the verse asks to be read."`,

  // ─── RHETORICAL ───────────────────────────────────────────────────────────
  rhetorical:
    `Task: Identify the rhetorical operations at work in this verse.\n\n` +
    `RULE: No naming without effect. If you identify a device — parallelism, chiasm, asyndeton, ` +
    `repetition, contrast, escalation, inclusio, irony, rhetorical question, hyperbole — ` +
    `you must immediately show what that device does to the reader: how it creates pressure, ` +
    `shifts focus, changes what is expected, or alters the emotional temperature of the sentence.\n\n` +
    `For each device:\n` +
    `1. Quote the exact phrase or structure in the verse where it operates.\n` +
    `2. Name what the device is (briefly).\n` +
    `3. Show what it produces — the effect on the logic, the rhythm, the reader's experience.\n\n` +
    `Do not list devices abstractly. Do not say "this creates emphasis" without showing how. ` +
    `Pick the 1–2 devices with the most force, and go deep rather than covering all of them shallowly. ` +
    `The reader should finish thinking: "The verse was doing something I could not see before."`,

  // ─── STRUCTURE ────────────────────────────────────────────────────────────
  structure:
    `Task: Map the verse's internal structure — but only in service of showing what the structure produces.\n\n` +
    `Ask:\n` +
    `- What is foregrounded? What is delayed? Why?\n` +
    `- What does the arrangement make feel inevitable?\n` +
    `- What would the verse lose — in force, in logic, in surprise — if the order were different?\n` +
    `- Where does the structure create emphasis, escalation, or reversal?\n\n` +
    `Then zoom out: where does this verse sit in the chapter's architecture? ` +
    `Is it a pivot? A climax? A setup for what follows? ` +
    `Show what structural work the verse is doing inside the larger argument.\n\n` +
    `Do not reduce structure to "first this, then that." ` +
    `Every structural observation must connect to meaning. ` +
    `Treat arrangement as the argument — because it is.`,

  // ─── SOCIO-HISTORICAL ─────────────────────────────────────────────────────
  socio:
    `Task: Reconstruct what the original audience knew — or feared, or assumed — that a modern reader simply misses.\n\n` +
    `Ask:\n` +
    `- What social reality makes this verse sharper, stranger, or more charged than it looks?\n` +
    `- What customs, institutions, class dynamics, political pressures, or emotional codes stand behind the language?\n` +
    `- What would an ancient listener hear in this verse that we read right past?\n` +
    `- What does the verse quietly assume its audience already knows?\n\n` +
    `Lead with the one historical or social detail that would most surprise a modern reader. ` +
    `Show exactly how it changes a specific word or phrase.\n\n` +
    `RULE: Background must feel revelatory, not encyclopedic. ` +
    `Every historical fact included must earn its place by changing how a line reads. ` +
    `Avoid: generic overview paragraphs about "the Roman world" or "ancient Jewish society." ` +
    `Aim for: a precise detail that lands directly on the verse and makes a phrase suddenly vivid or unsettling.`,

  // ─── INTERTEXTUAL ─────────────────────────────────────────────────────────
  intertext:
    `Task: Find 2–4 intertextual connections — earlier texts echoed or cited in this verse, ` +
    `and later texts that reach back to it.\n\n` +
    `For each connection:\n` +
    `1. Name the link clearly.\n` +
    `2. Show what work the link does — does it deepen, subvert, fulfill, reframe, or reverse the earlier text?\n` +
    `3. Show what new meaning emerges when the two texts are heard together that neither text carries alone.\n\n` +
    `Do not settle for: "This echoes Genesis 1." ` +
    `Aim for: "When this phrase echoes Genesis 1, it borrows the authority of creation — ` +
    `and uses it to make what Paul is asking sound not like an ethical suggestion but like a law of the universe."\n\n` +
    `Connections must feel earned and illuminating, not catalogued. ` +
    `If a connection does not change how the verse reads, leave it out. ` +
    `A small number of deep connections is worth more than a long list of surface echoes.`,

  // ─── LINGUISTIC ───────────────────────────────────────────────────────────
  linguistic:
    `Task: Do a close linguistic analysis of this verse — word choice, syntax, verbal aspect, ` +
    `key particles and prepositions, and any ambiguities the translation smooths over.\n\n` +
    `For each point of analysis:\n` +
    `1. Cite the original Greek or Hebrew word with transliteration.\n` +
    `2. Show what it carries in the original — its aspect, its range, its physical or semantic force.\n` +
    `3. Show specifically what the translation cannot capture or has quietly chosen not to render.\n` +
    `4. Show how that gap changes what a reader understands about the verse.\n\n` +
    `RULE: Stay narratively alive. Every technical detail must serve a revelation. ` +
    `Do not write grammar notes. Write discoveries. ` +
    `Aim for: "The translation gives you 'forgive.' The Greek verb means something closer to 'give as a gift' — ` +
    `which turns pardon from a cancellation of debt into an act of generosity. That is not a small difference." ` +
    `The reader should finish thinking: "The translation was giving me a reduced version of this."`,
};

export function buildExtraPrompt(args: {
  id: ExtraId;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);
  const tail = LANG_TAIL(langName);

  return (
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `${EDITORIAL_VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n` +
    `${OUTPUT_STRUCTURE}\n\n` +
    `Respond in ${langName}. Stay tight: 250–400 words. Markdown allowed.\n\n` +
    TASKS[args.id] +
    tail
  );
}
