import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateTestSuggestionBody = {
  reference?: string;
  canonical_ref?: string | null;
  book_key?: string | null;
  book?: string | null;
  chapter?: number | null;
  verse?: number | null;
  lang?: string;
};

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[CREATE_TEST_EDITORIAL_SUGGESTION] ADMIN_SECRET is not configured");
    return false;
  }

  const provided = req.headers.get("x-admin-secret");
  return provided === expected;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const client = createAdminClient();

  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  let body: CreateTestSuggestionBody = {};

  try {
    body = (await req.json()) as CreateTestSuggestionBody;
  } catch {
    body = {};
  }

  const reference = getString(body.reference);
  const canonicalRef = getString(body.canonical_ref);
  const lang = getString(body.lang) ?? "ru";

  if (!reference && !canonicalRef) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing reference or canonical_ref",
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  const candidatePayload = {
    title: "Тестовое редакторское предложение",
    anchor: "тестовая опора",
    teaser:
      "Это тестовая запись, созданная только для проверки очереди редакторских предложений в Studio. Она не должна становиться публичной карточкой.",
    why_it_matters:
      "Если эта запись видна в Studio, значит путь editorial_suggestions → API → UI работает.",
    test: true,
  };

  const payload = {
    reference: reference ?? canonicalRef ?? "unknown",
    canonical_ref: canonicalRef ?? reference,
    book_key: getString(body.book_key),
    book: getString(body.book),
    chapter: getNumber(body.chapter),
    verse: getNumber(body.verse),
    lang,

    suggestion_type: "style_review",
    status: "pending",

    existing_card_id: null,
    candidate_card_id: null,
    candidate_payload: candidatePayload,

    score_existing: 78,
    score_candidate: 88,
    score_delta: 10,

    angle_relationship: "stronger_version",
    relationship_confidence: "medium",
    same_angle_summary:
      "Тестовая запись имитирует случай, когда новый вариант выглядит сильнее существующей карточки, но требует решения модератора.",

    reason:
      "Тест создан для проверки визуального блока “Редакторские предложения” в Studio. Никаких реальных карточек он не меняет.",
    risk: "test_only",
    risk_level: "low",
    source_summary: "Тестовая системная запись без связи с реальным источником Озера.",

    source_id: null,
    note_id: null,

    provider: "system",
    model: "test-route",
    evaluator_version: "test_editorial_suggestion_v1",
    decision_engine_version: "test_only_v1",

    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    moderator_decision: null,

    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client
    .from("editorial_suggestions")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("[CREATE_TEST_EDITORIAL_SUGGESTION] insert error", {
      reference,
      canonicalRef,
      lang,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to create test editorial suggestion",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    suggestion: data,
  });
}
