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

    `GOAL OF THIS ARTICLE:\n` +
    `The user already saw a short card teaser. Do not repeat it. ` +
    `Your job is to make the reader feel: ` +
    `"I see the evidence. This is not just an AI making a beautiful claim." ` +
    `The article must be evidence-based, not merely eloquent. ` +
    `Shorter and denser is better than longer and padded. ` +
    `Write in ${langName}. Target: 450–700 words, 4–6 tight sections.\n\n` +

    `OPENING RULE — mandatory:\n` +
    `Your first sentence must name the claim directly, rooted in the anchor: "${args.anchor}". ` +
    `Do not open with: a general life statement, a moral claim, a devotional opener, ` +
    `a paraphrase of the whole verse, or a rhetorical question about humanity.\n\n` +

    `MANDATORY STRUCTURE — follow this in order:\n\n` +

    `**1. CLAIM**\n` +
    `State the observation from the angle clearly and narrowly. ` +
    `One tight paragraph. What specifically is happening in the anchor? ` +
    `Do not editorialize yet — just state the claim precisely.\n\n` +

    `**2. EVIDENCE**\n` +
    `Show why the claim is credible. Use the most relevant evidence available. ` +
    `Pick from what actually applies to this angle:\n` +
    `- Original-language word: give the word in its original script, transliteration, ` +
    `plain-language meaning, and why that meaning is supported\n` +
    `- Word contrast: show what alternative word the author could have chosen ` +
    `and what that word would have meant differently\n` +
    `- Translation handling: how do 2–3 major translations render this word or phrase? ` +
    `What does each choice reveal or compress?\n` +
    `- Rhetorical or structural feature: how does word order, asyndeton, ` +
    `parallelism, or compression create the effect?\n` +
    `- Immediate context: does the verse before or after change the pressure of this phrase?\n\n` +
    `If the angle involves a Greek or Hebrew word, a compact comparison table is encouraged:\n` +
    `| Element | What it says | What it hides or compresses |\n` +
    `|---|---|---|\n` +
    `or:\n` +
    `| Word | Basic force | What gets lost in translation |\n` +
    `|---|---|---|\n\n` +

    `**3. REASONING**\n` +
    `Connect the evidence to the conclusion step by step. ` +
    `Do not jump from "Greek word X exists" to "therefore the whole verse means Y." ` +
    `Show the logical bridge: what does the evidence make more likely? ` +
    `What does it rule out? What does it leave open?\n\n` +

    `**4. LIMITATION**\n` +
    `If the claim is interpretive or rests on probabilistic lexical evidence, say so. ` +
    `Use precise limiting language, for example:\n` +
    `- "This does not mean the common translation is wrong; it compresses two distinct models into one word."\n` +
    `- "The point is not that this word always carries this force, but that here the context supports it."\n` +
    `- "This is a strong lexical clue, not a license to build a doctrine from one word."\n` +
    `A limitation does not weaken the article. It makes the reasoning trustworthy.\n\n` +

    `**5. PAYOFF**\n` +
    `Explain how the verse reads differently after the evidence is considered. ` +
    `One short paragraph. Not a moral appeal. Not a question. ` +
    `A compact editorial insight — the last line of a good essay, not a school report.\n\n` +

    `HARD RULES:\n` +
    `- Do not repeat the same claim across multiple paragraphs in different words.\n` +
    `- Do not use: "scholars say", "many experts believe" without a real basis.\n` +
    `- Do not use: "this proves", "this clearly shows", "without a doubt".\n` +
    `- Do not fabricate lexicon references or citations.\n` +
    `- Do not pad. Every sentence must add to the argument, not ornament it.\n` +
    `- No sermon endings, no motivational endings, no "this opens new horizons".\n` +
    `- No churchy language, no banned jargon. If a religious term appears in the verse, translate it immediately.\n` +
    `- If uncertain about an original-language claim, phrase it carefully: ` +
    `"the Greek suggests…", "one reading of this construction is…", "the root points toward…"\n` +
    `- Markdown allowed: **bold** for key terms, tables for comparisons. No h1 headings.` +
    tail
  );
}
