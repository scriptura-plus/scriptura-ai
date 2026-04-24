import { NextResponse } from "next/server";
import { getVerseText } from "@/lib/bible/getVerseText";
import { isProvider, defaultProvider } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "ru" | "es";
const isLang = (v: unknown): v is Lang => v === "en" || v === "ru" || v === "es";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    if (!reference) {
      return NextResponse.json({ error: "reference is required" }, { status: 400 });
    }
    const lang: Lang = isLang(body?.lang) ? body.lang : "en";
    const provider = isProvider(body?.provider) ? body.provider : defaultProvider();

    const result = await getVerseText(reference, lang, provider);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load verse";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
