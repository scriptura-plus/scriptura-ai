import type { Provider } from "./providers";

export type ProviderTask =
  | "canonical_pearl_generation"
  | "observations_generation"
  | "lexicon_generation"
  | "translations_generation"
  | "translation_localization"
  | "context_generation"
  | "expanded_article_generation"
  | "deep_article_generation"
  | "judge_scoring"
  | "rewrite_repair"
  | "admin_test"
  | "benchmark"
  | "fallback_retry";

export type ProviderPrecision =
  | "high"
  | "standard"
  | "cheap_candidate"
  | "admin";

export type ProviderPolicy = {
  task: ProviderTask;
  provider: Provider;
  modelHint: string;
  precision: ProviderPrecision;
  allowAdminOverride: boolean;
  notes: string;
};

/**
 * Internal task-based provider policy.
 *
 * This helper is intentionally NOT wired into public runtime yet.
 * Public users should eventually choose only language, while provider/model
 * routing stays internal and task-specific.
 *
 * Future implementation steps should preserve provider/model metadata
 * on generated records even after public provider selection is removed.
 */
const POLICIES: Record<ProviderTask, ProviderPolicy> = {
  canonical_pearl_generation: {
    task: "canonical_pearl_generation",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "Quality-first canonical public content. Should not be controlled by public UI.",
  },

  observations_generation: {
    task: "observations_generation",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "Tied to canonical public quality; avoid provider drift between users.",
  },

  lexicon_generation: {
    task: "lexicon_generation",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "High precision required because lexical/original-language claims are sensitive.",
  },

  translations_generation: {
    task: "translations_generation",
    provider: "openai",
    modelHint: "translation-model-to-benchmark",
    precision: "cheap_candidate",
    allowAdminOverride: false,
    notes: "Placeholder policy only. Needs benchmark: GPT mini vs Claude vs Gemini. Do not treat as final quality decision.",
  },

  translation_localization: {
    task: "translation_localization",
    provider: "openai",
    modelHint: "translation-model-to-benchmark",
    precision: "cheap_candidate",
    allowAdminOverride: false,
    notes: "Must preserve the same thought, anchor, caution, and discovery. Needs benchmark before runtime wiring.",
  },

  context_generation: {
    task: "context_generation",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "Context can easily overclaim; prefer high-precision generation.",
  },

  expanded_article_generation: {
    task: "expanded_article_generation",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "Long-form public content should remain quality-first.",
  },

  deep_article_generation: {
    task: "deep_article_generation",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "Default to quality. Future version may split cheap draft from high-precision review.",
  },

  judge_scoring: {
    task: "judge_scoring",
    provider: "openai",
    modelHint: "high-precision-evaluator",
    precision: "high",
    allowAdminOverride: false,
    notes: "Evaluator must be stable and strict. Existing runtime is not changed by this helper.",
  },

  rewrite_repair: {
    task: "rewrite_repair",
    provider: "claude",
    modelHint: "claude-sonnet-4-6",
    precision: "high",
    allowAdminOverride: false,
    notes: "Rewrite/repair must avoid angle drift and unsupported claims.",
  },

  admin_test: {
    task: "admin_test",
    provider: "claude",
    modelHint: "admin-selected",
    precision: "admin",
    allowAdminOverride: true,
    notes: "Admin-only override may be allowed later for controlled tests.",
  },

  benchmark: {
    task: "benchmark",
    provider: "claude",
    modelHint: "benchmark-selected",
    precision: "admin",
    allowAdminOverride: true,
    notes: "Benchmark routes may compare providers/models. Never expose to public UI.",
  },

  fallback_retry: {
    task: "fallback_retry",
    provider: "claude",
    modelHint: "internal-fallback",
    precision: "standard",
    allowAdminOverride: false,
    notes: "Fallback/retry must remain internal and never public-controlled.",
  },
};

export function resolveProviderPolicy(task: ProviderTask): ProviderPolicy {
  return POLICIES[task];
}

export function getCanonicalGenerationProvider(): Provider {
  return resolveProviderPolicy("canonical_pearl_generation").provider;
}

export function getTranslationProviderPolicy(): ProviderPolicy {
  return resolveProviderPolicy("translation_localization");
}

/**
 * Maps public /api/analyze request shape to an internal provider task.
 *
 * This helper is intentionally NOT wired into /api/analyze yet.
 * It only documents the future task-based routing plan.
 *
 * Important distinction:
 * - translations_generation = public Bible translations/comparison lens
 * - translation_localization = translating already generated cards/articles into another UI language
 */
export function resolveAnalyzeProviderTask(
  kind: string,
  id?: string | null,
): ProviderTask | null {
  if (kind === "lens") {
    if (id === "angles") {
      // This branch can create canonical public observations / Pearl sets.
      // Do not treat it as cheap generic observations.
      return "canonical_pearl_generation";
    }

    if (id === "word") {
      return "lexicon_generation";
    }

    if (id === "context") {
      return "context_generation";
    }

    if (id === "translations") {
      // Bible translation comparison lens, NOT localization translation.
      return "translations_generation";
    }

    return null;
  }

  if (kind === "extra") {
    if (
      id === "text_findings" ||
      id === "historical_scene" ||
      id === "scripture_links"
    ) {
      // scripture_links is especially high-risk and may need stronger
      // evaluation/verification before public use in later steps.
      return "deep_article_generation";
    }

    return null;
  }

  if (kind === "context") {
    // Legacy/special context path.
    return "context_generation";
  }

  if (kind === "expand-angle") {
    return "expanded_article_generation";
  }

  // Unknown analyze kinds must not silently fall back to a default provider.
  return null;
}
