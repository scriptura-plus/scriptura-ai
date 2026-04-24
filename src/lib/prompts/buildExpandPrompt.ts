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
    `Angle to expand: "${args.angleTitle}"\n` +
    `Anchor phrase from the verse: "${args.anchor}"\n\n` +
    `${EDITORIAL_VOICE(langName)}\n\n` +
    `${JARGON_BAN}\n\n` +

    `OPENING RULE — mandatory:\n` +
    `Your first sentence must directly engage the anchor phrase: "${args.anchor}". ` +
    `Quote it, point at it, or state the precise observation about it — immediately. ` +
    `Banned openings:\n` +
    `- Any general statement about life, humanity, or the world\n` +
    `- Any moral or inspirational statement\n` +
    `- Any devotional opener ("This verse teaches us…", "God reminds us here…")\n` +
    `- Any summary of what the verse is generally about\n` +
    `- Any rhetorical question about broad human experience\n` +
    `The first sentence must be specific, surprising, and grounded in the text.\n\n` +

    `Task: Write a focused article (350–500 words) that unfolds this specific angle. Write in ${langName}.\n\n` +

    `Structure:\n` +
    `1. HOOK — Open with the anchor phrase. State the observation most readers miss. 1–2 sentences. ` +
    `The reader should immediately think: "I never read it that way."\n\n` +
    `2. WHY IT'S EASY TO MISS — Show exactly where the reader's eye slides past this detail. ` +
    `What does a first-pass reading assume? What does that assumption make them skip?\n\n` +
    `3. UNFOLD — Work through the observation methodically but with narrative drive. ` +
    `What is the text actually doing here? Why this word order, this phrasing, this structure? ` +
    `Where does the verse read differently once you see it?\n\n` +
    `4. LINGERING CLOSE — 1–2 sentences. Do not summarize. Do not moralize. ` +
    `End with a thought that opens the verse wider — a reframing, a reversal, or a final line that sits.\n\n` +

    `Hard rules:\n` +
    `- Every sentence must serve the specific observation named in the angle title. Stay inside it.\n` +
    `- No psychology, sociology, or cultural comparison unless the anchor word demands it.\n` +
    `- No sermon language: no "we should", "we must", "let us", "God calls us to", "this verse teaches".\n` +
    `- No motivational filler: no "this reminds us", "this encourages us", "what a beautiful truth".\n` +
    `- No banned words. If a religious term appears in the verse, translate it immediately into plain language.\n` +
    `- Deepen rather than repeat the card teaser. The article must add real value, not padded paraphrase.\n` +
    `- Markdown allowed for emphasis (**bold**) and short structure. No h1 headings.` +
    tail
  );
}
