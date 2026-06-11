/**
 * ABSA contract — TypeScript types, JSON Schema (for OpenAI Structured Outputs),
 * and a lightweight runtime validator.
 *
 * DESIGN NOTES
 * ─────────────
 * • severity_final is NOT in AbsaAspect. The ABSA service enriches the
 *   LLM output by calling deriveSeverity() and attaches severity_final
 *   before writing to echo-backend. severity_hint is LLM-produced.
 * • subcategory is an open string — LLM may emit keys not in SUBCATEGORY_META.
 *   The validator records these as warnings (not hard failures) so novel
 *   subcategories can be reviewed and promoted to the taxonomy later.
 * • target_text and concept_key are nullable. In OpenAI strict mode,
 *   nullable fields use anyOf: [{type: X}, {type: "null"}].
 * • All fields are required (no optional) — OpenAI strict mode mandates this.
 *   Fields that may be absent use null as their empty value.
 */

import type { CategoryKey } from '@talkwo/echo-core';
import { CATEGORY_LIST, SUBCATEGORY_MAP } from '@talkwo/echo-core';

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'mixed';
export type SeverityHint   = 'low' | 'medium' | 'high' | 'critical';

export interface AbsaAspect {
  /** One of the 14 CategoryKey values. */
  category:       CategoryKey;
  /** Subcategory key (English snake_case). May be a runtime LLM value. */
  subcategory:    string;
  /** Coarse sentiment direction. */
  sentiment:      SentimentLabel;
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
  /**
   * Whitelist concept key if the aspect maps to a known concept. null otherwise.
   * Phase 2: populated from a concept whitelist; MVP: always null, populated post-hoc.
   */
  concept_key:    string | null;
  /** LLM-provided severity estimate. Backend derives severity_final deterministically. */
  severity_hint:  SeverityHint;
  /** Critical concept flags. Used by deriveSeverity() to force 'critical'. */
  critical_flags: string[];
}

export interface AbsaOutput {
  /** All aspects extracted from the review. May be empty for spam / off-topic text. */
  aspects:           AbsaAspect[];
  /** Review-level overall sentiment — a summary across all aspects. */
  overall_sentiment: SentimentLabel;
  /**
   * When aspects is empty: a brief reason (e.g. "text too short", "off-topic",
   * "no hotel aspects detected"). null when aspects is non-empty.
   */
  no_aspect_reason:  string | null;
}

// ─── Category key enum list (derived from shared package) ────────────────────

const CATEGORY_KEYS: CategoryKey[] = CATEGORY_LIST.map(c => c.key);

// ─── JSON Schema for OpenAI Structured Outputs (strict mode) ─────────────────
//
// Rules for strict mode:
//   • All object properties must appear in `required`.
//   • additionalProperties: false on all objects.
//   • Nullable via anyOf: [{type: X}, {type: "null"}].
//   • No default values, no if/then/else at root.
//   • $defs and $ref are supported (used here for AbsaAspect to avoid repetition).

export const ABSA_OUTPUT_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  name: 'absa_output',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['aspects', 'overall_sentiment', 'no_aspect_reason'],
    $defs: {
      AbsaAspect: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category', 'subcategory', 'sentiment', 'polarity', 'intensity',
          'confidence', 'excerpt', 'target_text', 'concept_key',
          'severity_hint', 'critical_flags'
        ],
        properties: {
          category: {
            type: 'string',
            enum: CATEGORY_KEYS
          },
          subcategory: {
            type: 'string',
            description: 'English snake_case subcategory key from the taxonomy, or a new LLM-generated key.'
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral', 'mixed']
          },
          polarity: {
            type: 'number',
            minimum: -1,
            maximum: 1,
            description: 'Continuous polarity. Negative value = bad experience.'
          },
          intensity: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Strength of the expressed feeling.'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Model certainty about this aspect assignment.'
          },
          excerpt: {
            type: 'string',
            maxLength: 80,
            description: 'Verbatim quote from the review, original language, ≤80 chars.'
          },
          target_text: {
            anyOf: [
              { type: 'string', maxLength: 100 },
              { type: 'null' }
            ],
            description: 'Specific entity mentioned (e.g. "klima"). null if unspecified.'
          },
          concept_key: {
            anyOf: [
              { type: 'string' },
              { type: 'null' }
            ],
            description: 'Whitelist concept key if matched. null otherwise.'
          },
          severity_hint: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'LLM severity estimate. Backend will derive severity_final deterministically.'
          },
          critical_flags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Critical concept flags, e.g. ["food_poisoning", "theft"]. Empty array if none.'
          }
        }
      }
    },
    properties: {
      aspects: {
        type: 'array',
        items: { $ref: '#/schema/$defs/AbsaAspect' },
        description: 'All aspects extracted. Empty array for off-topic or non-extractable text.'
      },
      overall_sentiment: {
        type: 'string',
        enum: ['positive', 'negative', 'neutral', 'mixed'],
        description: 'Review-level overall sentiment.'
      },
      no_aspect_reason: {
        anyOf: [
          { type: 'string', maxLength: 200 },
          { type: 'null' }
        ],
        description: 'Reason for empty aspects array. null when aspects is non-empty.'
      }
    }
  }
} as const;

// ─── Runtime validator ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors:   string[];
  warnings: string[];
}

const SENTIMENT_LABELS  = new Set<string>(['positive', 'negative', 'neutral', 'mixed']);
const SEVERITY_HINTS    = new Set<string>(['low', 'medium', 'high', 'critical']);
const CATEGORY_KEY_SET  = new Set<string>(CATEGORY_KEYS);

/**
 * Validate a parsed AbsaOutput object.
 *
 * • Errors  → hard failures; item should be retried or dead-lettered.
 * • Warnings → soft issues; output can still be written but should be logged.
 *   Common warning: subcategory key not found in SUBCATEGORY_META
 *   (novel key from LLM — may be worth promoting to taxonomy).
 */
export function validateAbsaOutput(raw: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ['root is not an object'], warnings };
  }

  const out = raw as Record<string, unknown>;

  // overall_sentiment
  if (!SENTIMENT_LABELS.has(out['overall_sentiment'] as string)) {
    errors.push(`invalid overall_sentiment: ${out['overall_sentiment']}`);
  }

  // no_aspect_reason
  if (out['no_aspect_reason'] !== null && typeof out['no_aspect_reason'] !== 'string') {
    errors.push('no_aspect_reason must be string or null');
  }

  // aspects
  if (!Array.isArray(out['aspects'])) {
    errors.push('aspects must be an array');
    return { valid: false, errors, warnings };
  }

  const aspects = out['aspects'] as unknown[];

  for (let i = 0; i < aspects.length; i++) {
    const a = aspects[i];
    const prefix = `aspects[${i}]`;

    if (typeof a !== 'object' || a === null) {
      errors.push(`${prefix} is not an object`);
      continue;
    }

    const aspect = a as Record<string, unknown>;

    // category
    if (!CATEGORY_KEY_SET.has(aspect['category'] as string)) {
      errors.push(`${prefix}.category invalid: "${aspect['category']}"`);
    }

    // subcategory
    if (typeof aspect['subcategory'] !== 'string' || aspect['subcategory'].trim() === '') {
      errors.push(`${prefix}.subcategory must be a non-empty string`);
    } else {
      // Category-subcategory pair check
      const subMeta = SUBCATEGORY_MAP.get(aspect['subcategory'] as string);
      if (!subMeta) {
        warnings.push(`${prefix}.subcategory "${aspect['subcategory']}" not in SUBCATEGORY_META (novel LLM key)`);
      } else if (subMeta.category !== aspect['category']) {
        errors.push(
          `${prefix} category-subcategory mismatch: ` +
          `subcategory "${aspect['subcategory']}" belongs to ${subMeta.category}, ` +
          `not ${aspect['category']}`
        );
      }
    }

    // sentiment
    if (!SENTIMENT_LABELS.has(aspect['sentiment'] as string)) {
      errors.push(`${prefix}.sentiment invalid: "${aspect['sentiment']}"`);
    }

    // polarity
    const polarity = aspect['polarity'] as number;
    if (typeof polarity !== 'number' || polarity < -1 || polarity > 1) {
      errors.push(`${prefix}.polarity must be number in [-1, 1], got: ${polarity}`);
    }

    // intensity
    const intensity = aspect['intensity'] as number;
    if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
      errors.push(`${prefix}.intensity must be number in [0, 1], got: ${intensity}`);
    }

    // confidence
    const confidence = aspect['confidence'] as number;
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      errors.push(`${prefix}.confidence must be number in [0, 1], got: ${confidence}`);
    }

    // excerpt
    if (typeof aspect['excerpt'] !== 'string') {
      errors.push(`${prefix}.excerpt must be a string`);
    } else if ((aspect['excerpt'] as string).length > 80) {
      warnings.push(`${prefix}.excerpt exceeds 80 chars (${(aspect['excerpt'] as string).length})`);
    }

    // target_text
    if (aspect['target_text'] !== null && typeof aspect['target_text'] !== 'string') {
      errors.push(`${prefix}.target_text must be string or null`);
    }

    // concept_key
    if (aspect['concept_key'] !== null && typeof aspect['concept_key'] !== 'string') {
      errors.push(`${prefix}.concept_key must be string or null`);
    }

    // severity_hint
    if (!SEVERITY_HINTS.has(aspect['severity_hint'] as string)) {
      errors.push(`${prefix}.severity_hint invalid: "${aspect['severity_hint']}"`);
    }

    // critical_flags
    if (!Array.isArray(aspect['critical_flags'])) {
      errors.push(`${prefix}.critical_flags must be an array`);
    } else {
      for (const flag of aspect['critical_flags'] as unknown[]) {
        if (typeof flag !== 'string') {
          errors.push(`${prefix}.critical_flags contains non-string value`);
        }
      }
    }
  }

  // Cross-field: no_aspect_reason should be null when aspects is non-empty
  if (aspects.length > 0 && out['no_aspect_reason'] !== null) {
    warnings.push('no_aspect_reason is non-null but aspects is non-empty — consider setting to null');
  }
  if (aspects.length === 0 && out['no_aspect_reason'] === null) {
    warnings.push('aspects is empty but no_aspect_reason is null — expected a reason');
  }

  return { valid: errors.length === 0, errors, warnings };
}
