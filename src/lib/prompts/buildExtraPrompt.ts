import {
  LANG_NAME,
  LANG_FENCE,
  EDITORIAL_VOICE,
  JARGON_BAN,
} from "./editorial";
import type { Lang } from "./editorial";

export type ExtraId =
  | "text_findings"
  | "historical_scene"
  | "scripture_links";

export const EXTRA_ORDER: ExtraId[] = [
  "text_findings",
  "historical_scene",
  "scripture_links",
];

const TASKS: Record<ExtraId, string> = {
  text_findings:
    `Task: Find the most interesting textual discoveries inside this verse.\n\n` +
    `This replaces separate genre, rhetoric, structure, and linguistic analysis.\n` +
    `Do NOT write academic analysis for its own sake.\n` +
    `Your goal is to find details that could become strong Scriptura AI insight cards.\n\n` +
    `Look for any of these ONLY if they produce a real discovery:\n` +
    `- unusual words or phrases\n` +
    `- Greek/Hebrew words, roots, or idioms\n` +
    `- word order or sentence movement\n` +
    `- repetition, contrast, reversal, or tension\n` +
    `- small connectors such as "for", "but", "therefore", "so that"\n` +
    `- rhetorical pressure or a hidden turn in the phrase\n` +
    `- structure that changes meaning\n` +
    `- a translation gap that hides something interesting\n\n` +
    `For each block:\n` +
    `- Lead with one concrete textual observation\n` +
    `- Anchor it in an exact word or phrase from the verse\n` +
    `- Explain why it is surprising or easy to miss\n` +
    `- Show what meaning shift it creates\n` +
    `- If Greek/Hebrew is used, be cautious: do not overclaim beyond what the word can support\n` +
    `- End with a possible insight-card angle in plain language\n\n` +
    `REJECT anything that sounds like:\n` +
    `- "the genre is..." without a discovery\n` +
    `- "the structure emphasizes..." without showing exactly how\n` +
    `- "this rhetorical device creates emphasis" without a concrete effect\n` +
    `- a grammar note that does not change how the verse reads\n\n` +
    `If only one strong textual finding exists, give one block. Do not pad.\n` +
    `If no strong textual finding exists, return one honest block explaining that no strong textual discovery was found.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `1–5 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  historical_scene:
    `Task: Find social, historical, or cultural details that make this verse sharper.\n\n` +
    `Do NOT give general background.\n` +
    `Do NOT write an encyclopedia paragraph.\n` +
    `Your goal is to reconstruct the scene only where it changes how a specific word, phrase, action, or conflict in this verse is heard.\n\n` +
    `Look for details such as:\n` +
    `- social status of the people involved\n` +
    `- customs, public expectations, shame/honor, table fellowship, family roles, legal settings, temple/synagogue setting\n` +
    `- political or economic pressure\n` +
    `- the original audience's assumptions\n` +
    `- what would have sounded scandalous, comforting, sharp, or unexpected\n\n` +
    `For each block:\n` +
    `- Lead with one precise scene-detail\n` +
    `- Connect it to an exact word, phrase, action, or conflict in the verse\n` +
    `- Explain what a modern reader would likely miss\n` +
    `- Show how the detail changes the force of the verse\n` +
    `- End with a possible insight-card angle in plain language\n\n` +
    `REJECT any block that gives background without changing how this verse reads.\n` +
    `REJECT vague lines like "in ancient times people valued..." unless tied to a precise phrase.\n\n` +
    `If only one strong scene-detail exists, give one block. Do not pad.\n` +
    `If no strong historical scene-detail exists, return one honest block explaining that no strong scene-based discovery was found.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `1–5 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,

  scripture_links:
    `Task: Find Scripture-to-Scripture connections that illuminate this verse.\n\n` +
    `Do NOT drift into a separate topic.\n` +
    `The purpose is not to list cross-references.\n` +
    `The purpose is to find links that reveal something about THIS verse.\n\n` +
    `Look for different kinds of biblical links:\n` +
    `- direct quotation\n` +
    `- clear allusion\n` +
    `- repeated phrase or formula\n` +
    `- shared image or motif\n` +
    `- contrastive episode\n` +
    `- earlier/later development of the same theme\n` +
    `- a character or event that makes this verse more vivid\n` +
    `- a biblical example where the same principle is embodied or ignored\n\n` +
    `For each block:\n` +
    `- Name the linked passage clearly\n` +
    `- Identify the type of link\n` +
    `- Show the exact point of contact with this verse\n` +
    `- Explain what becomes clearer in this verse when the texts are heard together\n` +
    `- End with a possible insight-card angle in plain language\n\n` +
    `Strict filter:\n` +
    `A link is useful only if it opens a detail of the starting verse.\n` +
    `If the linked passage becomes the main topic, reject it.\n` +
    `If the connection is generic, reject it.\n\n` +
    `Give as many strong links as exist, but do not pad.\n` +
    `Usually 2–7 blocks is enough.\n` +
    `If no strong link exists, return one honest block explaining that no strong Scripture-link was found.\n\n` +
    `Return JSON only:\n` +
    `{"blocks":[{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n` +
    `1–7 blocks. All strings in TARGET_LANGUAGE. JSON only, no markdown fences.`,
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
