import type { CailClient, CailModelCatalogEntry } from "@cuny-ai-lab/cail-client";

// The dropdown is CAIL Gateway's catalog, not a list kept here. The Gateway
// owns which models exist and how they rank (`recommended`, `tier`, `order`);
// this module only narrows the catalog to models that can write text.
//
// Discovery is informational: the Gateway still admits or refuses every call
// itself. Checking the requested id against the catalog just turns a typo or a
// stale page into a clear 400 before any spend.

export interface ModelOption {
  id: string;
  label: string;
  recommended: boolean;
  /** The catalog's `reasoning` capability. Drives `reasoningPolicy` below. */
  reasoning: boolean;
}

export interface ModelList {
  models: ModelOption[];
  defaultModel: string;
  /** False when the catalog could not be read and only the fallback is offered. */
  live: boolean;
}

// Offered alone when the catalog is unreachable, so generation still works.
// The Gateway's top recommended text model on 2026-09-20.
export const FALLBACK_MODEL: ModelOption = { id: "deepseek-v4-flash-0731", label: "DeepSeek V4 Flash", recommended: true, reasoning: true };

const CACHE_MS = 60_000;
let cached: { at: number; list: ModelList } | null = null;

function writesText(entry: CailModelCatalogEntry): boolean {
  return entry.status === "active" && entry.capabilities.includes("text-generation");
}

export function modelListFrom(entries: CailModelCatalogEntry[]): ModelList | null {
  const models = entries
    .filter(writesText)
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      id: entry.id,
      label: entry.name ?? entry.id,
      recommended: entry.recommended,
      reasoning: entry.capabilities.includes("reasoning"),
    }));
  const first = models[0];
  if (first === undefined) return null;
  return { models, defaultModel: (models.find((m) => m.recommended) ?? first).id, live: true };
}

export async function loadModels(client: CailClient, now = Date.now()): Promise<ModelList> {
  if (cached !== null && now - cached.at < CACHE_MS) return cached.list;
  try {
    const list = modelListFrom((await client.getCatalogSnapshot({ modality: "text" })).data);
    if (list !== null) {
      cached = { at: now, list };
      return list;
    }
  } catch {
    // Fall through: an unreachable catalog must not take generation down.
  }
  // A failure is not cached, so the next request tries the catalog again.
  return { models: [FALLBACK_MODEL], defaultModel: FALLBACK_MODEL.id, live: false };
}

/** For tests: forget the per-isolate catalog cache. */
export function resetModelCache(): void {
  cached = null;
}

/**
 * What a reasoning model needs in order to answer at all.
 *
 * A reasoning model spends output tokens thinking before it writes. Measured
 * against the live Gateway on 2026-09-20 with the 500-token Wordle request:
 * six of the seven recommended models returned nothing, having spent the whole
 * budget on reasoning (450 to 3,400 tokens for a fifteen-word list). Only the
 * non-reasoning model answered.
 *
 * - Headroom is the fix that worked for all six. It is added on top of what the
 *   section asked for, and only tokens actually produced are charged. More is
 *   not better: at 8,500 one model reasoned past a two-minute timeout.
 * - The two switches are an economy, not a fix. Each is honored by some models
 *   and ignored by others (`enable_thinking: false` cut the default model from
 *   457 tokens to 45; another ignored it entirely), and none rejected them.
 * - They must never reach a non-reasoning model: one answered them with
 *   `400 capability_unsupported`. Hence the catalog flag, not a blanket rule.
 * - They must not be sent when the task needs the thinking. Counting letters
 *   does: asked for thirty five-letter Russian words, the default model gave
 *   30 valid of 30 with thinking on, three times out of three, and 6, 9 and 16
 *   with it off. So the caller says whether a section wants reasoning. It then
 *   costs about twenty times the tokens (roughly 3,000) and forty seconds
 *   instead of four, which is why only the Wordle section asks for it.
 */
export const REASONING_HEADROOM_TOKENS = 4000;
/** Thinking left on used up to 3,559 tokens on that task; 4,000 is too close. */
export const REASONING_WANTED_HEADROOM_TOKENS = 8000;

export function reasoningPolicy(model: ModelOption, wantsReasoning: boolean): { headroom: number; extraBody: Record<string, unknown> } {
  if (!model.reasoning) return { headroom: 0, extraBody: {} };
  if (wantsReasoning) return { headroom: REASONING_WANTED_HEADROOM_TOKENS, extraBody: {} };
  return {
    headroom: REASONING_HEADROOM_TOKENS,
    extraBody: { chat_template_kwargs: { enable_thinking: false }, reasoning_effort: "low" },
  };
}

// Bounds on one generation call. The largest section the frontend asks for is
// 6000 output tokens (verb tenses); the prompts are a few hundred words.
export const MAX_PROMPT_CHARS = 8000;
export const MAX_OUTPUT_TOKENS = 8192;

// The same system message the browser sends to its own providers
// (callLLM in public/js/content-generator.js). Keep the two in step.
export const SYSTEM_PROMPT =
  "You are a language education expert. Generate educational content exactly as requested. Always return valid JSON with no additional text or formatting.";
