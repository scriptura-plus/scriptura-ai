import { createAdminClient, createPublicClient } from "@/lib/supabase/server";

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

// Read from cache — public client, respects RLS.
export async function getCachedResult(
  reference: string,
  lens: string,
  lang: string,
): Promise<CachedResult | null> {
  const client = createPublicClient();
  if (!client) return null;

  const { data, error } = await client
    .from("cached_results")
    .select("*")
    .eq("reference", reference)
    .eq("lens", lens)
    .eq("lang", lang)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data as CachedResult;
}

// Write to cache — admin client, bypasses RLS.
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
}): Promise<void> {
  const client = createAdminClient();
  if (!client) return;

  const prompt_version = PROMPT_VERSIONS[args.lens] ?? "v1";

  await client.from("cached_results").upsert(
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
}
