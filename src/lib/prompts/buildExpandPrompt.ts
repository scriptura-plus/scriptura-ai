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
    `Write a polished magazine mini-essay in ${langName} (450–700 words). ` +
    `The reasoning must be visible inside the prose — not labelled with structural headings.\n\n` +

    `OPENING RULE — mandatory:\n` +
    `First sentence must engage the anchor directly: "${args.anchor}". ` +
    `Banned openings: general life statements, moral claims, devotional openers, ` +
    `paraphrases of the whole verse, rhetorical questions about humanity.\n\n` +

    `INTERNAL LOGIC — write as essay prose, in this order:\n\n` +

    `First: state the observation clearly and narrowly. ` +
    `What is happening at the anchor? Do not editorialize yet.\n\n` +

    `Second: show why the claim is credible. Use genuinely relevant evidence:\n` +
    `- For a Greek or Hebrew word claim: ` +
    `name the word in original script plus transliteration, ` +
    `explain its word-family or semantic field carefully, ` +
    `contrast it with a real alternative word from the same language only (Greek vs Greek, Hebrew vs Hebrew), ` +
    `explain what the common translation compresses or normalizes. ` +
    `If no reliable contrast word is known, explain the word's own semantic range instead — ` +
    `do not invent a comparison.\n` +
    `- For a structural claim: describe the exact feature (word order, absent conjunctions, ` +
    `parallelism) and show what it produces in the sentence.\n` +
    `- For a translational claim: compare how 2–3 real translations render the anchor and ` +
    `show what each choice reveals or hides.\n` +
    `- For a contextual claim: show how the immediately surrounding verses change the pressure here.\n\n` +
    `FORMAT FOR WORD COMPARISONS — use short prose or a short bulleted list. ` +
    `Do NOT use markdown table syntax (pipe characters). ` +
    `Example of acceptable format:\n` +
    `"χαρίζομαι — belongs to the word-family of χάρις (favor, generosity, gift); ` +
    `ἀφίημι — carries a release/letting-go/debt-cancellation force. ` +
    `Paul chose the first, not the second."\n\n` +

    `Third: connect the evidence to the conclusion step by step. ` +
    `Do not jump from "word X exists" to "therefore the verse means Y." ` +
    `Show the logical bridge.\n\n` +

    `Fourth: include a careful limitation. State what the evidence does and does not prove. Examples:\n` +
    `"This does not mean the common translation is wrong; it compresses two models into one word."\n` +
    `"The point is not that this word always carries this force, but that here the context supports it."\n` +
    `"This is a strong lexical clue, not a license to overbuild theology from one word choice."\n\n` +

    `Fifth — CLOSING RULE — mandatory:\n` +
    `End with one compact intellectual insight: how the verse reads differently after the evidence. ` +
    `The ending must NOT be:\n` +
    `- a question to the reader ("Сколько таких подарков мы не замечаем в повседневной жизни?")\n` +
    `- a moral appeal ("Пусть это напомнит нам...")\n` +
    `- a life-application prompt ("Попробуйте в следующий раз...")\n` +
    `- a motivational reflection ("Это открывает новые горизонты...")\n` +
    `The ending must be a statement — a reframing or reversal that closes the argument. ` +
    `Example of correct ending: ` +
    `"Paul does not merely ask the reader to close the account. ` +
    `He shifts the whole metaphor: forgiveness moves from the ledger of debt into the language of gift."\n\n` +

    `HEADINGS — if used, must be natural and content-specific:\n` +
    `Good: "Два разных способа простить", "Что теряет перевод", "Где нужна осторожность"\n` +
    `Banned: "УТВЕРЖДЕНИЕ", "ДОКАЗАТЕЛЬСТВО", "Claim", "Evidence", "Payoff"\n` +
    `You may also write the essay as unbroken prose with no headings.\n\n` +

    `HARD RULES:\n` +
    `- No markdown tables. No pipe characters. Use prose or bulleted lists for comparisons.\n` +
    `- No ending with a question, moral appeal, or motivational reflection.\n` +
    `- No "this proves", "this clearly shows", "scholars agree" without a real basis.\n` +
    `- No fabricated citations or lexicon names.\n` +
    `- No cross-language comparisons invented to fill space (e.g., comparing Greek to French).\n` +
    `- No churchy language. No banned jargon. Translate any religious term immediately.\n` +
    `- No repeating the same point in different words.\n` +
    `- If uncertain: "the root suggests…", "one reading of this construction is…"\n` +
    `- Markdown: **bold** for key terms only. No h1 headings. No tables.` +
    tail
  );
}
