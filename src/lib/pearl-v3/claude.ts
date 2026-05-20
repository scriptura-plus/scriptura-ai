import "server-only";

const MISSING_KEY =
  "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local or Vercel project settings and restart.";

export const PEARL_V3_MODEL =
  process.env.PEARL_V3_ANTHROPIC_MODEL?.trim() ||
  process.env.ANTHROPIC_PEARL_V3_MODEL?.trim() ||
  "claude-sonnet-4-6";

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1500, 4000, 8000];

type ClaudeTextBlock = {
  type?: string;
  text?: string;
};

export type PearlClaudeOptions = {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
};

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

  return `Claude error ${status}: ${body.slice(0, 500)}`;
}

export async function callPearlClaude(opts: PearlClaudeOptions): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error(MISSING_KEY);

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: PEARL_V3_MODEL,
          max_tokens: opts.maxTokens,
          system: opts.system,
          messages: [{ role: "user", content: opts.user }],
          ...(typeof opts.temperature === "number"
            ? { temperature: opts.temperature }
            : {}),
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.warn("[PEARL_V3_CLAUDE] network request failed", {
        model: PEARL_V3_MODEL,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        message,
      });

      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`Claude network error: ${message}`);
      }

      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 8000);
      continue;
    }

    if (response.ok) {
      const data = await response.json();
      const blocks = (data?.content ?? []) as ClaudeTextBlock[];
      const text = blocks.map((block) => block.text ?? "").join("\n").trim();

      if (!text) {
        console.warn("[PEARL_V3_CLAUDE] empty response", {
          model: PEARL_V3_MODEL,
          attempt,
        });
      }

      return text;
    }

    const body = await response.text();
    lastStatus = response.status;
    lastBody = body;

    const retryable = RETRYABLE_STATUSES.has(response.status);
    const retryAfterMs = getRetryAfterMs(response.headers);
    const delayMs = retryAfterMs ?? RETRY_DELAYS_MS[attempt - 1] ?? 8000;

    console.error("[PEARL_V3_CLAUDE] API error", {
      model: PEARL_V3_MODEL,
      status: response.status,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      retryable,
      retryAfterMs,
      nextDelayMs: retryable && attempt < MAX_ATTEMPTS ? delayMs : null,
      preview: body.slice(0, 500),
    });

    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(getClaudeUserMessage(response.status, body));
    }

    await sleep(delayMs);
  }

  throw new Error(getClaudeUserMessage(lastStatus, lastBody));
}

