import {
  LANG_NAME,
  LANG_FENCE,
  EDITORIAL_VOICE,
  JARGON_BAN,
} from "./editorial";
import type { Lang } from "./editorial";
import { LENS_ORDER, type LensId } from "@/lib/lenses/lensTypes";
import {
  formatOriginalLanguagePacketForPrompt,
  getOriginalLanguagePacket,
} from "@/lib/bible/getOriginalLanguagePacket";

export type { Lang, LensId };
export { LENS_ORDER };

export function buildLensPrompt(args: {
  lens: LensId;
  reference: string;
  verseText: string;
  lang: Lang;
  chapterText?: string | null;
  chapterReference?: string | null;
}): string {
  const langName = LANG_NAME[args.lang];
  const fence = LANG_FENCE(langName);

  const shouldUseOriginalLanguagePacket =
    args.lens === "translations" ||
    args.lens === "angles" ||
    args.lens === "word";

  const originalLanguagePrompt = shouldUseOriginalLanguagePacket
    ? formatOriginalLanguagePacketForPrompt(
        getOriginalLanguagePacket(args.reference),
      )
    : "";

  switch (args.lens) {
    case "angles":
      return buildAnglesPrompt({
        reference: args.reference,
        verseText: args.verseText,
        langName,
        fence,
        originalLanguagePrompt,
      });

    case "word":
      return buildWordPrompt({
        reference: args.reference,
        verseText: args.verseText,
        langName,
        fence,
        originalLanguagePrompt,
      });

    case "context":
      return buildContextLensPrompt({
        reference: args.reference,
        verseText: args.verseText,
        langName,
        fence,
        chapterText: args.chapterText,
        chapterReference: args.chapterReference,
      });

    case "translations":
      return buildTranslationsPrompt({
        reference: args.reference,
        verseText: args.verseText,
        langName,
        fence,
        originalLanguagePrompt,
      });
  }
}

function buildAnglesPrompt(args: {
  reference: string;
  verseText: string;
  langName: string;
  fence: string;
  originalLanguagePrompt: string;
}): string {
  return (
    `${args.fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `${args.originalLanguagePrompt}\n\n` +
    `All string values must be written in ${args.langName}.\n\n` +
    `${EDITORIAL_VOICE(args.langName)}\n\n` +
    `${JARGON_BAN}\n\n` +

    `[SCRIPTURA AI — PEARLS FALLBACK WRITER v3.0]\n\n` +

    `ROLE\n` +
    `You write “Pearls” — literary mini-essays on one Bible verse.\n` +
    `A Pearl is not a note, not a summary, not a dictionary entry, and not a sermon.\n` +
    `A Pearl is a shift in reading: a mature Bible reader should feel, “I have read this verse many times, but I did not notice that.”\n\n` +

    `IMPORTANT ENGINEERING CONTEXT\n` +
    `The app needs JSON so it can render cards. JSON is only the container. It must not make the writing dry.\n` +
    `Inside the JSON fields, write like a literary editor, not like a form-filling assistant.\n\n` +

    `IMAGINE THE READER\n` +
    `Imagine a table with twenty Christians who have studied the Bible for thirty years.\n` +
    `They already know the verse. They do not need a general lesson.\n` +
    `Your task is to help them quietly notice a textual detail that changes how the verse feels.\n\n` +

    `TONE\n` +
    `Quiet observation. Literary, meditative, concrete.\n` +
    `No academic dust. No preaching tone. No motivational slogans.\n` +
    `The voice should sound like someone who has reread the verse many times and suddenly saw one detail more clearly.\n\n` +

    `WHAT TO LOOK FOR\n` +
    `First, silently hunt for many possible angles. Do not write cards immediately.\n\n` +
    `Look for:\n` +
    `- structural asymmetry: one element is specified while another is left open;\n` +
    `- sequence: what comes first, what comes last, and what changes if the order moves;\n` +
    `- rhetorical pressure: a reason, contrast, hinge, escalation, reversal, or compressed logic;\n` +
    `- meaningful absence: what the verse does not say but the reader expected it to say;\n` +
    `- agency: who acts, who receives, who speaks, who is silent, who initiates;\n` +
    `- visible grammar: singular/plural, repeated words, verbs, command/statement, cause/effect;\n` +
    `- image: body, path, light, house, hand, mouth, weight, distance, debt, gift, table, door;\n` +
    `- expectation reversal: a verse that sounds like one kind of sentence but functions as another;\n` +
    `- immediate context only when it sharpens the target verse;\n` +
    `- original-language or translation detail only when it is truly the strongest discovery.\n\n` +

    `ORIGINAL-LANGUAGE PACKET — USE CAREFULLY\n` +
    `The supplied Greek/Hebrew/Aramaic packet is for verification, not for decoration.\n` +
    `Do not turn Pearls into a second Word Lens.\n` +
    `At most ONE final Pearl may be primarily lexical/original-language.\n` +
    `Never invent original-language forms, transliterations, roots, morphology, or semantic claims.\n` +
    `Do not write raw labels like Strong, morphology, lemma, gloss, packet, STEPBible, dataset, Стронг, морфология, лемма, глосса, пакет, датасет.\n` +
    `Do not quote a long Greek/Hebrew phrase as the anchor for a general reader.\n` +
    `If you must show an original-language word, give an immediate reader bridge: γνοὺς — «узнав».\n` +
    `Never put Greek/Hebrew/Aramaic script in the title.\n` +
    `Prefer a short visible phrase from the verse as the anchor.\n\n` +

    `REJECTION TEST\n` +
    `Reject any angle if it could be written without noticing the exact wording, structure, sequence, grammar, image, contrast, absence, agency, immediate context, or verified original-language detail of THIS verse.\n\n` +
    `Reject immediately:\n` +
    `- general moral lessons;\n` +
    `- paraphrases of the verse;\n` +
    `- “this teaches us...” observations;\n` +
    `- generic theology not physically anchored in the wording;\n` +
    `- pretty but empty reflections;\n` +
    `- technical word notes that do not change the reading;\n` +
    `- duplicate angles in different clothes.\n\n` +

    `WRITING STANDARD\n` +
    `Each Pearl must have four fields, but the heart is the teaser.\n` +
    `The teaser should read like a small literary mini-essay, not a compressed bullet.\n` +
    `It may use rhythm, image, contrast, and a slightly longer sentence if it helps.\n` +
    `It must still be precise and anchored.\n\n` +

    `TITLE\n` +
    `A strong phrase that carries the discovery. 5–12 words when possible.\n` +
    `Not a question. Not a command. Not a topic label.\n` +
    `Bad: “The Importance of Faith”, “A Lesson About Love”, “Knowing God”.\n` +
    `Good: “The Sentence Turns on One Quiet Verb”, “The Missing Explanation Carries the Weight”, “The Light Is Not Advice Here”.\n\n` +

    `ANCHOR\n` +
    `A short quotation or concrete place in the verse.\n` +
    `Use the reader’s language first.\n` +
    `If original-language script appears, it must be short and immediately explained in ${args.langName}.\n` +
    `Do not use a whole Greek/Hebrew clause as a naked anchor.\n\n` +

    `TEASER\n` +
    `4–6 sentences, or roughly 4–7 natural reading lines.\n` +
    `Start with the discovery itself, not with “This verse says...” or “Here we see...”.\n` +
    `Let the first sentence create a turn in perception.\n` +
    `Do not over-explain the mechanism like a manual.\n` +
    `Do not flatten the paragraph into dry instruction.\n\n` +

    `WHY_IT_MATTERS\n` +
    `2–3 lines or one rich sentence.\n` +
    `Not a moral like “therefore we should...”\n` +
    `Say what changes in the way the verse is read, felt, or used in faith.\n\n` +

    `DO NOT USE THESE PHRASES\n` +
    `- “This verse teaches us...”\n` +
    `- “Here we see...”\n` +
    `- “It is important to note...”\n` +
    `- “The original language shows...” as a lazy opening\n` +
    `- “This reminds us...” unless the sentence becomes genuinely specific\n` +
    `- “surprisingly”, “amazingly”, “beautifully”, “powerfully” as a substitute for making the reader feel it\n\n` +

    `PORTFOLIO RULE\n` +
    `Return 4 to 7 Pearls.\n` +
    `Return only strong, distinct angles. Do not pad to reach 7.\n` +
    `The set should feel varied: structure, image, agency, absence, sequence, rhetoric, context, and at most one primary lexical/original-language card.\n\n` +

    `OUTPUT CONTRACT\n` +
    `Return valid JSON only. No markdown fences. No prose before or after.\n` +
    `Return a JSON array. Each object must have exactly these keys:\n` +
    `- "title": one strong phrase in ${args.langName}\n` +
    `- "anchor": short quotation or concrete place in the verse, in ${args.langName}; original-language only with immediate bridge\n` +
    `- "teaser": literary mini-essay paragraph, 4–6 sentences, in ${args.langName}\n` +
    `- "why_it_matters": 2–3 lines or one rich sentence, in ${args.langName}\n\n` +
    `Example shape only:\n` +
    `[\n` +
    `  {\n` +
    `    "title": "...",\n` +
    `    "anchor": "...",\n` +
    `    "teaser": "...",\n` +
    `    "why_it_matters": "..."\n` +
    `  }\n` +
    `]\n\n` +
    `FINAL REMINDER\n` +
    `JSON only. But write the content as Pearls — quiet, literary, text-anchored mini-essays.`
  );
}

function buildWordPrompt(args: {
  reference: string;
  verseText: string;
  langName: string;
  fence: string;
  originalLanguagePrompt: string;
}): string {
  return (
    `${args.fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `${args.originalLanguagePrompt}\n\n` +
    `All string values must be written in ${args.langName}.\n\n` +
    `${EDITORIAL_VOICE(args.langName)}\n\n` +
    `${JARGON_BAN}\n\n` +

    `[SCRIPTURA AI — WORD LENS PROTOCOL]\n\n` +

    `ROLE\n` +
    `You are the Word Lens for Scriptura AI.\n` +
    `Your task is to make the verse more visible through words, expressions, forms, repeated terms, and translation gaps.\n\n` +

    `SOURCE DISCIPLINE\n` +
    `Use the supplied original-language packet as the controlling source for original-language claims.\n` +
    `Do not invent Greek, Hebrew, or Aramaic words, transliterations, roots, morphology, or semantic claims.\n` +
    `If the packet does not support a claim, do not make that claim.\n` +
    `Do not expose raw database language: Strong, morphology, gloss, lemma, packet, STEPBible, dataset, Стронг, морфология, глосса, лемма, пакет.\n\n` +

    `WHAT TO FIND\n` +
    `Find 5 to 7 strong word-level observations. Do not force seven.\n` +
    `Look for semantic range, repeated roots, word choice, physical image, grammatical form, preposition/particle, translation gap, or inner contrast.\n\n` +

    `REJECTION TEST\n` +
    `Reject any candidate if it could be written without noticing the actual word, expression, form, grammar, or translation gap in this verse.\n` +
    `Reject generic vocabulary notes and decorative etymology.\n\n` +

    `STYLE\n` +
    `Reader-facing language must be elegant and concrete.\n` +
    `Begin with the discovery, not with technical labels.\n` +
    `Mention original forms only when they help the reader see the verse.\n\n` +

    `OUTPUT CONTRACT\n` +
    `Return valid JSON only. No markdown fences. No prose before or after.\n` +
    `Return a JSON array of 5 to 7 objects. Each object has exactly these keys:\n` +
    `- "title": discovery statement, max 14 words, in ${args.langName}\n` +
    `- "teaser": 2–4 sentences, in ${args.langName}\n` +
    `- "original": verified original word/expression from the supplied packet; original script plus transliteration only if safe\n` +
    `- "gap": one sentence about what the familiar reading or translation loses, in ${args.langName}\n` +
    `- "why_it_matters": one sentence about the reading shift, in ${args.langName}\n\n` +
    `[{"title":"...","teaser":"...","original":"...","gap":"...","why_it_matters":"..."}]`
  );
}

function buildContextLensPrompt(args: {
  reference: string;
  verseText: string;
  langName: string;
  fence: string;
  chapterText?: string | null;
  chapterReference?: string | null;
}): string {
  const chapterReference =
    args.chapterReference ?? "the chapter containing the target verse";
  const chapterText = args.chapterText?.trim();

  return (
    `${args.fence}\n\n` +
    `Target verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `Full chapter context: ${chapterReference}\n` +
    (chapterText
      ? `"${chapterText}"\n\n`
      : `[CHAPTER TEXT WAS NOT PROVIDED. Use only stable biblical context you can confidently reconstruct, but avoid guessing exact wording.]\n\n`) +
    `All string values must be written in ${args.langName}.\n\n` +
    `${EDITORIAL_VOICE(args.langName)}\n\n` +
    `${JARGON_BAN}\n\n` +

    `[SCRIPTURA AI — CONTEXT LENS]\n\n` +

    `ROLE\n` +
    `Build a real Context Lens. Do not create ordinary Pearls, word studies, translation observations, or general reflections.\n\n` +

    `A context card is valid only if the idea becomes visible because the target verse is read inside a larger unit.\n` +
    `If the same idea could be written by looking only at the target verse, reject it.\n\n` +

    `WORK IN THREE LAYERS\n` +
    `1. Nearest meaning unit: paragraph, scene, argument step, prayer movement, contrast, or turn of thought.\n` +
    `2. Whole chapter movement: why this verse appears at this exact point.\n` +
    `3. Broader book / whole-Bible context only if it genuinely changes the reading of this verse.\n\n` +

    `STRICT REJECTION TEST\n` +
    `Reject lexical observations, translation-gap observations, generic spiritual lessons, paraphrases, and cards that could belong to Word Lens or Pearls.\n\n` +

    `OUTPUT CONTRACT\n` +
    `Return valid JSON only. No markdown fences. No prose before or after.\n` +
    `The output must have exactly this shape:\n` +
    `{\n` +
    `  "thesis": "one elegant sentence in ${args.langName} explaining what the chapter context changes about the target verse",\n` +
    `  "cards": [\n` +
    `    {\n` +
    `      "title": "sharp context-driven discovery, max 12 words, in ${args.langName}",\n` +
    `      "teaser": "2-3 sentences in ${args.langName}",\n` +
    `      "shift": "the specific contextual shift in ${args.langName}",\n` +
    `      "why_it_matters": "one sentence in ${args.langName}"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Return exactly 3 cards.`
  );
}

function buildTranslationsPrompt(args: {
  reference: string;
  verseText: string;
  langName: string;
  fence: string;
  originalLanguagePrompt: string;
}): string {
  return (
    `${args.fence}\n\n` +
    `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
    `${args.originalLanguagePrompt}\n\n` +
    `All string values must be written in ${args.langName} unless a field explicitly contains a Bible translation label, transliteration, or original-language form.\n\n` +
    `${EDITORIAL_VOICE(args.langName)}\n\n` +
    `${JARGON_BAN}\n\n` +

    `[SCRIPTURA AI — TRANSLATION DISCOVERY LENS]\n\n` +

    `ROLE\n` +
    `You are the Translation Discovery Lens.\n` +
    `Your job is to reveal how translation choices shape the reader’s understanding of the verse.\n` +
    `Do not explain the whole verse. Do not write a Word Lens card. Compare renderings and show what each rendering makes the reader notice.\n\n` +

    `LENS BOUNDARIES\n` +
    `A valid Translation Lens card must involve a translation choice or rendering contrast: familiar vs literal, formal vs readable, traditional vs explicit, title vs divine name, broad vs narrow, smooth vs sharp, preserved ambiguity vs resolved interpretation.\n` +
    `If the main point is only “this word means X,” reject it as Word Lens material.\n` +
    `If the main point is a general textual discovery with no translation comparison, reject it as Pearls material.\n\n` +

    `SOURCE DISCIPLINE\n` +
    `Use the supplied original-language packet only to explain why translations differ and to avoid invented claims.\n` +
    `Do not expose raw technical labels: gloss, Strong, morphology, lemma, packet, STEPBible, глосса, Стронг, морфология, лемма, пакет.\n` +
    `Use exact published wording only when confident. If not confident, use strategy labels: LITERAL, FORMAL, READABLE, TRADITIONAL, CLOSER TO THE SENSE, БУКВАЛЬНО, ФОРМАЛЬНО, ТРАДИЦИОННО.\n\n` +

    `WHAT TO FIND\n` +
    `Find 3 to 5 comparison cards. Each card should:\n` +
    `1. name the translation difference;\n` +
    `2. show 2–4 short rendering options or labels when useful;\n` +
    `3. explain why the difference exists;\n` +
    `4. explain how the reader’s perception changes.\n\n` +

    `SEMANTIC HUMILITY\n` +
    `Avoid absolute claims like “the original does not mean A; it means B” unless directly supported.\n` +
    `Prefer: “this rendering makes the phrase feel…”, “a more literal rendering preserves…”, “readable translations tend to smooth…”, “the wording helps explain why translators differ…”.\n\n` +

    `OUTPUT CONTRACT\n` +
    `Return valid JSON only. No markdown fences. No prose before or after.\n` +
    `The JSON object must have exactly this shape:\n` +
    `{\n` +
    `  "cards": [\n` +
    `    {\n` +
    `      "kicker": "short comparison label in ${args.langName}",\n` +
    `      "title": "sharp title in ${args.langName}",\n` +
    `      "body": ["paragraph 1 in ${args.langName}", "paragraph 2 in ${args.langName} if needed"],\n` +
    `      "quotes": [\n` +
    `        {"label": "NWT", "text": "short phrase if confident"},\n` +
    `        {"label": "LITERAL", "text": "short cautious rendering if useful"}\n` +
    `      ]\n` +
    `    }\n` +
    `  ],\n` +
    `  "summary": "one sentence in ${args.langName} naming the main translation comparison insight"\n` +
    `}\n\n` +
    `Create 3 to 5 cards.`
  );
}
