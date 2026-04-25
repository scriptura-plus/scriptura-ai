import { isProvider, defaultProvider } from "@/lib/ai/providers";
import { buildExpandPrompt } from "@/lib/prompts/buildExpandPrompt";
import { runAI } from "@/lib/ai/runAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "ru" | "es";
const isLang = (v: unknown): v is Lang => v === "en" || v === "ru" || v === "es";

const LANG_NAME: Record<Lang, string> = { en: "English", ru: "Russian", es: "Spanish" };

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

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const angleTitle = typeof body?.angleTitle === "string" ? body.angleTitle.trim() : "";
  const anchor = typeof body?.anchor === "string" ? body.anchor.trim() : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const verseText = typeof body?.verseText === "string" ? body.verseText.trim() : "";
  const lang: Lang = isLang(body?.lang) ? body.lang : "en";
  const provider = isProvider(body?.provider) ? body.provider : defaultProvider();

  if (!reference || !verseText || !angleTitle) {
    return jsonError("reference, verseText, and angleTitle are required", 400);
  }

  const prompt = buildExpandPrompt({ angleTitle, anchor, reference, verseText, lang });

  // OpenAI: stream text deltas directly from Responses API
  if (provider === "openai") {
    return streamOpenAI(prompt, lang);
  }

  // Claude / Gemini: non-streaming — call runAI, return full text as plain text
  try {
    const text = await runAI(provider, prompt, lang, false);
    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Expansion failed";
    return jsonError(message, 500);
  }
}

async function streamOpenAI(prompt: string, lang: Lang): Promise<Response> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return jsonError("OPENAI_API_KEY is not set", 500);

  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  let upstream: globalThis.Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemInstruction(lang),
        input: prompt,
        stream: true,
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "OpenAI fetch failed";
    return jsonError(msg, 502);
  }

  if (!upstream.ok) {
    const body = await upstream.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    const err = (parsed.error ?? {}) as Record<string, unknown>;
    console.error("[OpenAI expand] stream error:", {
      model, status: upstream.status,
      message: err.message, param: err.param, code: err.code,
    });
    return jsonError(`OpenAI error ${upstream.status}: ${String(err.message ?? body.slice(0, 200))}`, 502);
  }

  if (!upstream.body) return jsonError("OpenAI returned no body", 502);

  // Transform OpenAI SSE → plain UTF-8 text stream
  const encoder = new TextEncoder();
  const upstreamBody = upstream.body;

  const outStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload) as { type?: string; delta?: string };
              if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
                controller.enqueue(encoder.encode(evt.delta));
              }
            } catch { /* skip malformed SSE event */ }
          }
        }
        // flush any remaining buffer
        if (buffer) {
          const line = buffer.startsWith("data: ") ? buffer.slice(6).trim() : "";
          if (line && line !== "[DONE]") {
            try {
              const evt = JSON.parse(line) as { type?: string; delta?: string };
              if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
                controller.enqueue(encoder.encode(evt.delta));
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        console.error("[OpenAI expand] stream read error:", err);
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(outStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
