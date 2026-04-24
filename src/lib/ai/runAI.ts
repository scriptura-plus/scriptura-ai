import type { Provider } from "./providers";
import type { Lang } from "../i18n/dictionary";

const MISSING_KEY = (envName: string) =>
  `${envName} is not set on the server. Add it to your environment (e.g. .env.local or your Vercel project settings) and restart.`;

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
};

function systemInstruction(lang: Lang): string {
  const name = LANG_NAME[lang];
  return (
    `You are a biblical scholar assistant. ` +
    `You MUST respond ONLY in ${name}. ` +
    `Do not write a single word in any other language. ` +
    `Every sentence of your response must be in ${name}. ` +
    `This rule overrides everything else.`
  );
}

export async function runAI(
  provider: Provider,
  prompt: string,
  lang: Lang = "en",
  expectJSON = false,
): Promise<string> {
  if (provider === "openai") return runOpenAI(prompt, lang);
  if (provider === "claude") return runClaude(prompt, lang);
  if (provider === "gemini") return runGemini(prompt, lang, expectJSON);
  throw new Error(`Unknown provider: ${provider}`);
}

async function runOpenAI(prompt: string, lang: Lang): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error(MISSING_KEY("OPENAI_API_KEY"));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction(lang) },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return text.trim();
}

async function runClaude(prompt: string, lang: Lang): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error(MISSING_KEY("ANTHROPIC_API_KEY"));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 3000,
      system: systemInstruction(lang),
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude error ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const blocks: Array<{ type?: string; text?: string }> = data?.content ?? [];
  const text = blocks.map((b) => b.text ?? "").join("\n").trim();
  return text;
}

async function runGemini(prompt: string, lang: Lang, expectJSON = false): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error(MISSING_KEY("GEMINI_API_KEY / GOOGLE_API_KEY"));

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  // Append a strict JSON reminder when structured output is expected
  const finalPrompt = expectJSON
    ? prompt +
      "\n\nCRITICAL: Return ONLY valid JSON. No markdown. No code fences. " +
      "No explanation before or after. The first character must be { or [. The last character must be } or ]."
    : prompt;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    maxOutputTokens: 3000,
    // NOTE: responseMimeType "application/json" is intentionally NOT used here.
    // Gemini 2.5-flash in JSON mode with complex multi-step prompts often returns
    // empty parts. We rely on the CRITICAL prompt suffix + fence stripping instead.
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction(lang) }] },
      contents: [{ parts: [{ text: finalPrompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();

  // Log full response shape for debugging
  const finishReason = data?.candidates?.[0]?.finishReason;
  const blockReason = data?.promptFeedback?.blockReason;
  if (finishReason && finishReason !== "STOP") {
    console.error("[Gemini] Non-STOP finishReason:", finishReason, "blockReason:", blockReason);
  }

  // Filter out Gemini 2.5 thinking parts (thought:true) — only keep actual output parts
  const parts: Array<{ text?: string; thought?: boolean }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  let text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();

  if (!text) {
    console.error("[Gemini] Empty text. finishReason:", finishReason,
      "blockReason:", blockReason,
      "candidates:", JSON.stringify(data?.candidates?.slice(0, 1)).slice(0, 400));
  }

  // Strip any markdown fences Gemini may still include
  if (expectJSON) {
    text = text
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .trim();
    if (text && text[0] !== "{" && text[0] !== "[") {
      console.error("[Gemini] Expected JSON, unexpected start char:", JSON.stringify(text[0]),
        "preview:", text.slice(0, 300));
    }
  }

  return text;
}
