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

    `GOAL:\n` +
    `The user already saw a short card teaser. Do not repeat it. ` +
    `Write a polished magazine mini-essay in ${langName} that makes the reader feel: ` +
    `"I see the evidence. This is not just an AI making a beautiful claim." ` +
    `The reasoning must be visible inside the prose — not labelled mechanically.\n\n` +

    `OPENING RULE — mandatory:\n` +
    `First sentence must engage the anchor directly: "${args.anchor}". ` +
    `Banned openings: general life statements, moral claims, devotional openers, ` +
    `paraphrases of the whole verse, rhetorical questions about humanity.\n\n` +

    `INTERNAL LOGIC — follow this flow, but write it as continuous essay prose:\n\n` +

    `First: state the observation clearly and narrowly. ` +
    `What specifically is happening at the anchor? Do not editorialize yet.\n\n` +

    `Second: show why the claim is credible. ` +
    `Use the evidence that is genuinely relevant to this angle:\n` +
    `- If the angle is lexical: name the original-language word in its original script, ` +
    `give the transliteration, explain its semantic field or root — and contrast it ` +
    `with a real relevant alternative word in the same language (Greek vs Greek, Hebrew vs Hebrew). ` +
    `Do not import words from unrelated languages as comparisons. ` +
    `If you do not know a reliable contrast word, explain the word's own semantic range instead.\n` +
    `- If the angle is structural: show the exact structural feature (word order, ` +
    `asyndeton, parallelism) and demonstrate what it produces.\n` +
    `- If the angle is translational: compare how 2–3 real translations render the anchor phrase ` +
    `and show what each choice reveals or compresses.\n` +
    `- If the angle is contextual: show how the verse immediately before or after changes ` +
    `the pressure of the anchor.\n` +
    `A compact comparison table in markdown is encouraged when it genuinely clarifies evidence:\n` +
    `| Word | Semantic force | What translation compresses |\n` +
    `|---|---|---|\n\n` +

    `Third: connect the evidence to the conclusion step by step. ` +
    `Do not jump from "word X exists" to "therefore the verse means Y." ` +
    `Show the logical bridge.\n\n` +

    `Fourth: include a careful limitation. ` +
    `If the claim is interpretive or probabilistic, say so explicitly — for example:\n` +
    `"This does not mean the common translation is wrong; it compresses two models into one word."\n` +
    `"The point is not that this word always carries this force, but that here the context supports it."\n` +
    `"This is a strong lexical clue, not a license to overbuild theology from one word choice."\n` +
    `A limitation makes the reasoning trustworthy, not weak.\n\n` +

    `Fifth: end with a compact editorial insight — how the verse reads differently ` +
    `after the evidence is considered. One tight paragraph. ` +
    `Not a moral appeal. Not a question. Not a summary. A final thought that sits.\n\n` +

    `HEADINGS:\n` +
    `If you use section headings, make them natural and content-specific — never mechanical labels.\n` +
    `Good: "Два разных способа простить", "Почему перевод сглаживает разницу", ` +
    `"Что Павел делает этим глаголом", "Где нужна осторожность"\n` +
    `Bad: "УТВЕРЖДЕНИЕ", "ДОКАЗАТЕЛЬСТВО", "ЛОГИКА", "ОГРАНИЧЕНИЕ", "РЕЗУЛЬТАТ", ` +
    `"Claim", "Evidence", "Reasoning", "Limitation", "Payoff"\n` +
    `You may also write the essay as unbroken prose without any headings if the flow is clear.\n\n` +

    `EVIDENCE QUALITY RULES:\n` +
    `- For Greek or Hebrew word claims: explain the root or semantic field; ` +
    `show why it matters in this specific verse; include a cautious limitation.\n` +
    `- If contrasting words: use real words from the same original language only. ` +
    `Do not invent comparisons with words from other languages.\n` +
    `- If you do not know a reliable contrast, explain the word's own range rather than inventing one.\n` +
    `- Do not use: "this proves", "this clearly shows", "scholars agree", "lexicons confirm" ` +
    `without a real basis.\n` +
    `- Do not fabricate citations or lexicon names.\n` +
    `- If uncertain, phrase carefully: "the root suggests…", ` +
    `"one reading of this construction is…", "the semantic field points toward…"\n\n` +

    `HARD RULES:\n` +
    `- Target: 450–700 words. 4–6 sections at most.\n` +
    `- Do not repeat the same point in different words.\n` +
    `- No sermon ending. No motivational question. No "this opens new horizons".\n` +
    `- No churchy language. No banned jargon.\n` +
    `- Markdown: **bold** for key terms, tables for comparisons. No h1 headings.` +
    tail
  );
}
