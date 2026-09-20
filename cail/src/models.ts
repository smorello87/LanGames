// The server owns the model list: the browser may only name one of these.
// IDs are CAIL Gateway's prefix-free canonical IDs; all are open-weight,
// multilingual chat models on the Gateway's recommended tier (checked against
// GET /v1/catalog on 2026-09-20). Re-check that catalog before editing.
export const MODELS = [
  { id: "deepseek-v4-flash-0731", label: "DeepSeek V4 Flash (fast — recommended)" },
  { id: "gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "qwen3.8-27b", label: "Qwen 3.8 27B" },
  { id: "mistral-large-3-675b-instruct", label: "Mistral Large 3" },
] as const;

export const DEFAULT_MODEL = "deepseek-v4-flash-0731";

const MODEL_IDS = new Set<string>(MODELS.map((m) => m.id));

export function isAllowedModel(id: unknown): id is string {
  return typeof id === "string" && MODEL_IDS.has(id);
}

// Bounds on one generation call. The largest section the frontend asks for is
// 6000 output tokens (verb tenses); the prompts are a few hundred words.
export const MAX_PROMPT_CHARS = 8000;
export const MAX_OUTPUT_TOKENS = 8192;

// The same system message the browser sends to its own providers
// (callLLM in public/js/content-generator.js). Keep the two in step.
export const SYSTEM_PROMPT =
  "You are a language education expert. Generate educational content exactly as requested. Always return valid JSON with no additional text or formatting.";
