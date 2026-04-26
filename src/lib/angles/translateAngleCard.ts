import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";

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

function normalizeTranslatedCard(
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

function buildTranslationPrompt(args: {
  reference: string;
  originLang: AngleCardLang;
  card: TranslatableAngleCard;
}): string {
  return `
You are translating one approved Scriptura AI insight card into Russian, English, and Spanish.

The insight has already passed editorial evaluation. Your task is NOT to create new angles.
Preserve the same idea, same textual anchor, same discovery, same level of caution.

Return ONLY valid JSON.

Reference:
${args.reference}

Original language:
${args.originLang}

Original approved card:
${JSON.stringify(args.card, null, 2)}

Requirements:
- Translate the same card into ru, en, es.
- Do not invent new details.
- Do not add new claims.
- Keep the card concise and suitable for a short insight card.
- "anchor" should remain a textual support phrase. Translate it naturally if needed.
- If a Hebrew/Greek word or proper name is central, preserve it when appropriate.
- "why_it_matters" must be practical and concise, not preachy.
- If the original language is already one of ru/en/es, still include that language in the output, polished but not changed in meaning.

JSON shape:
{
  "ru": {
    "title": "...",
    "anchor": "...",
    "teaser": "...",
    "why_it_matters": "..."
  },
  "en": {
    "title": "...",
    "anchor": "...",
    "teaser": "...",
    "why_it_matters": "..."
  },
  "es": {
    "title": "...",
    "anchor": "...",
    "teaser": "...",
    "why_it_matters": "..."
  }
}
`.trim();
}

export async function translateAngleCard(args: {
  reference: string;
  originLang: AngleCardLang;
  card: TranslatableAngleCard;
}): Promise<{
  ok: boolean;
  cards: TranslatedAngleCard[];
  error: string | null;
  raw?: unknown;
}> {
  try {
    const provider = isProvider("openai") ? "openai" : defaultProvider();

    const prompt = buildTranslationPrompt({
      reference: args.reference,
      originLang: args.originLang,
      card: args.card,
    });

    const text = await runAI(provider, prompt, args.originLang, true);
    const parsed = extractJsonObject(text);

    if (!isRecord(parsed)) {
      throw new Error("Translation response is not a JSON object");
    }

    const cards = TARGET_LANGS.map((lang) =>
      normalizeTranslatedCard(parsed[lang], lang),
    );

    return {
      ok: true,
      cards,
      error: null,
      raw: parsed,
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
