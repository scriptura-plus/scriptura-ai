import {
  LANG_NAME,
  LANG_FENCE,
  LANG_TAIL,
  EDITORIAL_VOICE,
  JARGON_BAN,
} from "./editorial";
import type { Lang } from "./editorial";

export function buildExpandPrompt(args: {
  angleTitle: string;
  anchor: string;
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
    `Angle: "${args.angleTitle}"\n` +
    `Anchor (the exact textual detail the angle is grounded in): "${args.anchor}"\n\n` +
    `${EDITORIAL_VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n` +

    `PURPOSE OF THIS ARTICLE:\n` +
    `The user has already seen a short card teaser for this angle. ` +
    `Your job is NOT to repeat or pad that teaser. ` +
    `Your job is to go deeper — to explain the hidden mechanism fully, ` +
    `add at least one new concrete detail the teaser did not contain, ` +
    `and leave the reader with a real understanding of why this detail matters in the verse.\n\n` +

    `OPENING RULE — mandatory:\n` +
    `Your first sentence must engage the anchor directly: "${args.anchor}". ` +
    `Quote it or point at it immediately. ` +
    `Banned openings (do not use any of these patterns):\n` +
    `- Any general statement about life, humanity, or the world\n` +
    `- Any moral or inspirational claim\n` +
    `- Any devotional opener ("This verse teaches…", "God reminds us…")\n` +
    `- Any paraphrase of the whole verse\n` +
    `- Any rhetorical question about broad human experience\n` +
    `The first sentence must be specific, grounded, and immediately surprising.\n\n` +

    `MANDATORY DEPTH REQUIREMENT:\n` +
    `The article must include at least one of the following concrete supporting details — ` +
    `something not present in the card teaser:\n` +
    `a) Original-language contrast: name the Greek or Hebrew word, give transliteration, ` +
    `show what the common translation says vs what the word actually carries ` +
    `(e.g., χαρίζομαι "to give as a gift" vs ἀφίημι "to release a debt")\n` +
    `b) Translation comparison: show how 2-3 different translations render the anchor phrase, ` +
    `and what each choice reveals or conceals\n` +
    `c) Rhetorical or structural observation: show how the sentence's structure, ` +
    `word order, or use/absence of conjunctions creates the effect\n` +
    `d) Immediate context: show how the verse immediately before or after changes ` +
    `the pressure or meaning of the anchor phrase\n` +
    `e) Short comparison table if it clarifies a translation gap (use markdown)\n\n` +
    `If you cannot include any of these, do not pad with generic observations. ` +
    `Use whatever concrete detail is available and be precise about what you know vs infer.\n\n` +

    `STRUCTURE:\n` +
    `1. HOOK — engage the anchor phrase immediately. ` +
    `State the observation. 1-2 sentences. "I never read it that way." effect.\n\n` +
    `2. WHAT THE USUAL READING MISSES — show what a first-pass reader assumes, ` +
    `and what that assumption causes them to overlook. Be specific. ` +
    `Do not say "most readers miss this" — show them skipping past it.\n\n` +
    `3. THE MECHANISM — explain in full what the text is actually doing. ` +
    `This is where the mandatory concrete detail goes. ` +
    `Work through it methodically: what does the original language/structure/context reveal? ` +
    `Why did the author make this choice? What changes in the verse once you see it?\n\n` +
    `4. COMPACT CLOSE — 1-2 sentences. ` +
    `Not a summary. Not a moral. A reframing, a reversal, or a line that opens the thought wider. ` +
    `The reader should sit with it.\n\n` +

    `HARD RULES:\n` +
    `- Stay inside the angle. Every sentence must serve the observation in "${args.angleTitle}".\n` +
    `- Deepen, do not repeat. Add real value beyond the teaser.\n` +
    `- No sermon language: no "we should", "we must", "let us", "God calls us to".\n` +
    `- No motivational filler: no "this reminds us", "this encourages us", "what a beautiful truth".\n` +
    `- No banned jargon. If a religious term appears in the verse, translate it immediately.\n` +
    `- If uncertain about an original-language claim, phrase it carefully ("the Greek suggests…", ` +
    `"one reading of this construction is…"). Do not fabricate. Do not avoid depth.\n` +
    `- Length: 350–500 words.\n` +
    `- Markdown allowed: **bold** for emphasis, tables for comparisons. No h1 headings.` +
    tail
  );
}
