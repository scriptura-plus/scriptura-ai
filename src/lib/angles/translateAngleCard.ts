import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider, type Provider } from "@/lib/ai/providers";

export type AngleCardLang = "ru" | "en" | "es";

export type TranslatableAngleCard = {
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
};

export type TranslatedAngleCard = {
  lang: AngleCardLang;
  title: string;
  anchor: string | null;
  teaser: string;
  why_it_matters: string | null;
};

const TARGET_LANGS: AngleCardLang[] = ["ru", "en", "es"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): unknown {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }

    throw new Error("AI returned non-JSON translation response");
  }
}

function languageName(lang: AngleCardLang): string {
  if (lang === "ru") return "Russian";
  if (lang === "en") return "English";
  return "Spanish";
}

function chooseTranslationProvider(provider?: Provider): Provider {
  if (provider && isProvider(provider)) {
    return provider;
  }

  const envProvider = process.env.ANGLE_TRANSLATION_PROVIDER;

  if (isProvider(envProvider)) {
    return envProvider;
  }

  const fallback = defaultProvider();

  if (fallback !== "openai") {
    return fallback;
  }

  return "gemini";
}

function buildSingleTranslationPrompt(args: {
  reference: string;
  originLang: AngleCardLang;
  targetLang: AngleCardLang;
  card: TranslatableAngleCard;
}): string {
  return `
You are translating one approved Scriptura AI insight card.

The card has already passed editorial evaluation.
Your task is NOT to create a new angle.
Your task is to preserve the same idea, same textual anchor, same discovery, and same caution.

Target language: ${languageName(args.targetLang)}
Target language code: ${args.targetLang}

Return ONLY valid JSON.

Reference:
${args.reference}

Original language code:
${args.originLang}

Original approved card:
${JSON.stringify(args.card, null, 2)}

Requirements:
- The output MUST be written in ${languageName(args.targetLang)}.
- Do not leave the output in the original language unless the target language is the same as the original language.
- Do not invent new details.
- Do not add new claims.
- Keep the card concise and suitable for a short insight card.
- "anchor" should remain a textual support phrase. Translate it naturally if needed.
- If a Hebrew/Greek word or proper name is central, preserve it when appropriate.
- "why_it_matters" must be practical and concise, not preachy.
- If the target language is the original language, polish lightly but do not change the meaning.

JSON shape:
{
  "title": "...",
  "anchor": "...",
  "teaser": "...",
  "why_it_matters": "..."
}
`.trim();
}

function normalizeSingleTranslatedCard(
  value: unknown,
  lang: AngleCardLang,
): TranslatedAngleCard {
  if (!isRecord(value)) {
    throw new Error(`Translation for ${lang} is not an object`);
  }

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) {
    throw new Error(`Translation for ${lang} is missing title or teaser`);
  }

  return {
    lang,
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters: getString(value.why_it_matters),
  };
}

async function translateOneLanguage(args: {
  reference: string;
  originLang: AngleCardLang;
  targetLang: AngleCardLang;
  card: TranslatableAngleCard;
  provider: Provider;
}): Promise<TranslatedAngleCard> {
  const prompt = buildSingleTranslationPrompt({
    reference: args.reference,
    originLang: args.originLang,
    targetLang: args.targetLang,
    card: args.card,
  });

  const text = await runAI(args.provider, prompt, args.targetLang, true);
  const parsed = extractJsonObject(text);

  return normalizeSingleTranslatedCard(parsed, args.targetLang);
}

export async function translateAngleCard(args: {
  reference: string;
  originLang: AngleCardLang;
  provider?: Provider;
  card: TranslatableAngleCard;
}): Promise<{
  ok: boolean;
  cards: TranslatedAngleCard[];
  error: string | null;
  raw?: unknown;
}> {
  try {
    const provider = chooseTranslationProvider(args.provider);
    const cards: TranslatedAngleCard[] = [];

    for (const targetLang of TARGET_LANGS) {
      const translated = await translateOneLanguage({
        reference: args.reference,
        originLang: args.originLang,
        targetLang,
        card: args.card,
        provider,
      });

      cards.push(translated);
    }

    return {
      ok: true,
      cards,
      error: null,
      raw: {
        provider,
        cards,
      },
    };
  } catch (error) {
    return {
      ok: false,
      cards: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to translate angle card",
    };
  }
}
