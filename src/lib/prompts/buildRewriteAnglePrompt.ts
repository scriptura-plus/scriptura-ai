type Lang = "en" | "ru" | "es";

export type RewriteAngleCard = {
  id?: string;
  title: string;
  anchor?: string;
  teaser?: string;
  why_it_matters?: string;
  body?: string;
};

export type RewriteAngleEvaluation = {
  angle_summary?: string;
  coverage_type?: string;
  score_total?: number;
  placement?: string;
  reason?: string;
  risk?: string | null;
  rewrite_instruction?: string | null;
};

export type BuildRewriteAnglePromptArgs = {
  reference: string;
  verseText: string;
  lang: Lang;
  candidate: RewriteAngleCard;
  evaluation: RewriteAngleEvaluation;
  sourceArticle?: string;
};

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function languageName(lang: Lang): string {
  if (lang === "ru") return "Russian";
  if (lang === "es") return "Spanish";
  return "English";
}

export function buildRewriteAnglePrompt({
  reference,
  verseText,
  lang,
  candidate,
  evaluation,
  sourceArticle,
}: BuildRewriteAnglePromptArgs): string {
  const outputLanguage = languageName(lang);

  return `
You are the senior rewrite editor for Scriptura AI.

Your task is to rewrite ONE insight card after editorial evaluation.

The goal is not to make it longer.
The goal is to make it sharper, safer, clearer, and more text-grounded.

The content language is ${outputLanguage}.
JSON keys must remain in English.
JSON string values should be in ${outputLanguage}.

VERSE:
Reference: ${reference}

Verse text:
${verseText}

ORIGINAL CANDIDATE CARD:
${prettyJson(candidate)}

EDITORIAL EVALUATION:
${prettyJson(evaluation)}

SOURCE ARTICLE OR MATERIAL, IF ANY:
${sourceArticle ? sourceArticle : "None provided."}

REWRITE GOAL

Preserve the same meaningful angle.
Do not invent a new angle.
Do not add claims that are not supported by the verse, immediate context, or supplied material.
Improve the card according to the evaluator's rewrite_instruction, reason, and risk.

A good rewritten card:
- has a sharper title
- has a concrete textual anchor
- explains the observation clearly
- avoids overclaiming
- avoids sermon tone
- avoids moral appeal endings
- avoids question endings
- avoids vague words like “important”, “deep”, “powerful” unless they are explained
- can be retold in about one minute
- feels like a premium editorial insight, not a generic devotional comment

ORIGINAL-LANGUAGE CAUTION

If Greek/Hebrew is involved:
- do not say “this word means X” unless that is precise
- prefer careful wording such as “belongs to the semantic field of...”
- distinguish literal wording, semantic field, and interpretive implication
- do not turn a possible nuance into a guaranteed doctrine

STYLE

No markdown tables.
No numbered list.
No motivational ending.
No question ending.
No “what can we learn” phrasing.
No “this teaches us that...” phrasing.

Return a compact card, not an article.

OUTPUT FORMAT

Return ONLY valid JSON.
No markdown.
No code fences.
No explanation before or after JSON.
The first character must be {.
The last character must be }.

JSON schema:

{
  "card": {
    "title": "string",
    "anchor": "string",
    "teaser": "string",
    "why_it_matters": "string"
  },
  "rewrite_notes": "string"
}

FIELD RULES

title:
- short, memorable, editorial
- not sensational
- not misleading

anchor:
- exact word/phrase/detail the card depends on
- if the card relies on Greek/Hebrew behind a translation, make that explicit but brief

teaser:
- 2 to 4 sentences
- claim → textual evidence → meaning shift
- no long article-style development

why_it_matters:
- 1 to 2 sentences
- explain how the detail changes the reading of the verse
- no moral appeal
- no question ending

rewrite_notes:
- briefly say what was improved
`.trim();
}
