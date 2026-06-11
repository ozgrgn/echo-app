import type { CategoryKey, CategoryMeta, SubcategoryMeta } from './types.js';
import taxonomyData from './taxonomy.json' with { type: 'json' };

// ─── Taxonomy data source ─────────────────────────────────────────────────────
//
// The taxonomy (categories, subcategories, weights, labels, disambiguation
// rules) lives as DATA in ./taxonomy.json — NOT hardcoded here. This makes it
// "Redis-ready": the same JSON shape can be served from Redis at runtime so all
// services (ABSA, backend, frontend) read one source.
//
// This module loads taxonomy.json and derives the typed exports that the rest
// of the codebase already consumes (CATEGORY_LIST, SUBCATEGORY_META, etc.).
// The derived API is UNCHANGED — only the data source moved from code to JSON.
//
// Weights sum to 1.0 across inGpi:true categories only.
// Subcategory lists per category are SEED lists — not exhaustive enums.

interface TaxonomyCategory {
  key: string;
  label: string;
  labelEn: string;
  weight: number;
  inGpi: boolean;
  alertOnly?: boolean;
  informationalOnly?: boolean;
  primaryOwner: string;
  subcategories: string[];
}

interface TaxonomySubcategory {
  key: string;
  category: string;
  label: string;
  labelEn: string;
  weight: number;
  severityBase?: 'low' | 'medium' | 'high' | 'critical';
}

interface TaxonomyDisambiguationRule {
  pattern: string;
  category: string;
  subcategory: string;
  excludeCategories: string[];
  rationale?: string;
}

interface TaxonomyData {
  version: string;
  categories: TaxonomyCategory[];
  subcategories: TaxonomySubcategory[];
  disambiguationRules: TaxonomyDisambiguationRule[];
}

const TAXONOMY = taxonomyData as TaxonomyData;

/** Active taxonomy version (mirrors taxonomy.json `version`). */
export const TAXONOMY_DATA_VERSION = TAXONOMY.version;

// ─── Categories ───────────────────────────────────────────────────────────────

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = Object.fromEntries(
  TAXONOMY.categories.map(c => [c.key, c as CategoryMeta])
) as Record<CategoryKey, CategoryMeta>;

export const CATEGORY_LIST = Object.values(CATEGORIES);
export const GPI_CATEGORIES = CATEGORY_LIST.filter(c => c.inGpi);
// Sum of inGpi weights = 1.0 ✓
export const TOTAL_WEIGHT = GPI_CATEGORIES.reduce((s, c) => s + c.weight, 0);

// ─── Subcategory metadata ─────────────────────────────────────────────────────

export const SUBCATEGORY_META: SubcategoryMeta[] = TAXONOMY.subcategories as SubcategoryMeta[];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export const SUBCATEGORY_MAP = new Map(SUBCATEGORY_META.map(s => [s.key, s]));

export function getSubcategoryMeta(key: string): SubcategoryMeta | undefined {
  return SUBCATEGORY_MAP.get(key);
}

/**
 * Human-readable label for a subcategory key.
 * Default language is Turkish. Falls back to the raw key if unknown
 * (e.g. when the LLM produces a novel key not in the taxonomy).
 */
export function getSubcategoryLabel(key: string, lang: 'tr' | 'en' = 'tr'): string {
  const meta = SUBCATEGORY_MAP.get(key);
  if (!meta) return key;
  return lang === 'en' ? meta.labelEn : meta.label;
}

// ─── Disambiguation rules (ABSA system prompt input) ─────────────────────────
// Frontend does not consume these; single source of truth lives in taxonomy.json.

export interface DisambiguationRule {
  pattern: string;
  category: CategoryKey;
  subcategory: string;
  excludeCategories: CategoryKey[];
  rationale?: string;
}

export const DISAMBIGUATION_RULES: DisambiguationRule[] =
  TAXONOMY.disambiguationRules as DisambiguationRule[];
