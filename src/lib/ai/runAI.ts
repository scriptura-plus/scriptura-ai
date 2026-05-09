import type { Provider } from "./providers";
import type { Lang } from "../i18n/dictionary";

const MISSING_KEY = (envName: string) =>
  `${envName} is not set on the server. Add it to your environment (e.g. .env.local or your Vercel project settings) and restart.`;

// Cost-control defaults.
// These defaults are used only if the matching Vercel env variable is missing.
// For quality experiments, explicitly set OPENAI_MODEL=gpt-5.5 in Vercel.
const SAFE_OPENAI_MODEL = "gpt-5.4-mini";
const SAFE_CLAUDE_MODEL = "claude-sonnet-4-6";
const SAFE_GEMINI_MODEL = "gemini-2.5-flash";

const CLAUDE_RETRYABLE_STATUSES = new Set([500, 502, 503, 504, 529]);
const CLAUDE_MAX_ATTEMPTS = 4;
const CLAUDE_RETRY_DELAYS_MS = [1500, 4000, 8000];

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
};

function systemInstruction(lang: Lang, expectJSON = false): string {
  const name = LANG_NAME[lang];

  if (expectJSON) {
    return (
      `You are a biblical scholar assistant. ` +
      `You MUST return valid JSON only. ` +
      `Do not use markdown. Do not use code fences. Do not add prose before or after the JSON. ` +
      `JSON key names may remain in English when the user prompt requires English keys. ` +
      `Any natural-language JSON string values intended for the user MUST be in ${name}.`
    );
  }

  return (
    `You are a biblical scholar assistant. ` +
    `You MUST respond ONLY in ${name}. ` +
    `Do not write a single word in any other language. ` +
    `Every sentence of your response must be in ${name}. ` +
    `This rule overrides everything else.`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 15000);
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    const delay = dateMs - Date.now();
    if (delay > 0) return Math.min(delay, 15000);
  }

  return null;
}

function getClaudeUserMessage(status: number, body: string): string {
  if (status === 529) {
    return "Claude is temporarily overloaded. Please try again in a moment.";
  }

  return `Claude error ${status}: ${body.slice(0, 400)}`;
}

export function resolveAIModel(provider: Provider): string {
  if (provider === "openai") {
    const envModel = process.env.OPENAI_MODEL?.trim();

    if (!envModel) return SAFE_OPENAI_MODEL;

    return envModel;
  }

  if (provider === "claude") {
    return process.env.ANTHROPIC_MODEL?.trim() || SAFE_CLAUDE_MODEL;
  }

  if (provider === "gemini") {
    return process.env.GEMINI_MODEL?.trim() || SAFE_GEMINI_MODEL;
  }

  return provider;
}

export async function runAI(
  provider: Provider,
  prompt: string,
  lang: Lang = "en",
  expectJSON = false,
): Promise<string> {
  if (provider === "openai") return runOpenAI(prompt, lang, expectJSON);
  if (provider === "claude") return runClaude(prompt, lang);
  if (provider === "gemini") return runGemini(prompt, lang, expectJSON);

  throw new Error(`Unknown provider: ${provider}`);
}

async function runOpenAI(
  prompt: string,
  lang: Lang,
  expectJSON = false,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error(MISSING_KEY("OPENAI_API_KEY"));

  const model = resolveAIModel("openai");

  const finalPrompt = expectJSON
    ? prompt +
      "\n\nCRITICAL JSON OUTPUT RULES:\n" +
      "- Return ONLY valid JSON.\n" +
      "- No markdown.\n" +
      "- No code fences.\n" +
      "- No explanation before or after.\n" +
      "- The first character must be { or [.\n" +
      "- The last character must be } or ].\n" +
      "- Keep JSON key names exactly as requested in the prompt."
    : prompt;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemInstruction(lang, expectJSON),
      input: finalPrompt,
      max_output_tokens: expectJSON ? 8000 : 3000,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let parsed: Record<string, unknown> = {};

    try {
      parsed = JSON.parse(errBody);
    } catch {
      // ignore
    }

    const err = (parsed.error ?? {}) as Record<string, unknown>;

    console.error("[OpenAI] API error:", {
      model,
      endpoint: "/v1/responses",
      status: res.status,
      message: err.message,
      param: err.param,
      code: err.code,
      type: err.type,
    });

    throw new Error(`OpenAI error ${res.status}: ${errBody.slice(0, 400)}`);
  }

  const data = await res.json();

  type OutputContent = { type?: string; text?: string };
  type OutputItem = { content?: OutputContent[] };

  let text = ((data?.output ?? []) as OutputItem[])
    .flatMap((item) => item?.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  if (expectJSON) {
    text = text
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    if (text && text[0] !== "{" && text[0] !== "[") {
      console.error("[OpenAI] Expected JSON, unexpected start char:", {
        model,
        start: JSON.stringify(text[0]),
        preview: text.slice(0, 300),
      });
    }
  }

  if (!text) {
    console.error(
      "[OpenAI] Empty response from Responses API. output:",
      JSON.stringify(data?.output).slice(0, 400),
    );
  }

  return text;
}

async function runClaude(prompt: string, lang: Lang): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error(MISSING_KEY("ANTHROPIC_API_KEY"));

  const model = resolveAIModel("claude");
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= CLAUDE_MAX_ATTEMPTS; attempt += 1) {
    let res: Response;

    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          system: systemInstruction(lang),
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.warn("[Claude] network request failed", {
        model,
        endpoint: "/v1/messages",
        attempt,
        maxAttempts: CLAUDE_MAX_ATTEMPTS,
        message,
      });

      if (attempt >= CLAUDE_MAX_ATTEMPTS) {
        throw new Error(`Claude network error: ${message}`);
      }

      await sleep(CLAUDE_RETRY_DELAYS_MS[attempt - 1] ?? 8000);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const blocks: Array<{ type?: string; text?: string }> =
        data?.content ?? [];
      const text = blocks.map((b) => b.text ?? "").join("\n").trim();

      if (attempt > 1) {
        console.log("[Claude] retry succeeded", {
          model,
          endpoint: "/v1/messages",
          attempt,
        });
      }

      return text;
    }

    const body = await res.text();
    lastStatus = res.status;
    lastBody = body;

    const isRetryable = CLAUDE_RETRYABLE_STATUSES.has(res.status);
    const retryAfterMs = getRetryAfterMs(res.headers);
    const defaultDelayMs = CLAUDE_RETRY_DELAYS_MS[attempt - 1] ?? 8000;
    const delayMs = retryAfterMs ?? defaultDelayMs;

    console.error("[Claude] API error:", {
      model,
      endpoint: "/v1/messages",
      status: res.status,
      attempt,
      maxAttempts: CLAUDE_MAX_ATTEMPTS,
      retryable: isRetryable,
      retryAfterMs,
      nextDelayMs: isRetryable && attempt < CLAUDE_MAX_ATTEMPTS ? delayMs : null,
      preview: body.slice(0, 400),
    });

    if (!isRetryable || attempt >= CLAUDE_MAX_ATTEMPTS) {
      throw new Error(getClaudeUserMessage(res.status, body));
    }

    await sleep(delayMs);
  }

  throw new Error(getClaudeUserMessage(lastStatus, lastBody));
}

async function runGemini(
  prompt: string,
  lang: Lang,
  expectJSON = false,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error(MISSING_KEY("GEMINI_API_KEY / GOOGLE_API_KEY"));

  const model = resolveAIModel("gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const finalPrompt = expectJSON
    ? prompt +
      "\n\nCRITICAL: Return ONLY valid JSON. No markdown. No code fences. " +
      "No explanation before or after. The first character must be { or [. The last character must be } or ]."
    : prompt;

  const maxOutputTokens = expectJSON ? 8000 : 3000;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    maxOutputTokens,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction(lang, expectJSON) }] },
      contents: [{ parts: [{ text: finalPrompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();

    console.error("[Gemini] API error:", {
      model,
      endpoint: "generateContent",
      status: res.status,
      preview: body.slice(0, 400),
    });

    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = await res.json();

  const finishReason = data?.candidates?.[0]?.finishReason;
  const blockReason = data?.promptFeedback?.blockReason;

  if (finishReason && finishReason !== "STOP") {
    console.error(
      "[Gemini] Non-STOP finishReason:",
      finishReason,
      "blockReason:",
      blockReason,
    );
  }

  const parts: Array<{ text?: string; thought?: boolean }> =
    data?.candidates?.[0]?.content?.parts ?? [];

  let text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    console.error(
      "[Gemini] Empty text. finishReason:",
      finishReason,
      "blockReason:",
      blockReason,
      "candidates:",
      JSON.stringify(data?.candidates?.slice(0, 1)).slice(0, 400),
    );
  }

  if (expectJSON) {
    text = text
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    if (text && text[0] !== "{" && text[0] !== "[") {
      console.error(
        "[Gemini] Expected JSON, unexpected start char:",
        JSON.stringify(text[0]),
        "preview:",
        text.slice(0, 300),
      );
    }
  }

  return text;
}
