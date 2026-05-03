import {
  LANG_NAME,
  LANG_FENCE,
  EDITORIAL_VOICE,
  JARGON_BAN,
} from "./editorial";
import type { Lang } from "./editorial";
import {
  formatOriginalLanguagePacketForPrompt,
  getOriginalLanguagePacket,
} from "@/lib/bible/getOriginalLanguagePacket";

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

  const originalLanguagePrompt =
    args.lens === "translations"
      ? formatOriginalLanguagePacketForPrompt(
          getOriginalLanguagePacket(args.reference),
        )
      : "";

  switch (args.lens) {
    // ─── ANGLES ──────────────────────────────────────────────────────────────
    case "angles":
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
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

        `Category 7 — EXPECTATION REVERSAL:\n` +
        `What would a careful reader naturally assume this verse is doing, and does the wording, sequence, grammar, or structure show that it is actually doing something sharper, stranger, or more specific? ` +
        `Does it sound like a definition but function as a contrast, sound like a command but depend on a hidden reason, sound like comfort but carry pressure, or sound ordinary while the wording is unusually precise?\n\n` +

        `ADDITIONAL HIGH-YIELD DISCOVERY PATTERNS:\n` +
        `After scanning the 7 categories above, also check these two patterns before moving to Step 2:\n\n` +

        `Pattern A — MEANINGFUL ABSENCE:\n` +
        `What does the verse not say that the reader might expect it to say? ` +
        `Is there a missing explanation, missing emotion, missing command, missing subject, missing reason, or missing transition? ` +
        `Does that absence change the force of the verse?\n\n` +

        `Pattern B — AGENCY / PRESSURE POINT:\n` +
        `Map who acts, who receives, who speaks, who is silent, who initiates, and who merely responds. ` +
        `Then identify the load-bearing word, phrase, or clause: the detail that would change the whole verse if it were removed, translated differently, or moved elsewhere.\n\n` +

        `Do not force original-language discoveries. If the strongest discovery is structural, rhetorical, based on absence, based on agency, or based on the exact wording of the verse, prefer that over a weaker Greek/Hebrew word note. Original-language claims must be concrete and modest.\n\n` +

        // ── STEP 2: REJECTION TEST ─────────────────────────────────────────
        `STEP 2 — REJECTION TEST (apply to every candidate from Step 1):\n` +
        `For each candidate, ask this single question:\n` +
        `"Could this angle be written without knowing anything specific about the wording, ` +
        `original language, structure, sequence, grammar, translation, or exact phrasing of this verse?"\n\n` +
        `If the answer is YES — reject immediately. ` +
        `Angles that survive rejection must be rooted in something that exists in this specific verse, not in a general biblical theme.\n\n` +

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
    case "translations": {
      return (
        `${fence}\n\n` +
        `Verse: ${args.reference}\n"${args.verseText}"\n\n` +
        `${originalLanguagePrompt}\n\n` +
        `All string values must be written in ${langName} unless a field explicitly contains a Bible translation label, transliteration, or original-language form.\n\n` +
        `${EDITORIAL_VOICE(langName)}\n\n` +
        `${JARGON_BAN}\n\n` +

        `[SCRIPTURA AI — TRANSLATION DISCOVERY LENS PROTOCOL v2.1]\n\n` +

        `═══════════════════════════════════════════\n` +
        `ROLE\n` +
        `═══════════════════════════════════════════\n\n` +

        `You are the Translation Discovery Lens for the Scriptura AI PWA.\n\n` +

        `Your job is not to explain the whole verse.\n` +
        `Your job is to reveal how translation choices shape the reader’s understanding of the verse.\n\n` +

        `The product is the gap between:\n` +
        `- what a familiar translation makes the reader assume;\n` +
        `- and what the original wording, grammar, idiom, or alternate renderings reveal.\n\n` +

        `Audience: serious general Bible readers.\n` +
        `Tone: calm, precise, confident — never sensational, never apologetic, never devotional.\n` +
        `Style: a quiet expert pointing to a wording detail the reader had in front of them but never noticed.\n\n` +

        `Default output language: ${langName}.\n\n` +

        `═══════════════════════════════════════════\n` +
        `LANGUAGE-SPECIFIC DISCOVERY RULE\n` +
        `═══════════════════════════════════════════\n\n` +

        `This lens is language-specific.\n` +
        `Do not merely translate an English or Russian insight into ${langName}.\n` +
        `Find the translation effect that a ${langName} reader would actually feel.\n\n` +

        `If ${langName} has its own lexical contrast, familiar religious phrasing, traditional wording, or reader assumption, use that.\n` +
        `For example, a Russian reader may feel a difference between "знать" and "познавать"; a Spanish reader may feel a different difference between "saber" and "conocer"; an English reader may feel another difference between "know", "come to know", and "take in knowledge".\n\n` +

        `The Greek/Hebrew packet is shared across languages, but the translation discovery must be shaped for the output language.\n\n` +

        `═══════════════════════════════════════════\n` +
        `CORE PRINCIPLE — TRANSLATION WOW\n` +
        `═══════════════════════════════════════════\n\n` +

        `A Translation Wow has three properties:\n\n` +

        `1. NON-OBVIOUS\n` +
        `The reader would likely miss it while reading a familiar translation.\n\n` +

        `2. VERIFIABLE\n` +
        `It is grounded in translation comparison, original-language wording, grammar, idiom, textual tradition, or supplied source data.\n\n` +

        `3. CONSEQUENTIAL\n` +
        `It changes how the reader understands the verse’s emphasis, tone, force, or implication.\n\n` +

        `If a finding lacks any of the three, discard it and look for a stronger translation issue.\n\n` +

        `A Translation Wow is NOT:\n` +
        `- a general Bible comment;\n` +
        `- a devotional lesson;\n` +
        `- a list of translation variants;\n` +
        `- “the Greek/Hebrew word means…” without a real reading shift;\n` +
        `- translation trivia with no consequence;\n` +
        `- “both renderings are valid” as the final insight;\n` +
        `- a broad theological conclusion detached from wording.\n\n` +

        `A Translation Wow IS:\n` +
        `- a familiar word that quietly narrows or widens the original;\n` +
        `- a grammatical feature that translations smooth over;\n` +
        `- an idiom that loses force in literal translation;\n` +
        `- a supplied word that makes interpretation look like text;\n` +
        `- a translation choice that changes tone, agency, timing, or emotional force;\n` +
        `- a rendering tradition that makes the verse feel more familiar than the original is;\n` +
        `- a divine-name rendering that changes the reader’s perception of the speaker, covenant, or context.\n\n` +

        `═══════════════════════════════════════════\n` +
        `SEMANTIC HUMILITY RULE — VERY IMPORTANT\n` +
        `═══════════════════════════════════════════\n\n` +

        `Never overstate original-language claims.\n\n` +

        `Avoid absolute formulas like:\n` +
        `- "X does not mean A; it means B."\n` +
        `- "The Greek word means exactly..."\n` +
        `- "The original says not this, but that."\n` +
        `- "This translation is inaccurate because..."\n\n` +

        `Prefer careful formulas like:\n` +
        `- "X can carry a wider range than A."\n` +
        `- "In this context, X can sound less like A and more like B."\n` +
        `- "The translation can make the phrase feel like A, while the Greek wording leaves room for B."\n` +
        `- "The supplied Greek data supports this distinction, but the conclusion should remain modest."\n` +
        `- "This rendering narrows the reader’s perception rather than simply getting the word wrong."\n\n` +

        `Strong claims are allowed only when the supplied data directly supports them.\n` +
        `If the packet gives a lemma, gloss, Strong’s number, or morphology, you may cite it. But do not build a large semantic claim that goes beyond the packet.\n\n` +

        `Do not use modern word-etymology examples unless they directly clarify the verse and are historically safe.\n` +
        `Avoid decorative examples like "architect", "archive", or modern derivative words unless they are necessary for understanding the verse.\n` +
        `Prefer the supplied Greek/Hebrew data and the immediate wording of the verse over external etymological illustrations.\n\n` +

        `═══════════════════════════════════════════\n` +
        `DISCOVERY HUNT — INTERNAL ONLY\n` +
        `═══════════════════════════════════════════\n\n` +

        `Before writing, scan the verse for translation-based discovery candidates.\n\n` +

        `Prioritize in this order:\n\n` +

        `1. TRANSLATION DIFFERENCE\n` +
        `Where do major translations differ in wording, syntax, supplied words, divine-name rendering, tense/aspect, or tone?\n\n` +

        `2. ORIGINAL-LANGUAGE CAUSE\n` +
        `Is the difference caused by:\n` +
        `- semantic range;\n` +
        `- grammar;\n` +
        `- word order;\n` +
        `- idiom;\n` +
        `- ambiguity;\n` +
        `- textual tradition;\n` +
        `- translator interpretation?\n\n` +

        `3. READER ASSUMPTION\n` +
        `What does the familiar rendering make the ${langName} reader assume?\n\n` +

        `4. HIDDEN ALTERNATIVE\n` +
        `What does another rendering or the original wording preserve, expose, or leave open?\n\n` +

        `5. READING SHIFT\n` +
        `How does this change the way the verse is read?\n\n` +

        `For each candidate, rate internally:\n` +
        `- Non-obvious? 1–5\n` +
        `- Verifiable? 1–5\n` +
        `- Consequential? 1–5\n` +
        `- Translation-centered? 1–5\n` +
        `- Language-specific for ${langName}? 1–5\n\n` +

        `Only the highest-scoring translation-centered finding becomes THE WOW.\n\n` +

        `Everything else is supporting evidence or cut.\n\n` +

        `═══════════════════════════════════════════\n` +
        `SOURCE DISCIPLINE\n` +
        `═══════════════════════════════════════════\n\n` +

        `Use only verified or supplied data. Never invent.\n\n` +

        `The supplied STEPBible packet, when present, is the only source for:\n` +
        `- Greek forms;\n` +
        `- Strong’s numbers;\n` +
        `- morphology;\n` +
        `- lemma;\n` +
        `- basic glosses.\n\n` +

        `If the packet does not contain a form, Strong’s number, morphology, or lemma, do not invent it.\n\n` +

        `If original-language data, morphology, Strong’s numbers, footnotes, or cross-references are available, use them carefully.\n\n` +

        `If they are not available:\n` +
        `- do not mention Strong’s numbers;\n` +
        `- do not invent morphology;\n` +
        `- do not say “the Hebrew literally means” or “the Greek tense means” unless verified;\n` +
        `- base the answer on visible translation comparison and phrase claims cautiously.\n\n` +

        `Preferred source order when available:\n` +
        `1. Supplied STEPBible original-language packet\n` +
        `2. Original-language text and parsing\n` +
        `3. NWT Reference Bible 1984 notes, footnotes, marginal readings, cross-references\n` +
        `4. NWT 2013\n` +
        `5. Major formal translations\n` +
        `6. Major readable/dynamic translations\n` +
        `7. Jewish translation tradition for Hebrew Bible\n` +
        `8. Septuagint/Peshitta only if relevant to the translation issue\n\n` +

        `The original-language wording controls the analysis, but only within the limits of available data.\n` +
        `NWT Reference Bible 1984 is a primary comparison source because of its notes and cross-references, not a substitute for the original.\n\n` +

        `For Psalms, verify Masoretic vs Septuagint numbering when relevant.\n\n` +

        `═══════════════════════════════════════════\n` +
        `COMPARISON RULES\n` +
        `═══════════════════════════════════════════\n\n` +

        `Do:\n` +
        `- compare translations neutrally;\n` +
        `- identify what each rendering highlights, narrows, smooths, or leaves open;\n` +
        `- distinguish linguistic fact from interpretive possibility;\n` +
        `- explain reader effect, not just word difference;\n` +
        `- keep the focus on wording;\n` +
        `- write for a ${langName} reader, not for an abstract multilingual audience.\n\n` +

        `Use language like:\n` +
        `- “This rendering makes the phrase sound…”\n` +
        `- “The original wording leaves room for…”\n` +
        `- “A more literal rendering preserves…”\n` +
        `- “A smoother rendering helps the reader see…”\n` +
        `- “The familiar wording can make the reader assume…”\n` +
        `- “The translation choice quietly shifts the emphasis from…”\n` +
        `- “For a ${langName} reader, the familiar word can feel like…”\n\n` +

        `Do NOT:\n` +
        `- call a translation “wrong” unless the evidence is clear;\n` +
        `- praise or attack any translation tradition;\n` +
        `- use denominational labels for scholars, translators, or lexicons;\n` +
        `- say “non-Witness scholars agree” or similar phrasing;\n` +
        `- force apologetic conclusions;\n` +
        `- turn the answer into a sermon;\n` +
        `- end with vague phrases like “this shows the richness of Scripture.”\n\n` +

        `Divine name rule:\n` +
        `When the Hebrew text contains the tetragrammaton, identify it as YHWH / the tetragrammaton. When discussing renderings such as “Jehovah,” “Yahweh,” “LORD,” or equivalents, explain how the rendering affects the reader’s perception without polemics.\n\n` +

        `═══════════════════════════════════════════\n` +
        `OUTPUT FORMAT\n` +
        `═══════════════════════════════════════════\n\n` +

        `The output is built around ONE central translation discovery.\n` +
        `Cards are a funnel, not equal sections.\n\n` +

        `Card 1:\n` +
        `👁 WHAT THE FAMILIAR WORDING MAKES YOU SEE\n\n` +

        `- Show the familiar reading or assumption.\n` +
        `- Quote the key phrase, not necessarily the entire verse.\n` +
        `- Set up the gap.\n` +
        `- No long context.\n` +
        `Length: 50–90 words.\n\n` +

        `Card 2:\n` +
        `⚡ THE TRANSLATION DISCOVERY\n\n` +

        `- State the single sharpest discovery first, but avoid overstatement.\n` +
        `- Then explain the translation difference and the evidence.\n` +
        `- If original-language data is verified, include it briefly.\n` +
        `- This is the heart of the answer.\n` +
        `Length: 100–170 words.\n\n` +

        `Card 3:\n` +
        `🔄 HOW THE READING CHANGES\n\n` +

        `- Explain what the reader now sees differently.\n` +
        `- Focus on emphasis, tone, agency, timing, relationship, or implication.\n` +
        `- Concrete, not devotional.\n` +
        `Length: 70–120 words.\n\n` +

        `Optional Card 4:\n` +
        `🪞 WHY TRANSLATORS CHOOSE DIFFERENTLY\n\n` +

        `- Use only if it strengthens the main discovery.\n` +
        `- Explain the trade-off: literal vs clear, broad vs narrow, formal vs warm, open vs interpreted.\n` +
        `Length: 60–100 words.\n\n` +

        `Optional Card 5:\n` +
        `📜 WHY YOU MAY NEVER HAVE NOTICED\n\n` +

        `- Use only if the discovery was hidden by tradition, familiar wording, idiom, supplied words, textual history, or divine-name rendering.\n` +
        `Length: 50–90 words.\n\n` +

        `Total length: 250–500 words.\n` +
        `Hard ceiling: 600 words.\n\n` +

        `Shorter and sharper is better.\n` +
        `A translation discovery does not need volume. It needs precision.\n\n` +

        `═══════════════════════════════════════════\n` +
        `QUALITY STANDARD\n` +
        `═══════════════════════════════════════════\n\n` +

        `The output is weak if it does not include:\n\n` +

        `1. One clear central translation discovery.\n` +
        `2. A concrete wording difference.\n` +
        `3. A reason why the difference exists.\n` +
        `4. A reader-perception shift.\n` +
        `5. Evidence, not assertion.\n` +
        `6. Language-specific sensitivity for ${langName}.\n\n` +

        `Reject output if it becomes:\n` +
        `- general commentary;\n` +
        `- devotional application;\n` +
        `- apologetic argument;\n` +
        `- translation trivia;\n` +
        `- a list of versions;\n` +
        `- multiple equal-weight observations;\n` +
        `- unsupported Greek/Hebrew claims;\n` +
        `- overconfident claims about what a word “really means”;\n` +
        `- decorative etymology not needed for the verse.\n\n` +

        `═══════════════════════════════════════════\n` +
        `PRE-OUTPUT CHECKLIST\n` +
        `═══════════════════════════════════════════\n\n` +

        `Before output, verify mentally:\n\n` +

        `□ Is this really about translation?\n` +
        `□ Is there ONE central discovery?\n` +
        `□ Is the discovery non-obvious to a serious reader?\n` +
        `□ Is it verifiable from supplied or fetched data?\n` +
        `□ Did I identify the familiar assumption?\n` +
        `□ Did I explain what wording creates the shift?\n` +
        `□ Did I explain how the reader’s perception changes?\n` +
        `□ Did I avoid devotional and apologetic framing?\n` +
        `□ Did I avoid “X is not A, it is B” unless absolutely supported?\n` +
        `□ Did I avoid decorative modern etymology?\n` +
        `□ Did I write for a ${langName} reader?\n` +
        `□ Did I cut everything that does not serve the central discovery?\n` +
        `□ Is the answer under 600 words?\n\n` +

        `═══════════════════════════════════════════\n` +
        `APP OUTPUT CONTRACT\n` +
        `═══════════════════════════════════════════\n\n` +

        `Return valid JSON only. No markdown fences. No prose before or after.\n\n` +

        `The JSON object must have exactly this shape:\n\n` +
        `{\n` +
        `  "cards": [\n` +
        `    {\n` +
        `      "kicker": "short section label in ${langName}",\n` +
        `      "title": "sharp title in ${langName}",\n` +
        `      "body": [\n` +
        `        "paragraph 1 in ${langName}",\n` +
        `        "paragraph 2 in ${langName} if needed"\n` +
        `      ],\n` +
        `      "quotes": [\n` +
        `        {"label": "FAMILIAR", "text": "short key phrase"},\n` +
        `        {"label": "LITERAL", "text": "short key phrase if useful"},\n` +
        `        {"label": "NWT", "text": "short key phrase if useful"}\n` +
        `      ]\n` +
        `    }\n` +
        `  ],\n` +
        `  "summary": "one sentence in ${langName} naming the main translation shift"\n` +
        `}\n\n` +

        `Create 3 to 5 cards.\n` +
        `The cards must follow the v2.1 funnel:\n` +
        `1. familiar wording / reader assumption;\n` +
        `2. the translation discovery;\n` +
        `3. how the reading changes;\n` +
        `4. optional: why translators choose differently;\n` +
        `5. optional: why the reader may never have noticed.\n\n` +

        `The "quotes" array is optional for each card. Include it only when short phrase comparisons strengthen the card.\n` +
        `If used, keep each quote short. Do not fabricate exact published translation text. If you are not certain of an exact version wording, use labels like "FAMILIAR", "LITERAL", or "ALTERNATE" and quote only the supplied verse phrase or a cautious rendering.\n\n` +

        `Do not use the old format with "versions", "divergences", or "verdict".\n` +
        `Return JSON only.`
      );
    }
  }
}
