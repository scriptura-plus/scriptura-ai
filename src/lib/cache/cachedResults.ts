import { createAdminClient } from "@/lib/supabase/server";

export const PROMPT_VERSIONS: Record<string, string> = {
  angles: "angles_v1",
  word: "word_v1",
  context: "context_v1",
  translations: "translations_v1",
};

export type CachedResult = {
  id: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lens: string;
  lang: string;
  provider: string;
  model: string;
  prompt_version: string;
  raw_json: unknown;
  status: "active" | "hidden";
  created_at: string;
  updated_at: string;
};

export async function getCachedResult(
  reference: string,
  lens: string,
  lang: string,
): Promise<CachedResult | null> {
  const client = createAdminClient();

  if (!client) {
    console.error("[CACHE] admin client unavailable for read");
    return null;
  }

  const { data, error } = await client
    .from("cached_results")
    .select("*")
    .eq("reference", reference)
    .eq("lens", lens)
    .eq("lang", lang)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[CACHE] read error", {
      reference,
      lens,
      lang,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  if (!data) {
    console.log("[CACHE] miss", { reference, lens, lang });
    return null;
  }

  console.log("[CACHE] hit", { reference, lens, lang, id: data.id });

  return data as CachedResult;
}

export async function saveCachedResult(args: {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  lens: string;
  lang: string;
  provider: string;
  model: string;
  raw_json: unknown;
}): Promise<boolean> {
  const client = createAdminClient();

  if (!client) {
    console.error("[CACHE] admin client unavailable for save");
    return false;
  }

  const prompt_version = PROMPT_VERSIONS[args.lens] ?? "v1";

  const { error } = await client.from("cached_results").upsert(
    {
      reference: args.reference,
      book: args.book,
      chapter: args.chapter,
      verse: args.verse,
      lens: args.lens,
      lang: args.lang,
      provider: args.provider,
      model: args.model,
      prompt_version,
      raw_json: args.raw_json,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "reference,lens,lang",
    },
  );

  if (error) {
    console.error("[CACHE] save error", {
      reference: args.reference,
      lens: args.lens,
      lang: args.lang,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return false;
  }

  console.log("[CACHE] saved", {
    reference: args.reference,
    lens: args.lens,
    lang: args.lang,
  });

  return true;
}
