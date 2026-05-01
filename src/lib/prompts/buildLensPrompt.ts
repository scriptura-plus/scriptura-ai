import {
  LANG_NAME,
  LANG_FENCE,
  EDITORIAL_VOICE,
  JARGON_BAN,
} from "./editorial";
import type { Lang } from "./editorial";

export type { Lang };

export type LensId = "angles" | "word" | "context" | "translations";

export const LENS_ORDER: LensId[] = [
  "angles",
  "word",
  "context",
  "translations",
];

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

  switch (args.lens) {
    // ─── ANGLES ──────────────────────────────────────────────────────────────
    case "angles":
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `Full chapter context: ${args.chapterReference ?? "the chapter containing the target verse"}\n` +
        (args.chapterText?.trim()
          ? `"${args.chapterText.trim()}"\n\n`
          : `[CHAPTER TEXT WAS NOT PROVIDED. Use context only if you can do so cautiously; do not invent nearby wording.]\n\n`) +
        `All string values must be written in ${langName}.\n\n` +
        `${EDITORIAL_VOICE(langName)}\n\n` +
        `${JARGON_BAN}\n\n` +

        // ── STEP 1: DISCOVERY HUNT ─────────────────────────────────────────
        `STEP 1 — SILENT DISCOVERY HUNT (do this before writing anything):\n` +
        `Read the verse closely. Scan for candidate discoveries in each of these 7 categories. ` +
        `Generate at least one candidate per category before moving to Step 2.\n\n` +

        `Category 1 — LEXICAL SURPRISE:\n` +
        `Is there a word in the original Greek or Hebrew whose force, range of meaning, or root metaphor ` +
        `is stronger, stranger, or more physical than the translation suggests? ` +
        `What does the translation flatten or domesticate?\n` +
        `Example: Greek εὔσπλαγχνοι (compassion) literally means "good intestines" — the seat of emotion ` +
        `was the gut, not the heart. Most translations erase this bodily force entirely.\n\n` +

        `Category 2 — CHOSEN-WORD CONTRAST:\n` +
        `What word did the author use, and what word could they have used instead? ` +
        `Is there a near-synonym that would have been more expected or more conventional? ` +
        `What does the actual choice reveal about the meaning?\n` +
        `Example: Paul chose χαρίζομαι (to give as a gift) for "forgive," not ἀφίημι (to release a debt). ` +
        `The difference turns forgiveness from legal cancellation into an act of generosity.\n\n` +

        `Category 3 — BODY OR SPATIAL METAPHOR:\n` +
        `Is there a physical image, body-language metaphor, or spatial concept hiding under an abstract ` +
        `translation? Something that involves anatomy, movement, distance, weight, debt, gift?\n` +
        `Example: "heart" in many verses translates words that originally meant liver, gut, or chest cavity — ` +
        `organs understood as the seat of emotion in antiquity.\n\n` +

        `Category 4 — SYNTAX OR PREPOSITION:\n` +
        `Does a preposition, particle, or word-order choice change the agency, location, or direction ` +
        `of the action? What shifts if you read the structure precisely rather than paraphrastically?\n` +
        `Example: "in Christ" as a location rather than an instrument — forgiving because you are inside ` +
        `something, not merely pointing to someone else's example.\n\n` +

        `Category 5 — STRUCTURE OR RHETORIC:\n` +
        `Does the verse have a ladder structure, asyndeton (no conjunctions between items), parallelism, ` +
        `compression, reversal, or chiasm? Does the sequence escalate or create surprise? ` +
        `What would be lost if the verse were reordered?\n` +
        `Example: "Be kind — compassionate — forgiving" without conjunctions in Greek makes the three ` +
        `actions rush together, each one presupposing the last.\n\n` +

        `Category 6 — TRANSLATION LOSS:\n` +
        `What does the most common translation smooth over, omit, or accidentally normalize? ` +
        `What sounds ordinary in ${langName} but was strange or sharp in the original language?\n` +
        `Example: Russian "простите" (forgive) hides the gift-giving etymology entirely.\n\n` +

        `Category 7 — CONTEXTUAL TURN:\n` +
        `Use the full chapter context provided above. Look for what changes immediately before and after the target verse. ` +
        `Does the speaker change, the audience change, the tone change, or the argument move from reason to command, from command to promise, from scene to interpretation? ` +
        `Does the target verse function as a hinge, climax, answer, interruption, transition, reversal, or landing point? ` +
        `Only use context visible in the provided chapter text. Do not invent context.\n\n` +

        `ADDITIONAL HIGH-YIELD DISCOVERY PATTERNS:\n` +
        `After scanning the 7 categories above, also check these three patterns before moving to Step 2:\n\n` +

        `Pattern A — EXPECTATION REVERSAL:\n` +
        `What would a careful reader naturally assume this verse is doing, and does the wording, structure, or context show that it is actually doing something sharper, stranger, or more specific?\n` +
        `Example: a line may sound like a definition, but in context it functions as an argument, appeal, warning, answer, or pivot.\n\n` +

        `Pattern B — MEANINGFUL ABSENCE:\n` +
        `What does the verse not say that the reader might expect it to say? ` +
        `Is there a missing explanation, missing emotion, missing command, missing subject, missing reason, or missing transition? ` +
        `Does that absence change the force of the verse?\n\n` +

        `Pattern C — AGENCY / PRESSURE POINT:\n` +
        `Map who acts, who receives, who speaks, who is silent, who initiates, and who merely responds. ` +
        `Then identify the load-bearing word, phrase, or clause: the detail that would change the whole verse if it were removed, translated differently, or moved elsewhere.\n\n` +

        `Do not force original-language discoveries. If the strongest discovery is contextual, structural, rhetorical, narrative, based on absence, or based on agency, prefer that over a weaker Greek/Hebrew word note. Original-language claims must be concrete and modest.\n\n` +

        // ── STEP 2: REJECTION TEST ─────────────────────────────────────────
        `STEP 2 — REJECTION TEST (apply to every candidate from Step 1):\n` +
        `For each candidate, ask this single question:\n` +
        `"Could this angle be written without knowing anything specific about the wording, ` +
        `original language, structure, or context of this verse?"\n\n` +
        `If the answer is YES — reject immediately. ` +
        `Angles that survive rejection must be rooted in something that exists only in this specific verse.\n\n` +

        `REJECTED immediately (examples of what fails the test):\n` +
        `- "Forgiveness depends on receiving mercy" — this is a theological claim, not a textual observation\n` +
        `- "Kindness comes before forgiveness" — barely requires reading the verse\n` +
        `- "Compassion is important in relationships" — requires no knowledge of the verse at all\n` +
        `- "The verse has three parts" — true of countless verses; says nothing specific\n` +
        `- "Mutuality matters" — could be said about almost any verse on relationships\n\n` +

        `PASS the test (examples of what survives):\n` +
        `- "The verb Paul chose for 'forgive' means to give as a gift, not to cancel a debt" — specific to the Greek word choice\n` +
        `- "Compassion does not live in the heart here — it lives in the gut" — specific to εὔσπλαγχνοι\n` +
        `- "Paul lists three actions without conjunctions — the sentence accelerates rather than enumerates" — specific to Greek syntax\n` +
        `- "The phrase 'in Christ' makes forgiveness a location, not an instrument" — specific to this preposition\n` +
        `- "Russian 'простите' may hide the fact that Paul did not choose the debt-cancelling verb" — specific to translation gap\n\n` +

        // ── STEP 3: BUILD CARDS ────────────────────────────────────────────
        `STEP 3 — BUILD THE STRONGEST DISCOVERIES INTO CARDS:\n` +
        `Return between 4 and 8 cards.\n` +
        `Start with the strongest 4 discoveries. Add a 5th, 6th, 7th, or 8th card ONLY if the extra card is a genuinely distinct angle and would likely deserve a score of 82+ under a strict Scriptura AI evaluation.\n` +
        `Do not fill the list just to reach 8. If only 4 strong angles exist, return exactly 4. If 5 or 6 strong angles exist, return 5 or 6. If the verse is unusually rich and 7 or 8 distinct strong angles exist, return 7 or 8.\n` +
        `Prefer discoveries from different categories. No two cards may make the same basic point. Do not include weaker duplicates, alternate phrasings of the same angle, or generic applications.\n\n` +

        `QUALITY THRESHOLD FOR EXTRA CARDS:\n` +
        `Cards 1–4 must be the best surviving discoveries.\n` +
        `Cards 5–8 are optional and must pass a higher bar: they must be distinct, text-grounded, non-obvious, and likely strong enough to become public cards after evaluation.\n` +
        `If an optional card feels merely useful, familiar, decorative, or only moderately interesting, do not include it.\n\n` +

        `TITLE STANDARD:\n` +
        `The title must be a sharp, concrete statement of the discovery — not a topic, not a theme. ` +
        `It should make the reader immediately think: "What do you mean? Show me."\n\n` +
        `BAD: "The Importance of Compassion", "Forgiveness in Context", "Paul's Teaching on Kindness"\n` +
        `GOOD: "The Verb That Turns Forgiveness from Bookkeeping into a Gift", ` +
        `"Compassion Does Not Live in the Heart Here", ` +
        `"Paul Uses Three Words Without Conjunctions — and the Sentence Accelerates", ` +
        `"The Phrase 'In Christ' Makes Forgiveness a Location, Not an Instrument"\n\n` +

        `TEASER STANDARD:\n` +
        `2-3 sentences. Begin with the discovery, not with "This verse…" or "Paul says…". ` +
        `Explain the hidden mechanism. Make the reader want to expand the card.\n\n` +

        `ANCHOR STANDARD:\n` +
        `The exact word, phrase, or structural feature from the verse that the angle is grounded in. ` +
        `If the discovery involves original language, quote the original word alongside the translation.\n\n` +

        `WHY_IT_MATTERS STANDARD:\n` +
        `One sentence. A perceptual shift — how the verse reads differently after seeing this. ` +
        `Not a moral lesson.\n\n` +

        `Task: Return a JSON array of 4 to 8 angle objects. ` +
        `Output JSON only — no markdown fences, no prose before or after.\n\n` +

        `Each object has exactly these keys:\n` +
        `- "title": discovery-driven statement, max 14 words, in ${langName}\n` +
        `- "teaser": 2-3 sentences, starts with the discovery not a summary, in ${langName}\n` +
        `- "anchor": exact word/phrase/structure from the verse (include original-language form if relevant), in ${langName}\n` +
        `- "why_it_matters": 1 sentence, perceptual shift, in ${langName}\n\n` +

        `No banned words. No generic angles. No angle that fails the rejection test.\n\n` +

        `Output — valid JSON array only. The array length must be 4, 5, 6, 7, or 8 depending on how many strong distinct discoveries actually exist:\n` +
        `[{"title":"...","teaser":"...","anchor":"...","why_it_matters":"..."}]` +
        `\n\nREMINDER: JSON only. All strings in ${langName}. Every angle must survive the rejection test. Do not pad the array with weak material.`
      );

    // ─── WORD ─────────────────────────────────────────────────────────────────
    case "word":
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `All string values must be written in ${langName}.\n\n` +
        `${EDITORIAL_VOICE(langName)}\n\n` +
        `${JARGON_BAN}\n\n` +

        `STEP 1 — HUNT FOR WORD-LEVEL DISCOVERIES:\n` +
        `Read the verse. Scan for 2–4 words or short phrases where the original Greek or Hebrew ` +
        `does something the translation cannot capture or quietly chooses not to.\n\n` +
        `Hunt in these categories:\n\n` +
        `Category A — SEMANTIC RANGE:\n` +
        `Does the original word carry a wider, stranger, or more physical range of meaning ` +
        `than the translation suggests? What does the single translated word collapse?\n` +
        `Example: σπλάγχνα (splanchna) covers gut, womb, bowels — translated "compassion" loses every organ.\n\n` +

        `Category B — ROOT METAPHOR:\n` +
        `Is there a buried physical image inside an abstract word? ` +
        `What did the original speakers picture when they used this word?\n` +
        `Example: χαρίζομαι (to forgive) comes from χάρις (gift, favor) — the root is giving, not releasing.\n\n` +

        `Category C — WORD CHOICE VS ALTERNATIVE:\n` +
        `What word did the author use, and what near-synonym could they have chosen instead? ` +
        `Why does the actual choice matter?\n` +
        `Example: Paul chose χαρίζομαι, not ἀφίημι — gift-giving logic, not debt-cancelling logic.\n\n` +

        `Category D — TRANSLATION GAP:\n` +
        `What does the ${langName} translation smooth over, flatten, or accidentally normalize? ` +
        `What sounds ordinary in ${langName} but was strange in the original?\n\n` +

        `Category E — TENSE, VOICE, OR MOOD:\n` +
        `Does a grammatical form — aorist, passive, imperative, participle — carry meaning ` +
        `that the translation paraphrases away?\n\n` +

        `STEP 2 — REJECTION TEST:\n` +
        `For each candidate, ask: "Could this be written without knowing the original word, ` +
        `its root, its tense, or its translation gap?"\n` +
        `If YES — reject. Only discoveries rooted in specific textual evidence survive.\n\n` +

        `STEP 3 — BUILD 3 STRONGEST WORD CARDS:\n` +
        `Choose the 3 discoveries that survived. Prefer cards from different categories.\n\n` +

        `TITLE STANDARD:\n` +
        `A sharp statement of the discovery — not a label, not a topic.\n` +
        `BAD: "The Word for Compassion", "Greek Vocabulary", "Key Terms"\n` +
        `GOOD: "The Organ That Got Replaced by a Feeling", "The Verb That Was Always a Gift, Never a Receipt"\n\n` +

        `TEASER STANDARD:\n` +
        `2–3 sentences. Begin with the discovery, not "The Greek word X means…". ` +
        `Show what the original does that the translation cannot.\n\n` +

        `ORIGINAL STANDARD:\n` +
        `The original word in its script plus transliteration. Format: "word (transliteration)". ` +
        `Example: "εὔσπλαγχνοι (eusplanchnoi)"\n\n` +

        `GAP STANDARD:\n` +
        `One sentence. Precisely what the ${langName} translation loses or flattens.\n\n` +

        `WHY_IT_MATTERS STANDARD:\n` +
        `One sentence. How the verse reads differently after seeing this word clearly.\n\n` +

        `Task: Return a JSON array of exactly 3 word-card objects. ` +
        `Output JSON only — no markdown fences, no prose before or after.\n\n` +

        `Each object has exactly these keys:\n` +
        `- "title": discovery-driven statement, max 12 words, in ${langName}\n` +
        `- "teaser": 2–3 sentences, begins with the discovery, in ${langName}\n` +
        `- "original": original word with transliteration, in original language script\n` +
        `- "gap": 1 sentence — what ${langName} translation loses, in ${langName}\n` +
        `- "why_it_matters": 1 sentence, perceptual shift, in ${langName}\n\n` +

        `Output — valid JSON array only:\n` +
        `[{"title":"...","teaser":"...","original":"...","gap":"...","why_it_matters":"..."},` +
        `{"title":"...","teaser":"...","original":"...","gap":"...","why_it_matters":"..."},` +
        `{"title":"...","teaser":"...","original":"...","gap":"...","why_it_matters":"..."}]` +
        `\n\nREMINDER: JSON only. All string values except "original" in ${langName}. Every card must survive the rejection test.`
      );

    // ─── CONTEXT ──────────────────────────────────────────────────────────────
    case "context": {
      const chapterReference =
        args.chapterReference ?? "the chapter containing the target verse";
      const chapterText = args.chapterText?.trim();

      return (
        `${fence}\n\n` +
        `Target verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `Full chapter context: ${chapterReference}\n` +
        (chapterText
          ? `"${chapterText}"\n\n`
          : `[CHAPTER TEXT WAS NOT PROVIDED. Use only stable biblical context you can confidently reconstruct, but clearly prioritize local context and avoid guessing specific verse wording.]\n\n`) +
        `All string values must be written in ${langName}.\n\n` +
        `${EDITORIAL_VOICE(langName)}\n\n` +
        `${JARGON_BAN}\n\n` +

        `TASK: Build a real Context Lens. Do NOT create ordinary insight cards, word studies, translation observations, or general reflections.\n\n` +

        `A context card is valid ONLY if the idea becomes visible because the target verse is read inside a larger unit.\n` +
        `If the same idea could be written by looking only at the target verse, reject it.\n\n` +

        `WORK IN THREE LAYERS, IN THIS ORDER:\n\n` +

        `LAYER 1 — NEAREST MEANING UNIT:\n` +
        `From the full chapter, identify the closest meaningful unit around the target verse. ` +
        `Usually this means the few verses before and after, but do not mechanically choose 3–5 verses. ` +
        `Find the actual paragraph, scene, prayer movement, argument step, contrast, or turn of thought.\n\n` +
        `Ask:\n` +
        `- Where does this local thought begin and end?\n` +
        `- Is the target verse an answer, hinge, climax, transition, explanation, contrast, correction, or conclusion?\n` +
        `- What does the local movement make visible that the isolated verse hides?\n\n` +

        `LAYER 2 — WHOLE CHAPTER MOVEMENT:\n` +
        `Read the whole chapter as a flow. Identify what the chapter is doing before and after the target verse.\n\n` +
        `Ask:\n` +
        `- What is the chapter's main movement?\n` +
        `- Why does this verse appear at this exact point?\n` +
        `- What changes if the reader sees the whole chapter around it?\n` +
        `- Does the verse summarize, sharpen, redirect, or deepen the chapter's argument?\n\n` +

        `LAYER 3 — BOOK / WHOLE-BIBLE CONTEXT, ONLY IF USEFUL:\n` +
        `Use broader book-level or whole-Bible context only if it genuinely changes the reading of the target verse. ` +
        `Do not force cross-references. Do not create generic biblical-theology cards. ` +
        `A broad-context card must still explain how it illuminates this specific verse in this specific chapter.\n\n` +

        `STRICT REJECTION TEST:\n` +
        `Reject any candidate if it is:\n` +
        `- a lexical observation about a word;\n` +
        `- a translation-gap observation;\n` +
        `- a generic spiritual lesson;\n` +
        `- a normal "interesting thought" that does not require the chapter;\n` +
        `- a paraphrase of the target verse;\n` +
        `- a card that could also appear under the Word Lens or Pearls Lens.\n\n` +

        `VALID CONTEXT DISCOVERIES LOOK LIKE THIS:\n` +
        `- "This line is not a definition; in the prayer movement, it functions as Jesus' appeal to the Father."\n` +
        `- "The previous verses make this verse the hinge between authority received and life given."\n` +
        `- "The chapter's movement shows that this phrase is not isolated doctrine but part of a farewell-prayer logic."\n` +
        `- "The next verses reveal that the verse is not only about knowledge but about being drawn into the Son's mission."\n\n` +

        `INVALID CONTEXT DISCOVERIES:\n` +
        `- "The word means more than intellectual knowledge." That belongs to Word Lens.\n` +
        `- "This verse teaches that eternal life is important." Too generic.\n` +
        `- "The verse has a deep meaning." Empty.\n` +
        `- "Knowing God means relationship." Could be written from the target verse alone unless the surrounding chapter changes it.\n\n` +

        `OUTPUT GOAL:\n` +
        `Return 3 context cards. Each card must come from a different contextual layer if possible:\n` +
        `1. nearest meaning unit / paragraph;\n` +
        `2. whole chapter movement;\n` +
        `3. broader book or biblical context, only if genuinely useful. If broad context is weak, use another strong local/chapter card instead.\n\n` +

        `JSON FORMAT:\n` +
        `Return JSON only. No markdown fences. No prose before or after.\n\n` +
        `The output must have exactly this shape:\n` +
        `{\n` +
        `  "thesis": "one elegant sentence in ${langName} explaining what the chapter context changes about the target verse",\n` +
        `  "cards": [\n` +
        `    {\n` +
        `      "title": "sharp context-driven discovery, max 12 words, in ${langName}",\n` +
        `      "teaser": "2-3 sentences. Start with the contextual discovery, not with a summary of the verse. Explain what the surrounding unit reveals.",\n` +
        `      "shift": "the specific contextual shift: nearest verses, chapter movement, or broader setting that changes the reading",\n` +
        `      "why_it_matters": "one sentence: how the verse reads differently after seeing this context"\n` +
        `    },\n` +
        `    {\n` +
        `      "title": "...",\n` +
        `      "teaser": "...",\n` +
        `      "shift": "...",\n` +
        `      "why_it_matters": "..."\n` +
        `    },\n` +
        `    {\n` +
        `      "title": "...",\n` +
        `      "teaser": "...",\n` +
        `      "shift": "...",\n` +
        `      "why_it_matters": "..."\n` +
        `    }\n` +
        `  ]\n` +
        `}\n\n` +
        `REMINDER: JSON only. All string values in ${langName}. Every card must pass the context-only rejection test.`
      );
    }

    // ─── TRANSLATIONS ─────────────────────────────────────────────────────────
    case "translations":
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `All string values must be written in ${langName}.\n\n` +
        `${EDITORIAL_VOICE(langName)}\n\n` +
        `${JARGON_BAN}\n\n` +

        `STEP 1 — GENERATE FOUR TRANSLATION VERSIONS OF THIS VERSE:\n` +
        `Produce the verse text in these four versions. Be as accurate as possible to each translation's known style and terminology.\n\n` +
        (args.lang === "ru"
          ? `- "literal": word-for-word interlinear rendering from Greek/Hebrew — show the force of each word\n` +
            `- "synodal": Синодальный перевод (1876) — formal, classical Russian\n` +
            `- "rbo": Перевод РБО — modern meaning-based Russian\n` +
            `- "nwt": Перевод Нового Мира (2007) — literal with distinctive terminology\n\n`
          : `- "literal": word-for-word interlinear rendering from Greek/Hebrew — show the force of each word\n` +
            `- "esv": English Standard Version — formal equivalence\n` +
            `- "nlt": New Living Translation — meaning-based, contemporary\n` +
            `- "nwt": New World Translation (2013) — literal with distinctive terminology\n\n`) +

        `STEP 2 — FIND 3 POINTS OF MEANINGFUL DIVERGENCE:\n` +
        `Compare the four versions. Find exactly 3 places where the translations make genuinely different choices — ` +
        `not just synonym swaps, but differences that change the temperature, logic, agency, or theology of the sentence.\n\n` +
        `For each divergence ask:\n` +
        `- What does each version do with this word or phrase?\n` +
        `- Is one version more legal, more physical, more intimate, more abstract?\n` +
        `- Is one translation hiding the strangeness of the original? Is one sharpening it?\n` +
        `- What does a reader understand differently depending on which version they hold?\n\n` +
        `IMPORTANT — DO NOT RANK TRANSLATIONS:\n` +
        `Never say one translation is better, more accurate, more faithful, preferred, or recommended. ` +
        `Describe what each version does and what it changes, emphasizes, hides, compresses, or makes explicit. ` +
        `Your role is diagnostic, not evaluative.\n\n` +

        `STEP 3 — REJECTION TEST:\n` +
        `Reject any divergence that is merely a synonym swap with no meaningful difference in meaning. ` +
        `Only keep divergences where the choice actually changes what the reader understands.\n\n` +

        `STEP 4 — BUILD OUTPUT:\n` +
        `Return a JSON object with this exact shape:\n\n` +
        `{\n` +
        `  "versions": {\n` +
        `    "literal": "...",\n` +
        (args.lang === "ru"
          ? `    "synodal": "...",\n    "rbo": "...",\n    "nwt": "..."\n`
          : `    "esv": "...",\n    "nlt": "...",\n    "nwt": "..."\n`) +
        `  },\n` +
        `  "divergences": [\n` +
        `    {\n` +
        `      "title": "sharp statement of what diverges, max 10 words, in ${langName}",\n` +
        `      "quotes": [\n` +
        `        {"label": "LITERAL", "text": "the specific phrase from the literal rendering"},\n` +
        (args.lang === "ru"
          ? `        {"label": "SYNODAL", "text": "the specific phrase from Synodal"},\n` +
            `        {"label": "RBO", "text": "the specific phrase from RBO"},\n` +
            `        {"label": "NWT", "text": "the specific phrase from NWT"}\n`
          : `        {"label": "ESV", "text": "the specific phrase from ESV"},\n` +
            `        {"label": "NLT", "text": "the specific phrase from NLT"},\n` +
            `        {"label": "NWT", "text": "the specific phrase from NWT"}\n`) +
        `      ],\n` +
        `      "analysis": [\n` +
        `        "Short paragraph 1 — what one or two translations do and why it matters (2–4 lines max).",\n` +
        `        "Short paragraph 2 — what the other versions do, any contrast (2–4 lines max).",\n` +
        `        "Short paragraph 3 — what is at stake theologically, logically, or rhetorically (1–3 lines max)."\n` +
        `      ]\n` +
        `    }\n` +
        `  ],\n` +
        `  "verdict": "one sentence — diagnostic conclusion only, in ${langName}. ` +
        `Choose ONE of these three patterns based on what you found:\\n` +
        `• If differences are SUBSTANTIAL (different meaning): state that the versions diverge at key points and the chosen version changes the meaning.\\n` +
        `• If differences are STYLISTIC (same meaning, different register): state that the versions mostly agree and the differences are stylistic, not semantic.\\n` +
        `• If differences are MIXED: state that some differences are stylistic while others change the logic of the phrase.\\n` +
        `DO NOT name a winning translation. DO NOT say one is better, more accurate, or preferred. Diagnose; do not rank."\n` +
        `}\n\n` +

        `ANALYSIS RULE: "analysis" must be an array of 2–3 short paragraphs. ` +
        `No paragraph longer than 4 lines. No single-block wall of text. ` +
        `JSON only. No markdown fences. No prose before or after. All string values in ${langName} except translation labels.`
      );
  }
}
