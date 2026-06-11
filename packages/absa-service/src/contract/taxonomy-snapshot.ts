/**
 * taxonomy-snapshot.ts
 *
 * Renders the live @talkwo/echo-core taxonomy into prompt-ready strings.
 * Imported by prompt/system.ts — NOT by batch/builder.ts at runtime.
 *
 * WHY DYNAMIC (not hardcoded):
 *   Keeps taxonomy and prompt in sync via a single source of truth.
 *   When TAXONOMY_VERSION is bumped in versions.ts, the prompt automatically
 *   reflects the updated categories/subcategories on the next build.
 *
 * The rendered strings are module-level constants so they are computed once
 * at startup, not per-request.
 */

import {
  CATEGORY_LIST,
  SUBCATEGORY_META,
  DISAMBIGUATION_RULES
} from '@talkwo/echo-core';

// ─── Category + subcategory block ─────────────────────────────────────────────
//
// Format used in system prompt:
//   FOOD (Food & Beverage) [GPI weight: 17%]
//     subcategories: breakfast, restaurant_general, food_quality_taste, ...
//
// LOCATION and SECURITY get a note explaining their special role.

function renderCategoryBlock(): string {
  const lines: string[] = [];

  for (const cat of CATEGORY_LIST) {
    const weightStr = cat.inGpi
      ? `[GPI weight: ${(cat.weight * 100).toFixed(0)}%]`
      : cat.alertOnly
        ? '[ALERT ONLY — not scored, triggers immediate alert]'
        : '[INFORMATIONAL — not scored, record but do not include in sentiment score]';

    lines.push(`${cat.key} (${cat.labelEn}) ${weightStr}`);

    // Subcategories for this category (canonical keys only — skip aliases)
    const subs = SUBCATEGORY_META
      .filter(s => s.category === cat.key)
      .map(s => s.key);

    if (subs.length > 0) {
      lines.push(`  subcategories: ${subs.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function renderDisambiguationRules(): string {
  return DISAMBIGUATION_RULES
    .map((r, i) => {
      const exclude = r.excludeCategories.length > 0
        ? ` (NOT ${r.excludeCategories.join(' / ')})`
        : '';
      const rationale = r.rationale ? ` — ${r.rationale}` : '';
      return `${i + 1}. "${r.pattern}" → ${r.category}/${r.subcategory}${exclude}${rationale}`;
    })
    .join('\n');
}

/**
 * Rendered category taxonomy block, ready for injection into the system prompt.
 * Example:
 *   FOOD (Food & Beverage) [GPI weight: 17%]
 *     subcategories: breakfast, restaurant_general, ...
 */
export const TAXONOMY_CATEGORY_BLOCK: string = renderCategoryBlock();

/**
 * Rendered disambiguation rules, ready for injection into the system prompt.
 */
export const TAXONOMY_DISAMBIGUATION_BLOCK: string = renderDisambiguationRules();

/**
 * Flat sorted list of all canonical subcategory keys across all categories.
 * Used in the prompt to tell the model which keys exist. Novel keys are allowed
 * but these are the preferred ones.
 */
export const ALL_SUBCATEGORY_KEYS: readonly string[] = Object.freeze(
  SUBCATEGORY_META.map(s => s.key)
);

/**
 * Mapping from category key → its canonical subcategory keys.
 * Used in schema validation and prompt construction.
 */
export const SUBCATEGORY_KEYS_BY_CATEGORY: Readonly<Record<string, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      CATEGORY_LIST.map(cat => [
        cat.key,
        Object.freeze(SUBCATEGORY_META.filter(s => s.category === cat.key).map(s => s.key))
      ])
    )
  );
