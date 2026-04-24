export type Provider = "openai" | "claude" | "gemini";

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];

export function isProvider(v: unknown): v is Provider {
  return v === "openai" || v === "claude" || v === "gemini";
}

export function defaultProvider(): Provider {
  const env = process.env.DEFAULT_AI_PROVIDER;
  if (isProvider(env)) return env;
  return "openai";
}
