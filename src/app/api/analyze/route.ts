import { NextResponse } from "next/server";
import { runAI } from "@/lib/ai/runAI";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import {
  buildLensPrompt,
  type LensId,
  LENS_ORDER,
} from "@/lib/prompts/buildLensPrompt";
import {
  buildExtraPrompt,
  type ExtraId,
  EXTRA_ORDER,
} from "@/lib/prompts/buildExtraPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "ru" | "es";
const isLang = (v: unknown): v is Lang => v === "en" || v === "ru" || v === "es";
const isLensId = (v: unknown): v is LensId =>
  typeof v === "string" && (LENS_ORDER as string[]).includes(v);
const isExtraId = (v: unknown): v is ExtraId =>
  typeof v === "string" && (EXTRA_ORDER as string[]).includes(v);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const kind = body?.kind;
    const id = body?.id;
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    const verseText = typeof body?.verseText === "string" ? body.verseText.trim() : "";
    const lang: Lang = isLang(body?.lang) ? body.lang : "en";
    const provider = isProvider(body?.provider) ? body.provider : defaultProvider();

    if (!reference || !verseText) {
      return NextResponse.json(
        { error: "reference and verseText are required" },
        { status: 400 },
      );
    }

    let prompt: string;
    if (kind === "lens" && isLensId(id)) {
      prompt = buildLensPrompt({ lens: id, reference, verseText, lang });
    } else if (kind === "extra" && isExtraId(id)) {
      prompt = buildExtraPrompt({ id, reference, verseText, lang });
    } else {
      return NextResponse.json(
        { error: "kind must be 'lens' or 'extra' with a valid id" },
        { status: 400 },
      );
    }

    // Pass lang to runAI so it can enforce the language at the system-prompt level
    const text = await runAI(provider, prompt, lang);
    return NextResponse.json({ text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
