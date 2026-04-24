import {
  LANG_NAME,
  LANG_FENCE,
  LANG_TAIL,
  EDITORIAL_VOICE,
  JARGON_BAN,
  OUTPUT_STRUCTURE,
  CARD_TITLE_STANDARD,
} from "./editorial";
import type { Lang } from "./editorial";

export type { Lang };
export type LensId = "angles" | "word" | "context" | "translations";
export const LENS_ORDER: LensId[] = ["angles", "word", "context", "translations"];

export function buildLensPrompt(args: {
  lens: LensId;
  reference: string;
  verseText: string;
  lang: Lang;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);
  const tail = LANG_TAIL(langName);

  const header = (extra = "") =>
    `${fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `${EDITORIAL_VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n` +
    (extra ? `${extra}\n\n` : "");

  switch (args.lens) {

    // ─── ANGLES ──────────────────────────────────────────────────────────────
    case "angles":
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `All string values must be written in ${langName}.\n\n` +
        `${EDITORIAL_VOICE(langName)}\n\n` +
        `${JARGON_BAN}\n\n` +
        `${CARD_TITLE_STANDARD}\n\n` +

        `WHAT AN ANGLE IS:\n` +
        `An angle is a precise observation about how this specific verse is constructed — its mechanics, ` +
        `its logic, its wording choices, its structure. It is NOT a theme, a topic, a moral lesson, or a general idea derived from the subject matter.\n\n` +

        `WHAT AN ANGLE IS NOT — reject these immediately:\n` +
        `- Any abstract noun phrase: "Compassion as the basis of kindness", "Forgiveness as a gift"\n` +
        `- Any academic category: "Psychology of forgiveness", "Socio-historical dynamics"\n` +
        `- Any moral claim: "The obligation to forgive", "Why kindness matters"\n` +
        `- Anything that could be a sermon point, essay title, or textbook chapter\n\n` +

        `THE 7 VALID ANGLE TYPES — each of the 4 angles must belong to a different type:\n` +
        `1. SEQUENCE — the verse presents ideas in a deliberate order; the order is the argument\n` +
        `2. CONTRAST — the verse sets two things against each other, explicitly or by implication\n` +
        `3. WORD WEIGHT — a single word carries more force, physicality, or strangeness than its translation suggests\n` +
        `4. STRUCTURE — the verse has a ladder-like, chiastic, or repeated pattern that creates meaning\n` +
        `5. CAUSE/MEASURE — one clause sets the exact standard or logic for another\n` +
        `6. INCLUSION/OMISSION — the verse includes or conspicuously leaves out something a reader expects\n` +
        `7. PHRASE FORCE — a small phrase (easily skipped) changes the entire emotional pressure of the sentence\n\n` +

        `EXAMPLE ANGLES (for Ephesians 4:32 — for calibration only, adapt for the actual verse):\n` +
        `- "Paul Starts Earlier Than You Think" → the sequence opens with emotional climate, not forgiveness (SEQUENCE)\n` +
        `- "Three Actions That Form a Ladder, Not a List" → the structure escalates, each step requiring the last (STRUCTURE)\n` +
        `- "The Standard for Forgiveness Is Not the Offense" → forgiveness is measured by mercy already received, not harm done (CAUSE/MEASURE)\n` +
        `- "A Single Phrase Makes the Whole Verse Mutual" → 'one another' is not decoration; it reverses the grammar of the sentence (PHRASE FORCE)\n` +
        `- "Compassion Does Not Live in the Heart Here" → the Greek word for compassion is anatomical, not psychological (WORD WEIGHT)\n\n` +

        `TEASER STANDARD:\n` +
        `Each teaser must begin with tension or surprise. It must make one real claim about what the reader missed. ` +
        `It must stay compact and make the user want to expand the card. ` +
        `Do not open with "This verse…" or "Paul says…". Open with the observation.\n\n` +

        `WHY_IT_MATTERS STANDARD:\n` +
        `One sentence. Show how this specific observation changes how the whole verse reads. ` +
        `Not a moral lesson. A perceptual shift.\n\n` +

        `Task: Return a JSON array of exactly 4 angle objects. ` +
        `Output JSON only — no markdown fences, no prose, no explanation before or after.\n\n` +

        `Each object has exactly these keys:\n` +
        `- "title": sharp, concrete observation-as-statement, max 12 words, in ${langName}\n` +
        `- "teaser": 2-3 sentences, begins with tension or surprise, one real claim, in ${langName}\n` +
        `- "anchor": the exact word, phrase, or structural feature from the verse, in ${langName}\n` +
        `- "why_it_matters": 1 sentence, perceptual shift not moral lesson, in ${langName}\n\n` +

        `The 4 angles must belong to 4 different angle types. No two angles may make the same point. No banned words.\n\n` +

        `Output — valid JSON array only:\n` +
        `[{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."},{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."},{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."},{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."}]` +
        `\n\nREMINDER: JSON only. All strings in ${langName}. No banned words. No generic angles.`
      );

    // ─── WORD ─────────────────────────────────────────────────────────────────
    case "word":
      return (
        header() +
        `${OUTPUT_STRUCTURE}\n\n` +
        `Task: Hunt for 2–3 words or short phrases in this verse where the original language — Greek or Hebrew — ` +
        `does something the translation cannot quite capture, or quietly chooses not to.\n\n` +
        `For each word:\n` +
        `1. Quote the original word with transliteration.\n` +
        `2. Show what it literally carries — its physical force, its range of meaning, its tone in the original.\n` +
        `3. Show exactly where the translation smooths it over, domesticates it, softens it, or accidentally flattens it.\n` +
        `4. Show what that gap costs the reader — what they miss about the verse because of the translation choice.\n\n` +
        `This is not a lexicon. Do not write dictionary entries. Write discoveries.\n` +
        `Every word chosen must make the reader think: "That word does far more than I realized."\n` +
        `Hook with the most surprising word. Open the analysis with the observation, not with "The Greek word X means..."` +
        tail
      );

    // ─── CONTEXT ──────────────────────────────────────────────────────────────
    case "context":
      return (
        header() +
        `${OUTPUT_STRUCTURE}\n\n` +
        `Task: Build context in two layers, then land one payoff.\n\n` +
        `**Narrow context** — Read the 3–5 verses immediately before and after. ` +
        `Ask: what changes when this verse is read inside that movement? ` +
        `Is this line an answer to something? A climax? A pivot? A correction? A reversal? ` +
        `Lead with the detail that most readers miss because they extracted the verse from its local argument. ` +
        `Make this feel like: "On its own the verse looks simple. In context, it is the hinge of a sharper argument." ` +
        `Do not summarize the surrounding verses. Show what they do to this one.\n\n` +
        `**Wide context** — Step back to the chapter, the book, and the moment of writing. ` +
        `Where is the author driving? Is this verse doing local work or carrying a whole-book argument? ` +
        `What was at stake politically, emotionally, or rhetorically in this moment? ` +
        `Every background fact must earn its place by changing how a line reads. ` +
        `Avoid generic historical overview. Background must feel revelatory.\n\n` +
        `**Payoff** — One precise sentence. Not a summary. A reframing that makes the verse look different than it did before.\n\n` +
        `Lead with the most under-appreciated detail. Do not begin with "The surrounding verses discuss…"` +
        tail
      );

    // ─── TRANSLATIONS ─────────────────────────────────────────────────────────
    case "translations":
      return (
        header() +
        `${OUTPUT_STRUCTURE}\n\n` +
        `Task: Find 3–4 translations that diverge at a meaningful point in this verse. ` +
        `Focus on the places where the versions quietly split.\n\n` +
        `For each divergence:\n` +
        `1. Name the exact word or phrase where the translations differ.\n` +
        `2. Show how each choice changes the temperature, texture, or logic of the sentence. ` +
        `Is one version harsher, softer, more legal, more intimate, more physical, more abstract?\n` +
        `3. Ask: is one translation hiding the strangeness of the original? Is one sharpening it? ` +
        `Is one accidentally changing who is responsible for what?\n\n` +
        `Do not merely list synonyms. Show what is actually at stake in each choice — ` +
        `what a reader understands differently depending on which version they hold.\n\n` +
        `End with one sentence: your verdict on which choice is most honest to the original, and why. ` +
        `Be willing to have an opinion. The ending should feel like a conclusion, not a hedge.` +
        tail
      );
  }
}
