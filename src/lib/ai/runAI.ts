import type { Provider } from "./providers";

const MISSING_KEY = (envName: string) =>
  `${envName} is not set on the server. Add it to your environment (e.g. .env.local or your Vercel project settings) and restart.`;

export async function runAI(provider: Provider, prompt: string): Promise<string> {
  if (provider === "openai") return runOpenAI(prompt);
  if (provider === "claude") return runClaude(prompt);
  if (provider === "gemini") return runGemini(prompt);
  throw new Error(`Unknown provider: ${provider}`);
}

async function runOpenAI(prompt: string): Promise<string> {
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
      messages: [{ role: "user", content: prompt }],
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

async function runClaude(prompt: string): Promise<string> {
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
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1500,
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

async function runGemini(prompt: string): Promise<string> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error(MISSING_KEY("GOOGLE_API_KEY"));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  return text;
}
