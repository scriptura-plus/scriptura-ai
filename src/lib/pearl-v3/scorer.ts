import { callPearlClaude } from "./claude";

export type ClaimType =
  | "structural"
  | "rhetorical"
  | "narrative"
  | "lexical"
  | "intertextual"
  | "theological";

export type WeaknessRoot =
  | "ground"
  | "rarity"
  | "execution"
  | "distance"
  | "literary"
  | "none";

export interface ScoreResult {
  textualGround: string;
  axes: {
    ground: number;
    rarity: number;
    execution: number;
    distance: number;
    literary: number;
  };
  score: number;
  claimType: ClaimType;
  reasoning: string;
  weaknessRoot: any;
  weaknessDetail: string;
}

type ScorerVerseContext = {
  centralRef?: string;
  reference?: string;
  ref?: string;
  centralText?: string;
  verseText?: string;
  text?: string;
  chapterText?: string | null;
  contextText?: string | null;
  [key: string]: unknown;
};

type ScorerPearl = {
  title?: string;
  anchorQuote?: string;
  anchor?: string;
  body?: string;
  text?: string;
  teaser?: string;
  whyMatters?: string;
  why_it_matters?: string;
  [key: string]: unknown;
};

type PearlV3ScorerInput = {
  ctx: ScorerVerseContext;
  card?: ScorerPearl;
  pearl?: ScorerPearl;
  originalLanguageForScorer?: unknown;
};

const WEIGHTS = {
  ground: 3,
  rarity: 5,
  execution: 3,
  distance: 2,
  literary: 2,
};

const MAX_TOTAL =
  (WEIGHTS.ground +
    WEIGHTS.rarity +
    WEIGHTS.execution +
    WEIGHTS.distance +
    WEIGHTS.literary) *
  10;

const SCORE_BOOST = 1.12;

const FORBIDDEN_PEARL_MARKERS: { label: string; pattern: RegExp }[] = [
  { label: "Greek characters", pattern: /[\u0370-\u03FF\u1F00-\u1FFF]/ },
  { label: "English: Greek", pattern: /\bgreek\b/i },
  { label: "English: Hebrew", pattern: /\bhebrew\b/i },
  { label: "English: Aramaic", pattern: /\baramaic\b/i },
  { label: "Strong numbers", pattern: /\bstrong'?s?\b/i },
  { label: "lemma", pattern: /\blemm(at)?s?\b/i },
  { label: "morphology", pattern: /\bmorpholog\w*\b/i },
  { label: "aorist", pattern: /\baorist\b/i },
  { label: "transliteration", pattern: /\btransliter\w*\b/i },
  { label: "etymology", pattern: /\betymolog\w*\b/i },
  { label: "original language", pattern: /\boriginal[- ]language\b/i },
  { label: "morph code", pattern: /\bV-[A-Z0-9]/ },
  { label: "Russian: Greek", pattern: /греческ/i },
  { label: "Russian: Greek abbreviation", pattern: /греч\./i },
  { label: "Russian: Hebrew", pattern: /еврейск/i },
  { label: "Russian: Hebrew abbreviation", pattern: /евр\./i },
  { label: "Russian: Aramaic", pattern: /арамейск/i },
  { label: "Russian: Aramaic abbreviation", pattern: /арам\./i },
  { label: "Russian: aorist", pattern: /аорист/i },
  { label: "Russian: lemma", pattern: /лемм/i },
  { label: "Russian: morphology", pattern: /морфолог/i },
  { label: "Russian: etymology", pattern: /этимолог/i },
  { label: "Russian: transliteration", pattern: /транслитер/i },
  { label: "Russian: Strong", pattern: /Стронг/i },
  { label: "Russian: prefix", pattern: /приставк/i },
  { label: "Russian: suffix", pattern: /суффикс/i },
  { label: "Russian: case", pattern: /падеж/i },
  { label: "Russian: verbal aspect", pattern: /вид[а-яё\s-]{0,24}глагол/i },
  { label: "Russian: participle", pattern: /причаст/i },
  { label: "Russian: perfective aspect", pattern: /совершенн[а-яё\s-]{0,24}вид/i },
  { label: "Russian: imperfective aspect", pattern: /несовершенн[а-яё\s-]{0,24}вид/i },
  { label: "Russian: one-time action", pattern: /однократн/i },
  { label: "Russian: ongoing grammatical state", pattern: /продолжающ[а-яё\s-]{0,32}состояни/i },
  { label: "English: participle", pattern: /\bparticiple\w*\b/i },
  { label: "English: perfective", pattern: /\bperfective\b/i },
  { label: "English: imperfective", pattern: /\bimperfective\b/i },
];

const SYSTEM = `You are a strict evaluator of Pearl cards.

The Pearl lens is NOT a lexicon lens, NOT an intertextual lens, and NOT a theology lens.

A valid Pearl card must be grounded only in the visible Russian verse text and its nearest narrative context:
- structure
- sequence
- repetition
- contrast
- silence or omission
- dramatic pause
- the position of the verse in the scene
- the function of the verse in the immediate context
- visible Russian wording as surface text, but not morphology or etymology

The Pearl lens must NOT use:
- Greek, Hebrew, or Aramaic words
- transliteration
- lemmas
- Strong numbers
- original-language morphology
- tense, voice, mood, case, or verbal aspect of the original language
- Russian morphology as the main argument: verbal aspect, prefix, suffix, case, etymology, fine synonym distinction
- intertextual links with other Bible books
- a denominational or theological system

If a card depends on original-language data or morphology:
- ground must be no higher than 4
- execution must be no higher than 3
- distance must be no higher than 5
- weakness_detail must explicitly say that this belongs to the future Lexicon lens, not Pearl

If a card depends on a link to another Bible book:
- distance must be no higher than 4
- weakness_detail must explicitly say that this belongs to an intertextual lens, not Pearl

If a card pushes a theological interpretation where the text allows several confessional readings:
- distance must be no higher than 5
- execution must be no higher than 6
- weakness_detail must explicitly mention the theological micro-interpretation

Evaluate five independent axes from 1 to 10.

GROUND:
10 = very strong visible structure, sequence, repetition, contrast, omission, pause, or position in the Russian text
8 = strong structural/contextual observation visible in Russian
6 = plausible but requires an interpretive step
4 = weak basis, argument from silence, overreading, or ambiguous connection
2 = almost no textual basis; mostly paraphrase or decoration
1 = no basis

RARITY:
10 = very rare observation for a mature reader
8 = uncommon and likely missed by most readers
6 = interesting but not unique
4 = typical sermon/commentary observation
2 = banal
1 = obvious paraphrase

EXECUTION:
10 = precise literary-analytical register, concrete title, no sermonizing, no devotional pressure, no watery paraphrase
8 = mostly strong, small roughness
6 = clear thought but with one noticeable register problem
4 = too sermonic, devotional, vague, decorative, or generic
2 = moralizing sermon more than Pearl
1 = unusable

DISTANCE:
10 = exactly about this verse and its immediate scene
8 = uses nearby context but returns to the center
6 = partially stretches to the whole scene/chapter
4 = drifts into another lens: intertext, theology, lexicon, original language
2 = mostly about another verse/topic/system
1 = the central verse is barely needed

LITERARY:
10 = vivid but disciplined prose; image helps reveal the text
8 = one strong functional image or phrase
6 = clear but ordinary
4 = decorative or vague image
2 = dry analysis or poetic fog
1 = style harms meaning

Do not reward beauty if ground is weak.
Do not reward rarity if the card violates Pearl boundaries.
Do not punish a card merely for being short.
Do not reward length.

IMPORTANT LANGUAGE RULE:
All JSON string values MUST be written in Russian only.
Do not write textual_ground, reasoning, or weakness_detail in English.
If the card is Russian, the whole evaluator response must be Russian.

Return strict JSON only.`;

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getRef(ctx: ScorerVerseContext): string {
  return (
    getString(ctx.centralRef) ||
    getString(ctx.reference) ||
    getString(ctx.ref) ||
    "Unknown reference"
  );
}

function getVerseText(ctx: ScorerVerseContext): string {
  return (
    getString(ctx.centralText) ||
    getString(ctx.verseText) ||
    getString(ctx.text) ||
    ""
  );
}

function getChapterText(ctx: ScorerVerseContext): string {
  return getString(ctx.chapterText) || getString(ctx.contextText);
}

function getPearlTitle(pearl: ScorerPearl): string {
  return getString(pearl.title);
}

function getPearlAnchor(pearl: ScorerPearl): string {
  return getString(pearl.anchorQuote) || getString(pearl.anchor);
}

function getPearlBody(pearl: ScorerPearl): string {
  return getString(pearl.body) || getString(pearl.text) || getString(pearl.teaser);
}

function getPearlWhyMatters(pearl: ScorerPearl): string {
  return getString(pearl.whyMatters) || getString(pearl.why_it_matters);
}

function pearlTextForChecks(pearl: ScorerPearl): string {
  return [
    getPearlTitle(pearl),
    getPearlAnchor(pearl),
    getPearlBody(pearl),
    getPearlWhyMatters(pearl),
  ].join("\n");
}

function getForbiddenPearlMarkerLabels(pearl: ScorerPearl): string[] {
  const text = pearlTextForChecks(pearl);

  return FORBIDDEN_PEARL_MARKERS
    .filter((marker) => marker.pattern.test(text))
    .map((marker) => marker.label);
}

function buildUserPrompt(ctx: ScorerVerseContext, pearl: ScorerPearl): string {
  const chapterText = getChapterText(ctx);
  const chapterBlock = chapterText
    ? `\nNearest context:\n${chapterText}\n`
    : "";

  return `INPUT

Verse: ${getRef(ctx)}
"${getVerseText(ctx)}"
${chapterBlock}
Pearl card:
Title: ${getPearlTitle(pearl)}
Anchor: ${getPearlAnchor(pearl)}
Body: ${getPearlBody(pearl)}
Why it matters: ${getPearlWhyMatters(pearl)}

STEP 1 - FIND THE TEXTUAL GROUND

Find the concrete textual basis for the central claim of the card.
Write it in one short phrase in textual_ground.
If there is no basis, write "absent".

The basis must be visible in the Russian verse text or nearest context.
Do not use Greek, Hebrew, Aramaic, morphology, Strong numbers, lemmas, transliteration, or etymology.

STEP 2 - CHECK PEARL BOUNDARIES

Before scoring, check:
1. Does the card rely on original language or morphology?
2. Does it build an intertextual link to another Bible book?
3. Does it push a theological micro-interpretation?
4. Is it merely a beautiful paraphrase?

If yes, reflect this in axes and weakness_detail.

STEP 3 - SCORE FIVE AXES

Score each axis from 1 to 10:
ground
rarity
execution
distance
literary

STEP 4 - CLASSIFY AND DIAGNOSE

claim_type must be one of:
structural, rhetorical, narrative, lexical, intertextual, theological

Best Pearl types:
structural, rhetorical, narrative

lexical is allowed only for visible Russian wording as surface text, without morphology or etymology.

intertextual and theological usually mean the card moved into another lens.

reasoning: 2-4 sentences explaining the scores.
weakness_detail: 2-4 sentences about the main weakness, or empty string if all axes are strong.

Return strict JSON only.
All text fields must be in Russian.

{
  "textual_ground": "<one phrase>",
  "axes": {
    "ground": <1-10>,
    "rarity": <1-10>,
    "execution": <1-10>,
    "distance": <1-10>,
    "literary": <1-10>
  },
  "claim_type": "<type>",
  "reasoning": "<2-4 sentences>",
  "weakness_detail": "<2-4 sentences or empty string>"
}`;
}

export async function runScorer(
  ctx: ScorerVerseContext,
  pearl: ScorerPearl,
  _ignoredLexiconContext?: unknown
): Promise<{ rawOutput: string; result: ScoreResult | null }> {
  const rawOutput = await callPearlClaude({    system: SYSTEM,
    user: buildUserPrompt(ctx, pearl),
    maxTokens: 1500,
  });

  const parsed = parseScoreJson(rawOutput);
  const result = parsed ? applyForbiddenMarkerGuard(parsed, pearl) : null;

  return { rawOutput, result };
}

function isPearlV3ScorerInput(value: unknown): value is PearlV3ScorerInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "ctx" in value &&
    ("card" in value || "pearl" in value)
  );
}

export async function runPearlV3Scorer(
  argsOrCtx: ScorerVerseContext | PearlV3ScorerInput,
  pearl?: ScorerPearl,
  _ignoredLexiconContext?: unknown
): Promise<{ rawOutput: string; result: ScoreResult | null }> {
  if (isPearlV3ScorerInput(argsOrCtx)) {
    return runScorer(
      argsOrCtx.ctx,
      argsOrCtx.card ?? argsOrCtx.pearl ?? {},
      argsOrCtx.originalLanguageForScorer
    );
  }

  return runScorer(argsOrCtx, pearl ?? {}, _ignoredLexiconContext);
}

function parseScoreJson(raw: string): ScoreResult | null {
  let cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    cleaned = cleaned.slice(objectStart, objectEnd + 1);
  }

  console.log("SCORER RAW:");
  console.log(raw);
  console.log("SCORER CLEANED:");
  console.log(cleaned);

  try {
    const parsed = JSON.parse(cleaned);
    const axes = parsed.axes;

    if (!axes || typeof axes !== "object") {
      return null;
    }

    const ground = clampAxis(axes.ground);
    const rarity = clampAxis(axes.rarity);
    const execution = clampAxis(axes.execution);
    const distance = clampAxis(axes.distance);
    const literary = clampAxis(axes.literary);

    if ([ground, rarity, execution, distance, literary].some((v) => v === null)) {
      return null;
    }

    const rawScore = Math.min(
      100,
      Math.round(
        (((ground as number) * WEIGHTS.ground +
          (rarity as number) * WEIGHTS.rarity +
          (execution as number) * WEIGHTS.execution +
          (distance as number) * WEIGHTS.distance +
          (literary as number) * WEIGHTS.literary) /
          MAX_TOTAL) *
          100 *
          SCORE_BOOST
      )
    );

    const axesResult = {
      ground: ground as number,
      rarity: rarity as number,
      execution: execution as number,
      distance: distance as number,
      literary: literary as number,
    };

    const score = applyPearlCaps(rawScore, axesResult);

    const axesArr: { name: WeaknessRoot; value: number }[] = [
      { name: "ground", value: axesResult.ground },
      { name: "rarity", value: axesResult.rarity },
      { name: "execution", value: axesResult.execution },
      { name: "distance", value: axesResult.distance },
      { name: "literary", value: axesResult.literary },
    ];

    axesArr.sort((a, b) => a.value - b.value);
    const lowest = axesArr[0];
    const weaknessRoot: WeaknessRoot = lowest.value >= 7 ? "none" : lowest.name;

    return {
      textualGround: String(parsed.textual_ground ?? "").trim(),
      axes: axesResult,
      score,
      claimType: normalizeClaimType(parsed.claim_type),
      reasoning: String(parsed.reasoning ?? "").trim(),
      weaknessRoot,
      weaknessDetail: String(parsed.weakness_detail ?? "").trim(),
    };
  } catch {
    return null;
  }
}

function applyForbiddenMarkerGuard(
  result: ScoreResult,
  pearl: ScorerPearl
): ScoreResult {
  const matchedMarkers = getForbiddenPearlMarkerLabels(pearl);

  if (matchedMarkers.length === 0) {
    return result;
  }

  const weaknessNote =
    `Hard Pearl boundary guard: this card contains forbidden Pearl markers (${matchedMarkers.join(", ")}). This belongs to the future Lexicon lens, not the Pearl lens.`;

  return {
    ...result,
    axes: {
      ...result.axes,
      ground: Math.min(result.axes.ground, 3),
      execution: Math.min(result.axes.execution, 3),
      distance: Math.min(result.axes.distance, 5),
    },
    score: Math.min(result.score, 64),
    claimType: result.claimType === "intertextual" ? "intertextual" : "lexical",
    weaknessRoot: "ground",
    weaknessDetail: result.weaknessDetail
      ? `${result.weaknessDetail}\n\n${weaknessNote}`
      : weaknessNote,
  };
}

function applyPearlCaps(score: number, axes: ScoreResult["axes"]): number {
  let capped = score;

  if (axes.distance <= 3) capped = Math.min(capped, 62);
  else if (axes.distance === 4) capped = Math.min(capped, 68);
  else if (axes.distance === 5) capped = Math.min(capped, 76);

  if (axes.execution <= 2) capped = Math.min(capped, 58);
  else if (axes.execution === 3) capped = Math.min(capped, 66);
  else if (axes.execution === 4) capped = Math.min(capped, 72);

  if (axes.ground <= 2) capped = Math.min(capped, 58);
  else if (axes.ground === 3) capped = Math.min(capped, 64);
  else if (axes.ground === 4) capped = Math.min(capped, 72);

  if (axes.rarity <= 2) capped = Math.min(capped, 62);
  else if (axes.rarity === 3) capped = Math.min(capped, 68);

  return capped;
}

function normalizeClaimType(value: unknown): ClaimType {
  const s = String(value ?? "").trim();

  if (
    s === "structural" ||
    s === "rhetorical" ||
    s === "narrative" ||
    s === "lexical" ||
    s === "intertextual" ||
    s === "theological"
  ) {
    return s;
  }

  return "theological";
}

function clampAxis(value: unknown): number | null {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 1 || n > 10) {
    return null;
  }

  return Math.round(n);
}





