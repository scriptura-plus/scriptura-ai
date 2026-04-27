import { createAdminClient } from "@/lib/supabase/server";

export type ResearchArticle = {
  id: string;
  reference: string;
  canonical_ref: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lang: string;
  provider: string;
  model: string | null;
  article_type: string;
  title: string;
  raw_text: string;
  raw_json: unknown | null;
  status: "active" | "hidden";
  extraction_status: "pending" | "processing" | "extracted" | "failed";
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function getResearchArticle(args: {
  reference: string;
  lang: string;
  provider: string;
  articleType: string;
}): Promise<ResearchArticle | null> {
  const client = createAdminClient();

  if (!client) {
    console.error("[RESEARCH_ARTICLES] admin client unavailable for read");
    return null;
  }

  const { data, error } = await client
    .from("research_articles")
    .select("*")
    .eq("reference", args.reference)
    .eq("lang", args.lang)
    .eq("provider", args.provider)
    .eq("article_type", args.articleType)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[RESEARCH_ARTICLES] read error", {
      reference: args.reference,
      lang: args.lang,
      provider: args.provider,
      articleType: args.articleType,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  if (!data) {
    console.log("[RESEARCH_ARTICLES] miss", {
      reference: args.reference,
      lang: args.lang,
      provider: args.provider,
      articleType: args.articleType,
    });
    return null;
  }

  console.log("[RESEARCH_ARTICLES] hit", {
    reference: args.reference,
    lang: args.lang,
    provider: args.provider,
    articleType: args.articleType,
    id: data.id,
  });

  return data as ResearchArticle;
}

export async function saveResearchArticle(args: {
  reference: string;
  canonicalRef: string | null;
  book: string;
  chapter: number;
  verse: number;
  lang: string;
  provider: string;
  model: string;
  articleType: string;
  title: string;
  rawText: string;
  rawJson: unknown | null;
}): Promise<ResearchArticle | null> {
  const client = createAdminClient();

  if (!client) {
    console.error("[RESEARCH_ARTICLES] admin client unavailable for save");
    return null;
  }

  const { data, error } = await client
    .from("research_articles")
    .upsert(
      {
        reference: args.reference,
        canonical_ref: args.canonicalRef,
        book: args.book,
        chapter: args.chapter,
        verse: args.verse,
        lang: args.lang,
        provider: args.provider,
        model: args.model,
        article_type: args.articleType,
        title: args.title,
        raw_text: args.rawText,
        raw_json: args.rawJson,
        status: "active",
        extraction_status: "pending",
        extraction_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "reference,lang,provider,article_type",
      },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[RESEARCH_ARTICLES] save error", {
      reference: args.reference,
      lang: args.lang,
      provider: args.provider,
      articleType: args.articleType,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  console.log("[RESEARCH_ARTICLES] saved", {
    reference: args.reference,
    lang: args.lang,
    provider: args.provider,
    articleType: args.articleType,
    id: data.id,
  });

  return data as ResearchArticle;
}

export async function updateResearchArticleExtractionStatus(args: {
  articleId: string;
  status: "pending" | "processing" | "extracted" | "failed";
  error?: string | null;
}): Promise<boolean> {
  const client = createAdminClient();

  if (!client) {
    console.error("[RESEARCH_ARTICLES] admin client unavailable for status update");
    return false;
  }

  const { error } = await client
    .from("research_articles")
    .update({
      extraction_status: args.status,
      extraction_error: args.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.articleId);

  if (error) {
    console.error("[RESEARCH_ARTICLES] status update error", {
      articleId: args.articleId,
      status: args.status,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return false;
  }

  console.log("[RESEARCH_ARTICLES] status updated", {
    articleId: args.articleId,
    status: args.status,
  });

  return true;
}
