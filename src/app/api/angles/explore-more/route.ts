import { NextResponse } from "next/server";
import { isProvider, defaultProvider } from "@/lib/ai/providers";
import {
  getAngleCards,
  type AngleCardRow,
} from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "ru" | "en" | "es";

type SetMaturity = "thin" | "healthy" | "rich" | "saturated";

type ExploreDecision = {
  set_maturity: SetMaturity;
  should_explore: boolean;
  generation_count: number;
  process_limit: number;
  message: string;
  public_label: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "en" || value === "es";
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPublicCard(card: AngleCardRow) {
  return {
    id: card.id,
    title: card.title,
    anchor: card.anchor,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters,
    score_total: card.score_total,
    status: card.status,
    coverage_type: card.coverage_type,
  };
}

function decideExploration(cards: AngleCardRow[]): ExploreDecision {
  const featured = cards.filter((card) => card.status === "featured");
  const reserve = cards.filter((card) => card.status === "reserve");

  const featuredCount = featured.length;
  const reserveCount = reserve.length;

  if (featuredCount <= 3) {
    return {
      set_maturity: "thin",
      should_explore: true,
      generation_count: 8,
      process_limit: 3,
      public_label: "Найти первые жемчужины",
      message:
        "По этому стиху пока мало сохранённых жемчужин. Попробуем найти несколько сильных ракурсов.",
    };
  }

  if (featuredCount <= 7) {
    return {
      set_maturity: "healthy",
      should_explore: true,
      generation_count: 6,
      process_limit: 3,
      public_label: "Найти ещё жемчужины",
      message:
        "У стиха уже есть хороший набор жемчужин. Попробуем найти дополнительные, но сохраним только достаточно сильные и новые.",
    };
  }

  if (featuredCount <= 10) {
    return {
      set_maturity: "rich",
      should_explore: true,
      generation_count: 5,
      process_limit: 2,
      public_label: "Искать глубже",
      message:
        "Набор уже богатый, поэтому будем искать осторожнее: только редкие или действительно новые жемчужины.",
    };
  }

  if (reserveCount >= 2) {
    return {
      set_maturity: "saturated",
      should_explore: false,
      generation_count: 0,
      process_limit: 0,
      public_label: "Основные жемчужины уже найдены",
      message:
        "Похоже, основные сильные жемчужины по этому стиху уже найдены. Новые попытки сейчас, скорее всего, будут повторять существующие мысли.",
    };
  }

  return {
    set_maturity: "rich",
    should_explore: true,
    generation_count: 4,
    process_limit: 2,
    public_label: "Искать глубже",
    message:
      "По стиху уже есть много сильных жемчужин. Попробуем найти ещё только в более редких направлениях.",
  };
}

async function readCards(reference: string, lang: Lang) {
  const result = await getAngleCards({
    reference,
    lang,
    statuses: ["featured", "reserve"],
    limit: 100,
  });

  if (!result.ok) {
    throw new Error(result.error ?? "Failed to read angle cards");
  }

  return result.cards;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const reference = getString(body?.reference);
    const verseText = getString(body?.verseText);
    const lang = isLang(body?.lang) ? body.lang : null;
    const provider = isProvider(body?.provider)
      ? body.provider
      : defaultProvider();

    if (!reference || !verseText || !lang) {
      return NextResponse.json(
        { error: "reference, verseText, and lang are required" },
        { status: 400 },
      );
    }

    const beforeCards = await readCards(reference, lang);
    const decision = decideExploration(beforeCards);

    const beforeFeaturedCount = beforeCards.filter(
      (card) => card.status === "featured",
    ).length;

    const beforeReserveCount = beforeCards.filter(
      (card) => card.status === "reserve",
    ).length;

    if (!decision.should_explore) {
      return NextResponse.json({
        ok: true,
        explored: false,
        reason: "set_saturated",
        decision,
        before: {
          count: beforeCards.length,
          featured_count: beforeFeaturedCount,
          reserve_count: beforeReserveCount,
          cards: beforeCards.map(getPublicCard),
        },
        after: {
          count: beforeCards.length,
          featured_count: beforeFeaturedCount,
          reserve_count: beforeReserveCount,
          cards: beforeCards.map(getPublicCard),
        },
      });
    }

    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return NextResponse.json(
        { error: "ADMIN_SECRET is not configured" },
        { status: 500 },
      );
    }

    const generateUrl = new URL(
      "/api/admin/generate-angle-candidates",
      req.url,
    ).toString();

    const generateResponse = await fetch(generateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        reference,
        verseText,
        lang,
        provider,
        count: decision.generation_count,
        processLimit: decision.process_limit,
      }),
    });

    const generationData = await generateResponse.json();

    if (!generateResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          explored: false,
          decision,
          generation_error: generationData,
        },
        { status: generateResponse.status },
      );
    }

    const afterCards = await readCards(reference, lang);

    const afterFeaturedCount = afterCards.filter(
      (card) => card.status === "featured",
    ).length;

    const afterReserveCount = afterCards.filter(
      (card) => card.status === "reserve",
    ).length;

    const addedCount = Math.max(0, afterCards.length - beforeCards.length);
    const addedFeaturedCount = Math.max(
      0,
      afterFeaturedCount - beforeFeaturedCount,
    );
    const addedReserveCount = Math.max(0, afterReserveCount - beforeReserveCount);

    const noNewStrongCards = addedCount === 0;

    return NextResponse.json({
      ok: true,
      explored: true,
      decision,
      result_message: noNewStrongCards
        ? "Новых сильных жемчужин пока не найдено. Система в основном встретила повторы существующих углов."
        : "Найдены и сохранены новые жемчужины.",
      added_count: addedCount,
      added_featured_count: addedFeaturedCount,
      added_reserve_count: addedReserveCount,
      before: {
        count: beforeCards.length,
        featured_count: beforeFeaturedCount,
        reserve_count: beforeReserveCount,
      },
      after: {
        count: afterCards.length,
        featured_count: afterFeaturedCount,
        reserve_count: afterReserveCount,
        cards: afterCards.map(getPublicCard),
      },
      generation: isRecord(generationData) ? generationData : null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Explore more failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
