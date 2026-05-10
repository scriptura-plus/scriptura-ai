import "server-only";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonRecord = Record<string, unknown>;

type SaveDiscoveryRefineryRunArgs = {
  result: unknown;
  mode?: string;
  isFixture?: boolean;
  fixtureId?: string | null;
  codeGitSha?: string | null;
};

const SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) return null;

  const type = typeof value;

  if (type === "string" || type === "number" || type === "boolean") {
    return value as JsonValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isRecord(value)) {
    const out: Record<string, JsonValue> = {};

    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "undefined") continue;
      if (typeof item === "function") continue;
      if (typeof item === "symbol") continue;
      out[key] = toJsonValue(item);
    }

    return out;
  }

  return null;
}

function getJsonObject(value: unknown): Record<string, JsonValue> {
  const json = toJsonValue(value);
  return isRecord(json) ? (json as Record<string, JsonValue>) : {};
}

function getJsonArray(value: unknown): JsonValue[] {
  const json = toJsonValue(value);
  return Array.isArray(json) ? json : [];
}

function getActionCounts(result: JsonRecord): Record<string, number> {
  const actionCounts = asRecord(result.action_counts);
  const aggregate = asRecord(result.aggregate);

  return {
    approve_reserve:
      getNumber(actionCounts.approve_reserve) || getNumber(aggregate.approve_reserve),
    approve_active:
      getNumber(actionCounts.approve_active) || getNumber(aggregate.approve_active),
    rewrite: getNumber(actionCounts.rewrite) || getNumber(aggregate.rewrite),
    replace_existing:
      getNumber(actionCounts.replace_existing) || getNumber(aggregate.replace_existing),
    discard: getNumber(actionCounts.discard) || getNumber(aggregate.discard),
    send_back:
      getNumber(actionCounts.send_back) || getNumber(aggregate.send_back),
    mark_for_external_research:
      getNumber(actionCounts.mark_for_external_research) ||
      getNumber(aggregate.mark_for_external_research),
  };
}

function getRunMode(args: SaveDiscoveryRefineryRunArgs, result: JsonRecord): string {
  if (args.mode) return args.mode;

  const rawMode = getString(result.mode, "diagnostic_preview");

  if (rawMode === "day15_fixture_preview" || rawMode === "detector_preview") {
    return args.isFixture ? "fixture_preview" : "real_text_only";
  }

  if (rawMode === "day15_multi_verse_preview") return "batch_preview";

  return rawMode;
}

function getRunId(result: JsonRecord): string {
  const direct = getString(result.run_id);
  if (direct) return direct;

  const firstQueueItem = asRecord(asArray(result.queue)[0]);
  const signal = asRecord(firstQueueItem.signal);
  const signalRunId = getString(signal.run_id);

  if (signalRunId) return signalRunId;

  const reference = getString(result.canonical_ref) || getString(result.reference) || "unknown";
  const created = getString(result.created_at) || new Date().toISOString();

  return `runlog_${reference
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}_${created.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

function buildScopeDecision(result: JsonRecord, mode: string): Record<string, JsonValue> {
  const existing = asRecord(result.scope_decision);

  if (Object.keys(existing).length > 0) {
    return getJsonObject(existing);
  }

  return {
    mode: mode === "real_text_only" || mode === "fixture_preview" ? "text_only" : mode,
    reference: getString(result.reference),
    canonical_ref: getString(result.canonical_ref) || getString(result.reference),
    passage_id: getString(result.passage_id),
    detector_may_use: ["verse_text", "allowed_passage", "genre_scope_metadata"],
    detector_may_not_use: [
      "Research Lake",
      "existing cards",
      "prior Claude outputs",
      "active/reserve cards for the same verse",
    ],
    rationale:
      "Detector is kept text-only to avoid self-echo; existing cards are used only by Same-Angle Judge.",
  };
}

function buildInputContextSnapshot(result: JsonRecord): Record<string, JsonValue> {
  const existing = asRecord(result.input_context_snapshot);

  if (Object.keys(existing).length > 0) {
    return getJsonObject(existing);
  }

  const diagnostics = asArray(result.diagnostics);
  const firstDiagnostic = asRecord(diagnostics[0]);

  return {
    reference: getString(result.reference),
    canonical_ref: getString(result.canonical_ref) || getString(result.reference),
    passage_id: getString(result.passage_id),
    genre: getString(result.genre),
    expected_richness: getString(result.expected_richness),
    existing_coverage_mode: getString(result.existing_coverage_mode),
    existing_cards_snapshot: {
      existing_cards_count: getNumber(firstDiagnostic.existing_cards_count),
      nearest_existing_cards: getJsonArray(firstDiagnostic.nearest_existing_cards),
      note:
        "Detector did not use existing cards; these are recorded for analysis and Same-Angle Judge context.",
    },
    research_lake_snapshot: {
      available: null,
      source_count: null,
      source_types: [],
      used_by_detector: false,
    },
  };
}

function buildSignalFlow(result: JsonRecord): Record<string, JsonValue> {
  const existing = asRecord(result.signal_flow);

  if (Object.keys(existing).length > 0) {
    return getJsonObject(existing);
  }

  const detectorSignalCount = getNumber(result.detector_signal_count);
  const queue = asArray(result.queue);
  const errors = asArray(result.errors);
  const actionCounts = getActionCounts(result);

  let detectorOutputStatus = "signals_found";

  if (errors.length > 0 && detectorSignalCount === 0) {
    detectorOutputStatus = "detector_failed";
  } else if (detectorSignalCount === 0) {
    detectorOutputStatus = "no_signals_declared";
  } else if (queue.length === 0) {
    detectorOutputStatus = "text_returned_but_unparseable";
  } else if (queue.length > 0 && actionCounts.discard === queue.length) {
    detectorOutputStatus = "all_signals_discarded";
  } else if (queue.length > 0) {
    detectorOutputStatus = "mixed_queue";
  }

  return {
    detector_output_status: detectorOutputStatus,
    detector_raw_parse_status: "unknown_or_already_normalized",
    detector_signal_count: detectorSignalCount,
    normalized_signal_count: queue.length,
    queue_item_count: queue.length,
    routing_counts: {
      approve_reserve: actionCounts.approve_reserve,
      approve_active: actionCounts.approve_active,
      rewrite: actionCounts.rewrite,
      replace_existing: actionCounts.replace_existing,
      discard: actionCounts.discard,
      send_back: actionCounts.send_back,
      mark_for_external_research: actionCounts.mark_for_external_research,
    },
    notes: [],
  };
}

function getSignalFromQueueItem(queueItem: unknown): JsonRecord {
  const item = asRecord(queueItem);
  return asRecord(item.signal);
}

function getRiskFlags(signal: JsonRecord): string[] {
  const riskFlags = signal.risk_flags;

  if (!Array.isArray(riskFlags)) return [];

  return riskFlags
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function getAnchorText(signal: JsonRecord): string {
  const textualAnchor = asRecord(signal.textual_anchor);
  const canonical = asRecord(textualAnchor.canonical);
  const surfaces = asRecord(textualAnchor.surfaces);
  const ru = asRecord(surfaces.ru);

  return (
    getString(canonical.quote) ||
    getString(canonical.text) ||
    getString(ru.quote)
  );
}

function getReaderSurpriseRu(signal: JsonRecord): string {
  const readerSurprise = asRecord(signal.reader_surprise_sentence);
  return getString(readerSurprise.ru) || getString(signal.reader_surprise_sentence);
}

function getFingerprintHash(signal: JsonRecord): string | null {
  const fingerprint = asRecord(signal.angle_fingerprint);
  const hash = getString(fingerprint.hash);
  return hash || null;
}

function getAngleFamily(signal: JsonRecord): string | null {
  const fingerprint = asRecord(signal.angle_fingerprint);
  const angleFamily = getString(fingerprint.angle_family);
  return angleFamily || null;
}

function getSignalEvidenceJson(signal: JsonRecord, key: "verifiable_claims" | "evidence_checks"): JsonValue[] {
  const direct = signal[key];

  if (Array.isArray(direct)) {
    return getJsonArray(direct);
  }

  const metadata = asRecord(signal.metadata);
  const fromMetadata = metadata[key];

  if (Array.isArray(fromMetadata)) {
    return getJsonArray(fromMetadata);
  }

  const verifierVerdict = asRecord(signal.verifier_verdict);
  const fromVerifier = verifierVerdict[key];

  if (Array.isArray(fromVerifier)) {
    return getJsonArray(fromVerifier);
  }

  return [];
}

function getQueueItemRouting(queueItem: JsonRecord, signal: JsonRecord): string | null {
  return (
    getString(queueItem.suggested_action) ||
    getString(signal.suggested_next_action) ||
    null
  );
}

function getQueueItemVerdicts(queueItem: JsonRecord, signal: JsonRecord): {
  verdictJudge: string | null;
  verdictVerifier: string | null;
} {
  const verdicts = asRecord(queueItem.verdicts);
  const sameAngle = asRecord(verdicts.same_angle);
  const verifier = asRecord(verdicts.verifier);

  const signalSameAngle = asRecord(signal.relation_to_existing);
  const signalVerifier = asRecord(signal.verifier_verdict);

  return {
    verdictJudge:
      getString(sameAngle.verdict) ||
      getString(signalSameAngle.verdict) ||
      null,
    verdictVerifier:
      getString(verifier.overall) ||
      getString(signalVerifier.overall) ||
      null,
  };
}

function buildRunRow(args: SaveDiscoveryRefineryRunArgs, result: JsonRecord) {
  const mode = getRunMode(args, result);
  const runId = getRunId(result);
  const actionCounts = getActionCounts(result);
  const queue = asArray(result.queue);

  return {
    run_id: runId,
    schema_version: SCHEMA_VERSION,
    code_git_sha:
      args.codeGitSha ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      null,

    mode,
    reference: getString(result.reference, "Unknown"),
    canonical_ref:
      getString(result.canonical_ref) ||
      getString(result.reference, "Unknown"),
    passage_id: getString(result.passage_id) || null,
    fixture_id: args.fixtureId ?? getString(result.fixture_id) ?? null,
    is_fixture: args.isFixture ?? Boolean(getString(result.fixture_id)),

    detector_provider: getString(result.detector_provider, "unknown"),
    judge_provider: getString(result.judge_provider, "unknown"),
    verifier_provider: getString(result.verifier_provider, "unknown"),

    ok: getBoolean(result.ok),
    errors: getJsonArray(result.errors),

    detector_signal_count: getNumber(result.detector_signal_count),
    queue_item_count: queue.length,
    approve_count: actionCounts.approve_reserve + actionCounts.approve_active,
    rewrite_count: actionCounts.rewrite,
    discard_count: actionCounts.discard,

    scope_decision: buildScopeDecision(result, mode),
    input_context_snapshot: buildInputContextSnapshot(result),
    signal_flow: buildSignalFlow(result),
    full_result_json: getJsonObject(result),
  };
}

function buildSignalRows(result: JsonRecord, runId: string) {
  const queue = asArray(result.queue);

  return queue.map((queueItemRaw, index) => {
    const queueItem = asRecord(queueItemRaw);
    const signal = getSignalFromQueueItem(queueItemRaw);
    const verdicts = getQueueItemVerdicts(queueItem, signal);

    return {
      signal_id: getString(signal.signal_id, `signal_${index + 1}`),
      run_id: runId,
      parent_signal_id: getString(signal.parent_signal_id) || null,

      signal_index: index,

      reference: getString(signal.reference) || getString(result.reference, "Unknown"),
      canonical_ref:
        getString(signal.canonical_ref) ||
        getString(result.canonical_ref) ||
        getString(result.reference, "Unknown"),
      passage_id:
        getString(signal.passage_id) ||
        getString(result.passage_id) ||
        null,

      anchor_text: getAnchorText(signal),
      reader_surprise_ru: getReaderSurpriseRu(signal),
      core_observation: getString(signal.core_observation),

      evidence_level: getString(signal.evidence_level) || null,
      angle_family: getAngleFamily(signal),
      fingerprint_hash: getFingerprintHash(signal),

      verdict_judge: verdicts.verdictJudge,
      verdict_verifier: verdicts.verdictVerifier,
      routing_decision: getQueueItemRouting(queueItem, signal),

      risk_flags: getRiskFlags(signal),

      manual_card_draft: getString(signal.manual_card_draft) || null,

      verifiable_claims: getSignalEvidenceJson(signal, "verifiable_claims"),
      evidence_checks: getSignalEvidenceJson(signal, "evidence_checks"),
      full_signal_json: getJsonObject({
        queue_item: queueItem,
        signal,
      }),
    };
  });
}

async function supabaseRestRequest(args: {
  path: string;
  method: "POST";
  body: unknown;
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${args.path}`;

  const res = await fetch(url, {
    method: args.method,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(args.body),
  });

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      `Supabase REST error ${res.status} on ${args.path}: ${text.slice(0, 800)}`,
    );
  }
}

export async function saveDiscoveryRefineryRun(
  args: SaveDiscoveryRefineryRunArgs,
): Promise<{ run_id: string; signal_count: number; skipped: boolean }> {
  if (process.env.DISCOVERY_REFINERY_RUN_LOG_ENABLED === "false") {
    return {
      run_id: "",
      signal_count: 0,
      skipped: true,
    };
  }

  const result = asRecord(args.result);
  const runRow = buildRunRow(args, result);
  const signalRows = buildSignalRows(result, runRow.run_id);

  await supabaseRestRequest({
    path: "discovery_refinery_runs",
    method: "POST",
    body: runRow,
  });

  if (signalRows.length > 0) {
    await supabaseRestRequest({
      path: "discovery_refinery_signals",
      method: "POST",
      body: signalRows,
    });
  }

  return {
    run_id: runRow.run_id,
    signal_count: signalRows.length,
    skipped: false,
  };
}
