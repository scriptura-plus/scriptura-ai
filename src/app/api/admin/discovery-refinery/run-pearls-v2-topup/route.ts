import { NextResponse } from "next/server";
import { isProvider, defaultProvider, type Provider } from "@/lib/ai/providers";
import { getVerseText } from "@/lib/bible/getVerseText";
import { normalizeReference } from "@/lib/bible/normalizeReference";
import { getAngleCards } from "@/lib/cache/angleCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

type Lang = "ru";
type JsonRecord = Record<string, unknown>;

type TopupBody = {
  reference?: unknown;
  lang?: unknown;
  targetCount?: unknown;
  force?: unknown;
  processLimit?: unknown;
  includeStrongNonPublic?: unknown;
  provider?: unknown;
  editorProvider?: unknown;
  cards?: unknown;
};

type V2Card = {
  card_id?: string;
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
  score_total?: number | null;
  public_ready?: boolean;
  public_status?: string | null;
  risk_flags?: string[];
  public_blockers?: string[];
  verdict?: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error("[PEARLS_V2_TOPUP] ADMIN_SECRET is not configured");
    return false;
  }

  return req.headers.get("x-admin-secret") === expected;
}

function chooseProvider(value: unknown, fallback: Provider): Provider {
  if (isProvider(value)) return value;

  const envProvider = process.env.DISCOVERY_TOPUP_PROVIDER;
  if (isProvider(envProvider)) return envProvider;

  return fallback;
}

function normalizeV2Card(value: unknown): V2Card | null {
  if (!isRecord(value)) return null;

  const title = getString(value.title);
  const teaser = getString(value.teaser);

  if (!title || !teaser) return null;

  const riskFlags = Array.isArray(value.risk_flags)
    ? value.risk_flags
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const publicBlockers = Array.isArray(value.public_blockers)
    ? value.public_blockers
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    card_id: getString(value.card_id) ?? undefined,
    title,
    anchor: getString(value.anchor),
    teaser,
    why_it_matters: getString(value.why_it_matters),
    score_total: getNumber(value.score_total),
    public_ready: value.public_ready === true,
    public_status: getString(value.public_status),
    risk_flags: riskFlags,
    public_blockers: publicBlockers,
    verdict: getString(value.verdict),
  };
}

function shouldSendToOldPipeline(
  card: V2Card,
  _includeStrongNonPublic: boolean,
): boolean {
  const score = card.score_total ?? 0;

  // V2 is only the factory. The old process-angle-candidate route is the final judge.
  // So we send every strong V2 card to the old pipeline, even if V2 marked it not_public_ready.
  // The old pipeline will decide save / rewrite / duplicate / reject.
  if (score >= 82) return true;

  return false;
}

function hasEvidenceRisk(card: V2Card): boolean {
  const hardRiskFlags = new Set([
    "lexical_check",
    "translation_check",
    "syntax_check",
    "historical_check",
    "intertextual_check",
    "theological_overreach",
    "overclaim",
    "pretty_empty",
    "duplicate_risk",
    "needs_evidence_before_public",
    "needs_rewrite_or_moderator",
  ]);

  const flags = [
    ...(card.risk_flags ?? []),
    ...(card.public_blockers ?? []),
    card.public_status ?? "",
    card.verdict ?? "",
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  const flagRisk = flags.some((flag) => {
    if (hardRiskFlags.has(flag)) return true;
    if (flag.includes("lexical_check")) return true;
    if (flag.includes("translation_check")) return true;
    if (flag.includes("syntax_check")) return true;
    if (flag.includes("historical_check")) return true;
    if (flag.includes("intertextual_check")) return true;
    if (flag.includes("theological_overreach")) return true;
    if (flag.includes("overclaim")) return true;
    if (flag.includes("needs_evidence")) return true;
    return false;
  });

  if (flagRisk) return true;

  const text = getCardTextForRisk(card);

  // Catch risky source-sensitive claims even when V2 forgot to flag them.
  // These should be saved as hidden/research until checked.
  const sourceSensitivePatterns = [
    "греческ",
    "еврейск",
    "арамейск",
    "оригинал",
    "original",
    "greek",
    "hebrew",
    "aramaic",
    "перевод",
    "translation",
    "лексич",
    "lexical",
    "синтакс",
    "syntax",
    "граммат",
    "grammar",
    "морфолог",
    "morpholog",
    "перфект",
    "perfect",
    "имперфект",
    "imperfect",
    "аорист",
    "aorist",
    "причаст",
    "participle",
    "падеж",
    "case",
    "форма незаверш",
    "незавершённ",
    "незавершенн",
    "длительность",
    "semantic",
    "root",
    "корень",
  ];

  return sourceSensitivePatterns.some((pattern) => text.includes(pattern));
}

function getCardTextForRisk(card: V2Card): string {
  return [
    card.title,
    card.anchor,
    card.teaser,
    card.why_it_matters,
    ...(card.risk_flags ?? []),
    ...(card.public_blockers ?? []),
    card.public_status,
    card.verdict,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function chooseForceStatus(card: V2Card): "hidden" | null {
  if (hasEvidenceRisk(card)) return "hidden";
  return null;
}

function makeCandidate(card: V2Card) {
  return {
    id: card.card_id ?? undefined,
    title: card.title,
    anchor: card.anchor ?? null,
    teaser: card.teaser,
    why_it_matters: card.why_it_matters ?? null,
  };
}

function keyOf(title: string | null | undefined, anchor: string | null | undefined) {
  return `${(title ?? "").trim().toLowerCase()}|${(anchor ?? "")
    .trim()
    .toLowerCase()}`;
}

async function postJson(args: {
  url: string;
  adminSecret: string;
  body: unknown;
}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": args.adminSecret,
    },
    body: JSON.stringify(args.body),
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function POST(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_SECRET is not configured" },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as TopupBody;
    const reference = getString(body.reference);
    const lang: Lang = "ru";

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "reference is required" },
        { status: 400 },
      );
    }

    if (body.lang && body.lang !== "ru") {
      return NextResponse.json(
        { ok: false, error: "Only lang=ru is supported now" },
        { status: 400 },
      );
    }

    const incomingCards = Array.isArray(body.cards)
      ? body.cards.map(normalizeV2Card).filter((item): item is V2Card => item !== null)
      : [];

    if (incomingCards.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No cards were sent. Run Pearls v2 first, then click top-up.",
        },
        { status: 400 },
      );
    }

    const targetCount = Math.min(Math.max(getNumber(body.targetCount) ?? 12, 1), 100);
    const processLimit = Math.min(Math.max(getNumber(body.processLimit) ?? 3, 1), 8);
    const force = getBoolean(body.force) ?? false;
    const includeStrongNonPublic = getBoolean(body.includeStrongNonPublic) ?? false;

    const provider = chooseProvider(body.provider, defaultProvider());
    const editorProvider = chooseProvider(body.editorProvider, provider);

    const normalized = normalizeReference(reference);
    const canonicalRef = normalized.canonical_ref ?? reference;

    const existing = await getAngleCards({
      reference,
      lang,
      statuses: ["featured", "reserve"],
      limit: 200,
    });

    if (!existing.ok) {
      return NextResponse.json(
        { ok: false, error: existing.error ?? "Failed to read existing cards" },
        { status: 500 },
      );
    }

    const existingCount = existing.cards.length;

    if (!force && existingCount >= targetCount) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "target_count_already_met",
        changed_database: false,
        reference,
        canonical_ref: canonicalRef,
        existing_count_before: existingCount,
        target_count: targetCount,
        v2_cards_total: incomingCards.length,
        selected_for_old_pipeline: 0,
        processed_count: 0,
        saved_count: 0,
        skipped_count: 0,
        failed_count: 0,
        results: [],
      });
    }

    const existingKeys = new Set(
      existing.cards.map((card) => keyOf(card.title, card.anchor)),
    );

    const selectedCards = incomingCards
      .filter((card) => shouldSendToOldPipeline(card, includeStrongNonPublic))
      .filter((card) => !existingKeys.has(keyOf(card.title, card.anchor ?? null)))
      .slice(0, processLimit);

    const verse = await getVerseText(reference, lang, provider);
    const verseText = verse.text.trim();

    if (!verseText) {
      return NextResponse.json(
        { ok: false, error: "Could not load verse text" },
        { status: 500 },
      );
    }

    const origin = new URL(req.url).origin;
    const results = [];

    for (const card of selectedCards) {
      const candidate = makeCandidate(card);

      const processed = await postJson({
        url: `${origin}/api/admin/process-angle-candidate`,
        adminSecret,
        body: {
          reference,
          verseText,
          lang,
          provider,
          source_provider: "pearls_v2",
          source_model: "pearls_v2_current_result_topup_v5_hidden_risks",
          editor_provider: editorProvider,
          targetFeaturedCount: targetCount,
          force_status: chooseForceStatus(card),
          sourceArticle: JSON.stringify({
            source: "pearls_v2_current_result_topup_v5_hidden_risks",
            canonical_ref: canonicalRef,
            v2_card: card,
            forced_status: chooseForceStatus(card),
            has_evidence_risk: hasEvidenceRisk(card),
          }),
          candidate,
        },
      });

      const processedRecord = isRecord(processed.data) ? processed.data : {};

      results.push({
        candidate_title: candidate.title,
        candidate_score_v2: card.score_total ?? null,
        candidate_public_ready_v2: card.public_ready ?? false,
        ok: processed.ok,
        status: processed.status,
        skipped: processedRecord.skipped === true,
        skip_reason: getString(processedRecord.skip_reason),
        saved_id: getString(processedRecord.saved_id),
        saved_ids: Array.isArray(processedRecord.saved_ids)
          ? processedRecord.saved_ids
          : [],
        final_score: getNumber(processedRecord.score_total),
        old_pipeline_status: getString(processedRecord.status),
        forced_status: chooseForceStatus(card),
        has_evidence_risk: hasEvidenceRisk(card),
        response: processed.data,
      });
    }

    return NextResponse.json({
      ok: true,
      skipped: false,
      changed_database: results.some((item) => Boolean(item.saved_id)),
      reference,
      canonical_ref: canonicalRef,
      lang,
      existing_count_before: existingCount,
      target_count: targetCount,
      process_limit: processLimit,
      include_strong_non_public: includeStrongNonPublic,

      v2_cards_total: incomingCards.length,
      selected_for_old_pipeline: selectedCards.length,

      processed_count: results.length,
      saved_count: results.filter((item) => Boolean(item.saved_id)).length,
      skipped_count: results.filter((item) => item.skipped).length,
      failed_count: results.filter((item) => !item.ok).length,

      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Pearls v2 top-up failed",
      },
      { status: 500 },
    );
  }
}
