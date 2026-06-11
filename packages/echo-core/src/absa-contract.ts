/**
 * ABSA contract types — shared between absa-service and echo-backend.
 *
 * These are the types that cross service boundaries:
 *   • absa-service produces AbsaOutput from OpenAI Structured Outputs
 *   • echo-backend consumes AbsaOutput, enriches it → SentimentItem (types.ts)
 *
 * SCOPE RULE
 * ──────────
 * Only pure data-shape types live here. Service-specific concerns stay in
 * their own packages:
 *   • ABSA_OUTPUT_JSON_SCHEMA  → absa-service (OpenAI Structured Outputs contract)
 *   • validateAbsaOutput()     → absa-service (runtime LLM output validation)
 *   • deriveSeverity()         → scoring.ts (backend enrichment, not LLM output)
 *
 * RELATIONSHIP TO SentimentItem (types.ts)
 * ─────────────────────────────────────────
 * AbsaAspect is what the LLM emits — no enriched fields.
 * SentimentItem is the fully enriched form:
 *   LLM fields (AbsaAspect) + concept_key (whitelist lookup)
 *                            + severity_final (deriveSeverity)
 *                            + severity_weight, subcategory_weight, source_weight
 *                            + recency_weight, mention_score
 *                            + case_recommended, case_department
 */

import type { CategoryKey, Sentiment } from './types.js';

// ─── Named types ──────────────────────────────────────────────────────────────

/** Severity level as estimated by the LLM (hint only).
 *  Backend derives `severity_final` deterministically via `deriveSeverity()`. */
export type SeverityHint = 'low' | 'medium' | 'high' | 'critical';

// Note: SentimentLabel is intentionally an alias of Sentiment (same union).
// Kept as a re-export alias so absa-service code reads naturally.
export type { Sentiment as SentimentLabel };

// ─── AbsaAspect ───────────────────────────────────────────────────────────────

/**
 * A single sentiment aspect as produced by the LLM.
 *
 * All fields are required (no optional/undefined) — this reflects OpenAI
 * strict-mode structured outputs where every field must be present.
 * Fields that conceptually can be absent use `null` as their empty value.
 *
 * severity_final is NOT here — that's a backend-derived enrichment.
 * concept_key    is NOT here — that's applied by whitelist lookup post-LLM.
 */
export interface AbsaAspect {
  /** One of the 14 CategoryKey values. */
  category:       CategoryKey;
  /** Subcategory key (English snake_case). May be a novel LLM-generated key. */
  subcategory:    string;
  /** Coarse sentiment direction. */
  sentiment:      Sentiment;
  /** Continuous polarity [-1..+1]. Negative = bad experience, positive = good. */
  polarity:       number;
  /** Strength of the expressed feeling [0..1]. */
  intensity:      number;
  /** LLM certainty [0..1]. Aspects below MIN_ASPECT_CONFIDENCE are filtered. */
  confidence:     number;
  /** Verbatim excerpt from the review text, ≤80 chars, original language. */
  excerpt:        string;
  /** Specific entity the guest mentioned (e.g. "klima", "duş başlığı"). null if unspecified. */
  target_text:    string | null;
  /** LLM-provided severity estimate. Backend derives severity_final deterministically. */
  severity_hint:  SeverityHint;
  /** Critical concept flags (e.g. ["food_poisoning", "theft"]). Empty array if none. */
  critical_flags: string[];
}

// ─── AbsaOutput ───────────────────────────────────────────────────────────────

/**
 * Top-level output for a single review from the ABSA LLM call.
 * This is the shape validated by `validateAbsaOutput()` in absa-service.
 */
export interface AbsaOutput {
  /** All aspects extracted from the review. Empty for spam / off-topic text. */
  aspects:           AbsaAspect[];
  /** Review-level overall sentiment — a summary across all aspects. */
  overall_sentiment: Sentiment;
  /**
   * When aspects is empty: a brief reason (e.g. "text too short", "off-topic",
   * "no hotel aspects detected"). null when aspects is non-empty.
   */
  no_aspect_reason:  string | null;
}

// ─── ReviewCandidate ─────────────────────────────────────────────────────────

/**
 * Shape returned by GET /v1/reviews/absa-candidates on echo-backend.
 * absa-service fetches these and maps them into BatchInputItem for the pipeline.
 *
 * Notes:
 *   • `id` is the native echo-backend ID — runner maps it to `sourceId` in BatchInputItem.
 *   • `source_text_hash` is NOT here — it's computed locally via textHash(text).
 *   • `source` ('review'|'survey') is NOT here — it's hardcoded in runner per endpoint.
 */
export interface ReviewCandidate {
  /** Native review ID from echo-backend. */
  id:            string;
  /** Owning tenant. */
  tenantKey:     string;
  /** Venue this review belongs to. */
  venueId:       string;
  /** Platform origin (e.g. 'tripadvisor', 'google', 'holidaycheck'). */
  platform:      string;
  /** Review title (may be empty string). */
  title:         string;
  /** Full review body text. */
  text:          string;
  /** ISO 639-1 language code as detected by echo-backend. */
  lang:          string;
  /** Normalized star rating 1–5. */
  rating:        number;
  /** ISO date string — publication date, used for recency weight. */
  publishedDate: string;
}
