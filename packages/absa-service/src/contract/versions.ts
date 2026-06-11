/**
 * Contract version constants — single source of truth for ABSA versioning.
 *
 * Bump rules:
 *   PROMPT_VERSION   → any change to system/user prompt wording or structure
 *   TAXONOMY_VERSION → any change to CategoryKey enum, subcategory keys, or
 *                      disambiguation rules in @talkwo/echo-core/categories.ts
 *   SCHEMA_VERSION   → any change to AbsaOutput / AbsaAspect shape (added/removed fields)
 *   ABSA_MODEL       → when switching OpenAI model
 *
 * All four values are stored on every AbsaBatch and AbsaBatchItem record so
 * outputs from different prompt/taxonomy combinations can be queried separately.
 * Never re-use a version string for different content.
 */

export const PROMPT_VERSION    = 'absa_prompt_v1.0.0'    as const;
export const TAXONOMY_VERSION  = 'resort_taxonomy_v1.0.0' as const;
export const SCHEMA_VERSION    = 'absa_schema_v1'         as const;
export const ABSA_MODEL        = 'gpt-4o-mini'            as const;

/** OpenAI Batch API endpoint — all requests in one batch must use the same endpoint. */
export const ABSA_ENDPOINT     = '/v1/chat/completions'   as const;

/** Maximum input character length before a review is flagged for chunking. */
export const MAX_INPUT_CHARS   = 8_000                    as const;

/** Minimum input character length — shorter texts are skipped (noise). */
export const MIN_INPUT_CHARS   = 20                       as const;

/** Minimum aspect confidence to accept from LLM output. */
export const MIN_ASPECT_CONFIDENCE = 0.40                 as const;

/** Max retry attempts before a batch item is moved to dead_letter. */
export const MAX_RETRY_ATTEMPTS = 3                       as const;

export type PromptVersion   = typeof PROMPT_VERSION;
export type TaxonomyVersion = typeof TAXONOMY_VERSION;
export type SchemaVersion   = typeof SCHEMA_VERSION;
