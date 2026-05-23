import { NextResponse } from "next/server";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type InventoryStatus =
  | "ready"
  | "partial"
  | "missing"
  | "legacy_only"
  | "generated_but_not_published";

type DbRow = Record<string, unknown> & {
  id?: string | number | null;
};

type AdminClient = { from: (table: string) => { select: (columns: string) => QueryBuilder; }; };

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  then: PromiseLike<{ data: unknown[] | null; error: DbError | null }>["then"];
};

type DbError = {
  message: string;
  details?: string | null;
  hint?: string | null;
};

const DEEP_ARTICLE_TYPES = [
  "text_findings",
  "historical_scene",
  "scripture_links",
] as const;

type DeepArticleType = (typeof DEEP_ARTICLE_TYPES)[number];

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[VERSE_PUBLIC_INVENTORY] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: string | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowId(row: DbRow): string {
  return String(row.id ?? "");
}

function uniqueRows(rows: DbRow[]): DbRow[] {
  const seen = new Set<string>();
  const result: DbRow[] = [];

  for (const row of rows) {
    const id = rowId(row);

    if (!id) {
      result.push(row);
      continue;
    }

    if (seen.has(id)) continue;

    seen.add(id);
    result.push(row);
  }

  return result;
}

async function selectRows(
  client: AdminClient,
  table: string,
  columns: string,
  applyFilters: (query: QueryBuilder) => QueryBuilder,
): Promise<DbRow[]> {
  const query = applyFilters(client.from(table).select(columns) as QueryBuilder);
  const { data, error } = await query;

  if (error) {
    throw new Error(
      `[${table}] read failed: ${error.message}${
        error.details ? ` Details: ${error.details}` : ""
      }${error.hint ? ` Hint: ${error.hint}` : ""}`,
    );
  }

  return (data ?? []) as DbRow[];
}

async function selectRowsForVerse(args: {
  client: AdminClient;
  table: string;
  columns: string;
  reference: string;
  canonicalRef: string | null;
  lang: Lang;
  hasCanonicalRef: boolean;
}): Promise<DbRow[]> {
  const byReference = await selectRows(
    args.client,
    args.table,
    args.columns,
    (query) => query.eq("reference", args.reference).eq("lang", args.lang),
  );

  if (!args.hasCanonicalRef || !args.canonicalRef) {
    return uniqueRows(byReference);
  }

  const byCanonicalRef = await selectRows(
    args.client,
    args.table,
    args.columns,
    (query) => query.eq("canonical_ref", args.canonicalRef).eq("lang", args.lang),
  );

  return uniqueRows([...byReference, ...byCanonicalRef]);
}

function countByStatus(rows: DbRow[], status: string): number {
  return rows.filter((row) => row.status === status).length;
}

function getObservationsStatus(args: {
  publishedSets: number;
  publishedCards: number;
  angleCardsTotal: number;
  cachedResults: number;
}): InventoryStatus {
  if (args.publishedSets > 0 && args.publishedCards > 0) {
    return "ready";
  }

  if (args.publishedSets > 0 && args.publishedCards === 0) {
    return "partial";
  }

  if (args.angleCardsTotal > 0) {
    return "generated_but_not_published";
  }

  if (args.cachedResults > 0) {
    return "legacy_only";
  }

  return "missing";
}

function getObservationsSource(status: InventoryStatus): string {
  if (status === "ready" || status === "partial") {
    return "published_lens_sets";
  }

  if (status === "generated_but_not_published") {
    return "angle_cards";
  }

  if (status === "legacy_only") {
    return "cached_results";
  }

  return "none";
}

function buildDeepSection(args: {
  label: string;
  articleType: DeepArticleType;
  activeCount: number;
  totalCount: number;
}) {
  const status: InventoryStatus =
    args.activeCount > 0
      ? "ready"
      : args.totalCount > 0
        ? "partial"
        : "missing";

  const notes: string[] = [];

  if (args.totalCount > 0 && args.activeCount === 0) {
    notes.push(
      "Rows exist in research_articles, but no active article was found for this section.",
    );
  }

  if (args.activeCount === 0) {
    notes.push(
      "Opening this public section may call /api/analyze and trigger generation.",
    );
  }

  return {
    label: args.label,
    articleType: args.articleType,
    status,
    counts: {
      researchArticles: args.activeCount,
      researchArticlesTotal: args.totalCount,
    },
    wouldGenerateIfOpenedPublicly: args.activeCount === 0,
    canOpenReadOnly: args.activeCount > 0,
    notes,
  };
}

export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const referenceParam = getString(url.searchParams.get("reference"));
    const langParam = url.searchParams.get("lang");
    const lang: Lang = isLang(langParam) ? langParam : "ru";

    if (!referenceParam) {
      return NextResponse.json(
        { error: "reference is required" },
        { status: 400 },
      );
    }

    const rawClient = createAdminClient();

    if (!rawClient) {
      return NextResponse.json(
        { error: "Supabase admin client unavailable" },
        { status: 500 },
      );
    }

    const client = rawClient as unknown as AdminClient;

    const normalized = normalizeReference(referenceParam);
    const reference = normalized.reference || referenceParam;
    const canonicalRef = normalized.canonical_ref;

    const warnings: string[] = [
      "Read-only inventory endpoint: does not call /api/analyze and does not run AI generation.",
    ];

    const allPublishedSets = await selectRows(
      client,
      "published_lens_sets",
      "id,lens_id,status,canonical_ref,reference_label,lang,created_at,updated_at",
      (query) => {
        let scoped = query.eq("lang", lang);

        if (canonicalRef) {
          scoped = scoped.eq("canonical_ref", canonicalRef);
        } else {
          scoped = scoped.eq("reference_label", reference);
        }

        return scoped;
      },
    );

    const pearlPublishedSets = allPublishedSets.filter(
      (row) => row.lens_id === "pearl" && row.status === "published",
    );

    const allPublishedSetIds = allPublishedSets
      .map((row) => rowId(row))
      .filter(Boolean);

    const pearlPublishedSetIds = pearlPublishedSets
      .map((row) => rowId(row))
      .filter(Boolean);

    const allPublishedCards =
      allPublishedSetIds.length > 0
        ? await selectRows(
            client,
            "published_lens_cards",
            "id,set_id,status,position,created_at,updated_at",
            (query) => query.in("set_id", allPublishedSetIds),
          )
        : [];

    const pearlPublishedCards =
      pearlPublishedSetIds.length > 0
        ? allPublishedCards.filter(
            (row) =>
              pearlPublishedSetIds.includes(String(row.set_id ?? "")) &&
              row.status === "published",
          )
        : [];

    const angleCards = await selectRowsForVerse({
      client,
      table: "angle_cards",
      columns: "id,reference,canonical_ref,lang,status,created_at,updated_at",
      reference,
      canonicalRef,
      lang,
      hasCanonicalRef: true,
    });

    const cachedResults = await selectRowsForVerse({
      client,
      table: "cached_results",
      columns: "id,reference,lens,lang,status,created_at,updated_at",
      reference,
      canonicalRef,
      lang,
      hasCanonicalRef: false,
    });

    const researchArticles = await selectRowsForVerse({
      client,
      table: "research_articles",
      columns:
        "id,reference,canonical_ref,lang,article_type,status,extraction_status,created_at,updated_at",
      reference,
      canonicalRef,
      lang,
      hasCanonicalRef: true,
    });

    const lensDiscoveryCards = await selectRowsForVerse({
      client,
      table: "lens_discovery_cards",
      columns: "id,reference,lens_id,lang,status,created_at,updated_at",
      reference,
      canonicalRef,
      lang,
      hasCanonicalRef: false,
    });

    const researchNotes = await selectRowsForVerse({
      client,
      table: "research_notes",
      columns: "id,reference,canonical_ref,lang,status,created_at,updated_at",
      reference,
      canonicalRef,
      lang,
      hasCanonicalRef: true,
    });

    const observationsCachedResults = cachedResults.filter(
      (row) => row.lens === "angles" && row.status === "active",
    );

    const angleCardsFeatured = countByStatus(angleCards, "featured");
    const angleCardsReserve = countByStatus(angleCards, "reserve");
    const angleCardsTotal = angleCards.length;

    const observationsStatus = getObservationsStatus({
      publishedSets: pearlPublishedSets.length,
      publishedCards: pearlPublishedCards.length,
      angleCardsTotal,
      cachedResults: observationsCachedResults.length,
    });

    const observationsNotes: string[] = [];

    if (
      observationsStatus === "generated_but_not_published" &&
      pearlPublishedCards.length === 0
    ) {
      observationsNotes.push(
        "Angle cards exist in angle_cards, but no published pearl set/cards were found.",
      );
    }

    if (observationsStatus === "legacy_only") {
      observationsNotes.push(
        "Only legacy cached_results rows were found for observations.",
      );
      warnings.push(
        "Observations are legacy_only: found cached_results for angles but no published pearl cards.",
      );
    }

    if (observationsStatus === "missing") {
      observationsNotes.push(
        "No published pearl cards, angle_cards, or active cached_results for angles were found.",
      );
      warnings.push(
        "Observations are missing: opening public observations may call /api/analyze and trigger Pearl generation.",
      );
    }

    if (observationsStatus === "partial") {
      observationsNotes.push(
        "A published pearl set exists, but no published cards were found in published_lens_cards.",
      );
      warnings.push(
        "Observations are partial: published_lens_sets has a pearl set, but no published pearl cards were found.",
      );
    }

    const deepRowsByType: Record<
      DeepArticleType,
      { active: number; total: number }
    > = {
      text_findings: { active: 0, total: 0 },
      historical_scene: { active: 0, total: 0 },
      scripture_links: { active: 0, total: 0 },
    };

    for (const articleType of DEEP_ARTICLE_TYPES) {
      const rows = researchArticles.filter(
        (row) => row.article_type === articleType,
      );

      deepRowsByType[articleType] = {
        total: rows.length,
        active: rows.filter((row) => row.status === "active").length,
      };

      if (rows.filter((row) => row.status === "active").length === 0) {
        warnings.push(
          `${articleType} is missing: opening this public deep section may call /api/analyze and trigger generation.`,
        );
      }
    }

    warnings.push(
      "TODO: research_notes are counted only; full details are not implemented in MVP step 2.",
    );

    return NextResponse.json({
      ok: true,
      mode: "read_only",
      generated: false,
      reference,
      canonical_ref: canonicalRef,
      lang,
      sections: {
        observations: {
          key: "observations",
          label: "\u041d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u044f",
          uiId: "angles",
          publishedLensId: "pearl",
          status: observationsStatus,
          source: getObservationsSource(observationsStatus),
          counts: {
            publishedSets: pearlPublishedSets.length,
            publishedCards: pearlPublishedCards.length,
            angleCardsFeatured,
            angleCardsReserve,
            angleCardsTotal,
            cachedResults: observationsCachedResults.length,
          },
          wouldGenerateIfOpenedPublicly: pearlPublishedCards.length === 0,
          canOpenReadOnly:
            pearlPublishedCards.length > 0 ||
            angleCardsTotal > 0 ||
            observationsCachedResults.length > 0,
          notes: observationsNotes,
        },
        lexicon: (() => {
          const sets = allPublishedSets.filter(
            (row) => row.lens_id === "lexicon" && row.status === "published",
          );
          const setIds = sets.map((row) => rowId(row)).filter(Boolean);
          const publishedCards = allPublishedCards.filter(
            (row) =>
              setIds.includes(String(row.set_id ?? "")) &&
              row.status === "published",
          ).length;
          const activeResearchArticles = researchArticles.filter(
            (row) =>
              row.article_type === "word_lens_generation" &&
              row.status === "active",
          ).length;
          const totalResearchArticles = researchArticles.filter(
            (row) => row.article_type === "word_lens_generation",
          ).length;
          const cached = cachedResults.filter(
            (row) => row.lens === "word" && row.status === "active",
          ).length;
          const status: InventoryStatus =
            sets.length > 0 && publishedCards > 0
              ? "ready"
              : activeResearchArticles > 0
                ? "generated_but_not_published"
                : cached > 0
                  ? "legacy_only"
                  : "missing";
          const source =
            status === "ready"
              ? "published_lens_sets"
              : status === "generated_but_not_published"
                ? "research_articles"
                : status === "legacy_only"
                  ? "cached_results"
                  : "none";

          return {
            key: "lexicon",
            label: "\u041b\u0435\u043a\u0441\u0438\u043a\u0430",
            uiId: "word",
            publishedLensId: "lexicon",
            status,
            source,
            counts: {
              publishedSets: sets.length,
              publishedCards,
              researchArticles: activeResearchArticles,
              researchArticlesTotal: totalResearchArticles,
              cachedResults: cached,
            },
            wouldGenerateIfOpenedPublicly: source === "none",
            canOpenReadOnly:
              publishedCards > 0 || activeResearchArticles > 0 || cached > 0,
            notes:
              source === "none"
                ? [
                    "No read-only lexicon content was found. Opening the public Word/Lexicon section may trigger generation.",
                  ]
                : [],
          };
        })(),
        translations: (() => {
          const sets = allPublishedSets.filter(
            (row) =>
              row.lens_id === "translations" && row.status === "published",
          );
          const setIds = sets.map((row) => rowId(row)).filter(Boolean);
          const publishedCards = allPublishedCards.filter(
            (row) =>
              setIds.includes(String(row.set_id ?? "")) &&
              row.status === "published",
          ).length;
          const lensDiscoveryActive = lensDiscoveryCards.filter(
            (row) => row.lens_id === "translations" && row.status === "active",
          ).length;
          const lensDiscoveryReserve = lensDiscoveryCards.filter(
            (row) => row.lens_id === "translations" && row.status === "reserve",
          ).length;
          const lensDiscoveryTotal = lensDiscoveryCards.filter(
            (row) => row.lens_id === "translations",
          ).length;
          const cached = cachedResults.filter(
            (row) => row.lens === "translations" && row.status === "active",
          ).length;
          const translationArticleTypes = [
            "translations_lens_generation",
            "translation_lens_generation",
          ];
          const activeResearchArticles = researchArticles.filter(
            (row) =>
              row.status === "active" &&
              translationArticleTypes.includes(String(row.article_type ?? "")),
          ).length;
          const totalResearchArticles = researchArticles.filter((row) =>
            translationArticleTypes.includes(String(row.article_type ?? "")),
          ).length;
          const status: InventoryStatus =
            sets.length > 0 && publishedCards > 0
              ? "ready"
              : lensDiscoveryActive > 0 || activeResearchArticles > 0
                ? "generated_but_not_published"
                : cached > 0
                  ? "legacy_only"
                  : "missing";
          const source =
            status === "ready"
              ? "published_lens_sets"
              : lensDiscoveryActive > 0
                ? "lens_discovery_cards"
                : activeResearchArticles > 0
                  ? "research_articles"
                  : status === "legacy_only"
                    ? "cached_results"
                    : "none";

          return {
            key: "translations",
            label: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b",
            uiId: "translations",
            publishedLensId: "translations",
            status,
            source,
            counts: {
              publishedSets: sets.length,
              publishedCards,
              lensDiscoveryActive,
              lensDiscoveryReserve,
              lensDiscoveryTotal,
              researchArticles: activeResearchArticles,
              researchArticlesTotal: totalResearchArticles,
              cachedResults: cached,
            },
            wouldGenerateIfOpenedPublicly: source === "none",
            canOpenReadOnly:
              publishedCards > 0 ||
              lensDiscoveryActive > 0 ||
              lensDiscoveryReserve > 0 ||
              activeResearchArticles > 0 ||
              cached > 0,
            notes: [
              "Translations may use lens_discovery_cards; research article usage is counted only for known translation article types.",
            ],
          };
        })(),
        context: (() => {
          const sets = allPublishedSets.filter(
            (row) => row.lens_id === "context" && row.status === "published",
          );
          const setIds = sets.map((row) => rowId(row)).filter(Boolean);
          const publishedCards = allPublishedCards.filter(
            (row) =>
              setIds.includes(String(row.set_id ?? "")) &&
              row.status === "published",
          ).length;
          const lensDiscoveryActive = lensDiscoveryCards.filter(
            (row) => row.lens_id === "context" && row.status === "active",
          ).length;
          const lensDiscoveryReserve = lensDiscoveryCards.filter(
            (row) => row.lens_id === "context" && row.status === "reserve",
          ).length;
          const lensDiscoveryTotal = lensDiscoveryCards.filter(
            (row) => row.lens_id === "context",
          ).length;
          const activeResearchArticles = researchArticles.filter(
            (row) =>
              row.article_type === "context_lens_generation" &&
              row.status === "active",
          ).length;
          const totalResearchArticles = researchArticles.filter(
            (row) => row.article_type === "context_lens_generation",
          ).length;
          const cached = cachedResults.filter(
            (row) => row.lens === "context" && row.status === "active",
          ).length;
          const status: InventoryStatus =
            sets.length > 0 && publishedCards > 0
              ? "ready"
              : lensDiscoveryActive > 0 || activeResearchArticles > 0
                ? "generated_but_not_published"
                : cached > 0
                  ? "legacy_only"
                  : "missing";
          const source =
            status === "ready"
              ? "published_lens_sets"
              : lensDiscoveryActive > 0
                ? "lens_discovery_cards"
                : activeResearchArticles > 0
                  ? "research_articles"
                  : status === "legacy_only"
                    ? "cached_results"
                    : "none";

          return {
            key: "context",
            label: "\u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442",
            uiId: "context",
            publishedLensId: "context",
            status,
            source,
            counts: {
              publishedSets: sets.length,
              publishedCards,
              lensDiscoveryActive,
              lensDiscoveryReserve,
              lensDiscoveryTotal,
              researchArticles: activeResearchArticles,
              researchArticlesTotal: totalResearchArticles,
              cachedResults: cached,
            },
            wouldGenerateIfOpenedPublicly: source === "none",
            canOpenReadOnly:
              publishedCards > 0 ||
              lensDiscoveryActive > 0 ||
              lensDiscoveryReserve > 0 ||
              activeResearchArticles > 0 ||
              cached > 0,
            notes: [
              "Context public path uses a special request shape and should be verified before relying on this status.",
            ],
          };
        })(),
        expanded_articles: (() => {
          const expandedArticleTypes = [
            "expanded_article",
            "expand-angle",
            "expand_angle",
            "angle_expansion",
          ];
          const active = researchArticles.filter(
            (row) =>
              row.status === "active" &&
              expandedArticleTypes.includes(String(row.article_type ?? "")),
          ).length;
          const total = researchArticles.filter((row) =>
            expandedArticleTypes.includes(String(row.article_type ?? "")),
          ).length;
          const status: InventoryStatus =
            active > 0 ? "ready" : total > 0 ? "partial" : "missing";

          return {
            key: "expanded_articles",
            label:
              "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044b\u0435 \u0441\u0442\u0430\u0442\u044c\u0438 \u043a\u0430\u0440\u0442\u043e\u0447\u0435\u043a",
            status,
            source: total > 0 ? "research_articles" : "none",
            counts: {
              researchArticles: active,
              activeResearchArticles: active,
              researchArticlesTotal: total,
            },
            relationConfidence: "needs_verification",
            wouldGenerateIfOpenedPublicly: active === 0,
            canOpenReadOnly: active > 0,
            notes:
              total > 0
                ? [
                    "Expanded article relation to a specific card was not inferred in Step 2.",
                  ]
                : [
                    "No expanded article rows were found using known article_type values.",
                    "Relation between expanded article and card id needs verification before per-card counts are shown.",
                  ],
          };
        })(),        deep: {
          text_findings: buildDeepSection({
            label: "\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0435 \u043d\u0430\u0445\u043e\u0434\u043a\u0438",
            articleType: "text_findings",
            activeCount: deepRowsByType.text_findings.active,
            totalCount: deepRowsByType.text_findings.total,
          }),
          historical_scene: buildDeepSection({
            label: "\u0418\u0441\u0442\u043e\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0441\u0446\u0435\u043d\u0430",
            articleType: "historical_scene",
            activeCount: deepRowsByType.historical_scene.active,
            totalCount: deepRowsByType.historical_scene.total,
          }),
          scripture_links: buildDeepSection({
            label: "\u0421\u0432\u044f\u0437\u0438 \u0441 \u0434\u0440\u0443\u0433\u0438\u043c\u0438 \u0441\u0442\u0438\u0445\u0430\u043c\u0438",
            articleType: "scripture_links",
            activeCount: deepRowsByType.scripture_links.active,
            totalCount: deepRowsByType.scripture_links.total,
          }),
        },
      },
      rawCounts: {
        published_lens_sets: allPublishedSets.length,
        published_lens_cards: allPublishedCards.length,
        angle_cards: angleCards.length,
        cached_results: cachedResults.length,
        research_articles: researchArticles.length,
        lens_discovery_cards: lensDiscoveryCards.length,
        research_notes: researchNotes.length,
      },
      warnings,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load verse public inventory";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}




