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

type SupabaseAdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function getSourceKind(articleType: string): string {
  if (articleType === "text_findings") return "research_article";
  if (articleType === "historical_scene") return "research_article";
  if (articleType === "scripture_links") return "research_article";
  if (articleType === "context") return "research_article";
  if (articleType === "word") return "research_article";
  if (articleType === "translations") return "research_article";

  return "research_article";
}

async function syncResearchArticleToLake(
  client: SupabaseAdminClient,
  article: ResearchArticle,
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const lakePayload = {
      reference: article.reference,
      canonical_ref: article.canonical_ref,
      book_key: article.book,
      book: article.book,
      chapter: article.chapter,
      verse: article.verse,
      lang: article.lang,

      source_kind: getSourceKind(article.article_type),
      source_type: article.article_type,
      source_provider: article.provider,
      source_model: article.model,
      source_title: article.title,

      legacy_table: "research_articles",
      legacy_id: article.id,

      title: article.title,
      raw_text: article.raw_text,
      raw_json: article.raw_json,
      content_json: article.raw_json,

      prompt_version: null,
      status: article.status,
      extraction_status: article.extraction_status,
      extraction_error: article.extraction_error,
      extracted_at:
        article.extraction_status === "extracted" ? now : null,

      updated_at: now,
    };

    const { data: existing, error: existingError } = await client
      .from("research_sources")
      .select("id")
      .eq("legacy_table", "research_articles")
      .eq("legacy_id", article.id)
      .maybeSingle();

    if (existingError) {
      console.error("[RESEARCH_LAKE] source lookup error", {
        articleId: article.id,
        reference: article.reference,
        message: existingError.message,
        details: existingError.details,
        hint: existingError.hint,
        code: existingError.code,
      });
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await client
        .from("research_sources")
        .update(lakePayload)
        .eq("id", existing.id);

      if (updateError) {
        console.error("[RESEARCH_LAKE] source update error", {
          articleId: article.id,
          sourceId: existing.id,
          reference: article.reference,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
      }

      return;
    }

    const { error: insertError } = await client
      .from("research_sources")
      .insert({
        ...lakePayload,
        created_at: article.created_at ?? now,
      });

    if (insertError) {
      console.error("[RESEARCH_LAKE] source insert error", {
        articleId: article.id,
        reference: article.reference,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
    }
  } catch (error) {
    console.error("[RESEARCH_LAKE] source sync unexpected error", {
      articleId: article.id,
      reference: article.reference,
      error,
    });
  }
}

async function syncResearchArticleStatusToLake(args: {
  client: SupabaseAdminClient;
  articleId: string;
  status: "pending" | "processing" | "extracted" | "failed";
  error?: string | null;
}): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { error } = await args.client
      .from("research_sources")
      .update({
        extraction_status: args.status,
        extraction_error: args.error ?? null,
        extracted_at: args.status === "extracted" ? now : null,
        updated_at: now,
      })
      .eq("legacy_table", "research_articles")
      .eq("legacy_id", args.articleId);

    if (error) {
      console.error("[RESEARCH_LAKE] source status update error", {
        articleId: args.articleId,
        status: args.status,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
  } catch (error) {
    console.error("[RESEARCH_LAKE] source status unexpected error", {
      articleId: args.articleId,
      status: args.status,
      error,
    });
  }
}

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

  const article = data as ResearchArticle;

  await syncResearchArticleToLake(client, article);

  return article;
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

  await syncResearchArticleStatusToLake({
    client,
    articleId: args.articleId,
    status: args.status,
    error: args.error ?? null,
  });

  return true;
}
