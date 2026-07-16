/**
 * Scoring utilities — polarity-based model (v2.6).
 *
 * ⚠ Per LAD-1: scoring is BACKEND-AUTHORITATIVE. The functions below are
 * a reference implementation of the contract — useful for client-side
 * what-if scenarios and as executable documentation — but they are NOT
 * used to compute the values the user sees in production. Live values come
 * from backend-computed snapshots (Mongo/Redis) and are consumed as-is.
 *
 * Only the presentation helpers (gpiZone, rpiLabel) are used in the render path.
 */

import { CATEGORY_LIST, SUBCATEGORY_MAP } from './categories.js';
import type {
  CategoryKey,
  CategoryScore,
  CompetitorScore,
  SentimentDistribution,
  SentimentItem
} from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Below this mention count, subcategory scores return null (too noisy). */
export const MIN_MENTIONS_FOR_SCORE = 5;

const BAYESIAN_PRIOR = 75;
const BAYESIAN_K = 15;

/**
 * Soft attribution thresholds (anti-over-split scoring).
 *
 * When the ABSA model emits multiple aspects within the same category for one
 * review (e.g. FOOD/breakfast + FOOD/food_quality_taste from a single
 * breakfast sentence), naive counting double-counts the same signal and
 * inflates category scores.
 *
 * We instead distribute ONE "mention unit" per (review, category) across
 * all aspects in that category, weighted by confidence. Low-confidence
 * aspects and very small shares are dropped as noise.
 */
export const ATTRIBUTION_CONFIDENCE_FLOOR = 0.6;
export const ATTRIBUTION_SHARE_FLOOR      = 0.2;

/**
 * Category-rank damping factor (anti long-form bias).
 *
 * A review touching N categories should NOT contribute N× a review touching
 * one category. We rank a review's categories by confidence (most confident
 * first) and apply a diminishing factor to each subsequent category:
 *
 *   factor(rank) = 1 / (1 + DECAY × rank)    rank = 0, 1, 2, …
 *
 * With DECAY = 0.5:  rank0=1.00, rank1=0.67, rank2=0.50, rank3=0.40, rank4=0.33
 *
 * This damps the cross-category long-form bias (a 10-category review drops
 * from ~11× to ~4× an average single-category review) while still rewarding
 * detailed reviews more than terse ones. It does NOT touch the category-WEIGHT
 * axis (FOOD vs GENERAL importance) — that inequality is intentional.
 */
export const CATEGORY_RANK_DECAY = 0.5;

/**
 * Solo-category weight floor (anti low-weight-silencing).
 *
 * When a review mentions exactly ONE category, that category is the review's
 * entire signal. If that lone category is lightweight (e.g. GENERAL at 0.02),
 * a genuine "tek kelimeyle mükemmeldi" 5★ review contributes almost nothing
 * to GPI. To prevent silencing such reviews, a solo category's effective
 * weight is floored at the average GPI category weight.
 *
 * Heavy categories (FOOD 0.17, ROOM 0.17) are unaffected — max(w, avg) keeps
 * their own higher weight. Only light solo categories (SPA, GENERAL) get lifted.
 */
export const SOLO_CATEGORY_WEIGHT_FLOOR =
  CATEGORY_LIST.filter(c => c.inGpi).reduce((s, c) => s + c.weight, 0) /
  CATEGORY_LIST.filter(c => c.inGpi).length; // average inGpi weight ≈ 0.083

/**
 * Recency decay configuration.
 *
 * Design decision: operational score uses a 90-day half-life so recent
 * improvements surface quickly ("otelciye operasyonel aksiyon aldırmak").
 * A 12-month baseline exists for year-over-year comparison, but does NOT
 * affect the primary GPI shown to users.
 *
 * Approximate weights with 90-day half-life:
 *   today      → 1.00
 *   30 days    → 0.79
 *   90 days    → 0.50
 *   180 days   → 0.25
 *   365 days   → 0.06
 *
 * Volatility is controlled by MIN_MENTIONS_FOR_SCORE + Bayesian smoothing,
 * NOT by extending the half-life.
 */
export const RECENCY_CONFIG = {
  /** Primary half-life: operational + headline score. */
  operationalScoreHalfLifeDays: 90,
  /** Alias — same value, kept explicit for scoring functions. */
  headlineScoreHalfLifeDays:    90,
  /** Baseline window for year-over-year comparison (no decay, flat window). */
  annualBaselineWindowDays:     365,
  /** When true, backend computes same-period-last-year scores for seasonality. */
  samePeriodLastYearEnabled:    true,
} as const;

/**
 * Source weights — what share of signal weight each review origin carries.
 * GR Feedback excluded from GPI (operational signal only).
 * Phase 2: parametric per tenant (nationality & platform mix).
 */
export const SOURCE_WEIGHTS: Record<string, number> = {
  tripadvisor:  1.00,
  google:       1.00,
  booking:      1.00,
  holidaycheck: 0.95,
  survey:       0.85,
  gr_feedback:  0.00,
};

/**
 * Severity weight multipliers applied to mention_score.
 * Backend derives severity_final deterministically; these map that level
 * to a numeric multiplier.
 */
export const SEVERITY_WEIGHTS: Record<'low' | 'medium' | 'high' | 'critical', number> = {
  low:      0.80,
  medium:   1.10,
  high:     1.50,
  critical: 2.00,
};

/**
 * Score mix weights for the three use-cases.
 */
export const SCORE_WEIGHTS = {
  headlineExperienceScore: { normalizedRating: 0.70, aspectScore: 0.30 },
  operationalIssueRanking:  { ratingContext:   0.20, aspectSignals: 0.80 },
  caseRecommendation:       { ratingContext:   0.00, aspectSignals: 1.00 },
} as const;

// ─── Recency weight ───────────────────────────────────────────────────────────

export function getRecencyWeight(
  daysAgo: number,
  halfLifeDays = RECENCY_CONFIG.operationalScoreHalfLifeDays
): number {
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

// ─── Severity derivation (backend reference) ──────────────────────────────────

const CRITICAL_CONCEPTS = new Set([
  'food_poisoning', 'theft', 'harassment', 'food_safety', 'guest_safety',
]);

export function deriveSeverity(
  aspect: Pick<SentimentItem, 'intensity' | 'critical_flags' | 'parent_key' | 'subcategory' | 'severity_hint'>
): 'low' | 'medium' | 'high' | 'critical' {
  if (aspect.critical_flags?.some(f => CRITICAL_CONCEPTS.has(f))) return 'critical';
  // parent_key is the key into the 107-key taxonomy (SUBCATEGORY_MAP keeps its
  // historical name; parent_key is its lookup key). `subcategory` is the pre-v2 name.
  const subMeta = SUBCATEGORY_MAP.get(aspect.parent_key ?? aspect.subcategory ?? '');
  if (subMeta?.severityBase === 'critical') return 'critical';
  if (subMeta?.severityBase === 'high' && (aspect.intensity ?? 0) >= 0.6) return 'high';
  const intensity = aspect.intensity ?? 0;
  if (intensity >= 0.8) return 'high';
  if (intensity >= 0.5) return 'medium';
  return 'low';
}

// ─── Mention score ────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Soft attribution ────────────────────────────────────────────────────────

/** Minimal shape needed for attribution — a subset of SentimentItem. */
export interface AttributableAspect {
  category:   CategoryKey;
  subcategory: string;
  confidence: number;
}

/**
 * Distribute a single "mention unit" across multiple aspects within the same
 * category, weighted by confidence. Returns the original aspects augmented
 * with a `share ∈ (0, 1]` field that downstream scoring should multiply by.
 *
 * Algorithm:
 *   1. Drop aspects below ATTRIBUTION_CONFIDENCE_FLOOR (model not confident).
 *   2. Group remaining aspects by category.
 *   3. For each category, share = confidence / sum(confidences in category).
 *   4. Drop aspects whose share < ATTRIBUTION_SHARE_FLOOR (noise tail).
 *   5. Re-normalise shares within each category so they sum to 1.0.
 *
 * Why per-category (not global): different categories represent genuinely
 * different operational concerns — a review can validly raise both a FOOD
 * issue and a ROOM issue, so each category should keep its own 1.0 unit.
 * The over-split problem is intra-category, not cross-category.
 *
 * Why drop in two stages: confidence floor removes noisy aspects BEFORE
 * the normalisation, so they don't dilute the strong aspects' shares.
 * Share floor removes tail noise AFTER normalisation, then we re-normalise
 * so the remaining aspects sum to a clean 1.0 per category.
 */
export function distributeAttribution<T extends AttributableAspect>(
  reviewAspects: T[]
): Array<T & { share: number }> {
  // 1. Confidence floor
  const confident = reviewAspects.filter(a => a.confidence >= ATTRIBUTION_CONFIDENCE_FLOOR);
  if (confident.length === 0) return [];

  // 2-3. Group by category, compute initial shares
  const byCategory = new Map<CategoryKey, T[]>();
  for (const a of confident) {
    const bucket = byCategory.get(a.category) ?? [];
    bucket.push(a);
    byCategory.set(a.category, bucket);
  }

  const result: Array<T & { share: number }> = [];
  for (const aspects of byCategory.values()) {
    const totalConfidence = aspects.reduce((s, a) => s + a.confidence, 0);
    // initial shares
    const initial = aspects.map(a => ({
      aspect: a,
      share:  a.confidence / totalConfidence
    }));

    // 4. Share floor — drop tail noise
    const kept = initial.filter(x => x.share >= ATTRIBUTION_SHARE_FLOOR);
    if (kept.length === 0) {
      // Edge case: all shares below floor (e.g. 6 equally weak aspects → each ~0.17).
      // Keep the single highest-confidence aspect with share = 1.0.
      const top = initial.reduce((best, x) => x.share > best.share ? x : best);
      result.push({ ...top.aspect, share: 1.0 });
      continue;
    }

    // 5. Re-normalise within category so shares sum to 1.0
    const keptTotal = kept.reduce((s, x) => s + x.share, 0);
    for (const { aspect, share } of kept) {
      result.push({ ...aspect, share: share / keptTotal });
    }
  }

  return result;
}

/**
 * Apply diminishing-returns damping across categories within a single review.
 *
 * Input: aspects already carrying intra-category `share` (output of
 * distributeAttribution). Returns the same aspects with `share` multiplied by
 * a per-category rank factor, so a review touching many categories does not
 * scale its total contribution linearly.
 *
 * Ranking: categories are ordered by their strongest aspect's confidence
 * (the model's most certain signal leads). The leading category keeps full
 * weight (factor 1.0); each subsequent category is damped by
 * 1 / (1 + CATEGORY_RANK_DECAY × rank).
 *
 * Run order: distributeAttribution → applyCategoryRankDamping → computeMentionScore.
 */
export function applyCategoryRankDamping<T extends AttributableAspect & { share: number }>(
  reviewAspects: T[]
): T[] {
  if (reviewAspects.length === 0) return [];

  // Group by category, track each category's peak confidence
  const byCategory = new Map<CategoryKey, { aspects: T[]; peakConfidence: number }>();
  for (const a of reviewAspects) {
    const entry = byCategory.get(a.category) ?? { aspects: [], peakConfidence: 0 };
    entry.aspects.push(a);
    entry.peakConfidence = Math.max(entry.peakConfidence, a.confidence);
    byCategory.set(a.category, entry);
  }

  // Rank categories by peak confidence (descending) — most certain leads
  const rankedCategories = [...byCategory.values()].sort(
    (a, b) => b.peakConfidence - a.peakConfidence
  );

  const result: T[] = [];
  rankedCategories.forEach((entry, rank) => {
    const factor = 1 / (1 + CATEGORY_RANK_DECAY * rank);
    for (const aspect of entry.aspects) {
      result.push({ ...aspect, share: aspect.share * factor });
    }
  });

  return result;
}

/**
 * Resolve the GPI weight to use for a category WHEN aggregating one review.
 *
 * Normal case: returns the category's static GPI weight.
 * Solo case: if this review mentions exactly one category, a lightweight
 * category is floored at SOLO_CATEGORY_WEIGHT_FLOOR so a focused single-signal
 * review (e.g. "tek kelimeyle mükemmeldi" → GENERAL) is not silenced.
 *
 * `isSoloCategory` should be true when the review (after attribution) has
 * exactly one surviving category.
 */
export function resolveCategoryWeight(category: CategoryKey, isSoloCategory: boolean): number {
  const meta = CATEGORY_LIST.find(c => c.key === category);
  const baseWeight = meta?.weight ?? 0;
  if (!meta?.inGpi) return baseWeight; // informational/alert categories never boosted
  return isSoloCategory ? Math.max(baseWeight, SOLO_CATEGORY_WEIGHT_FLOOR) : baseWeight;
}

// ─── Mention score ────────────────────────────────────────────────────────────

export interface MentionScoreInput {
  polarity: number;
  intensity: number;
  confidence: number;
  severity_final: 'low' | 'medium' | 'high' | 'critical';
  subcategory: string;
  sourceType: string;
  daysAgo: number;
  /** Soft-attribution share within review×category. Defaults to 1.0
   *  (backward compatible when distributeAttribution is not run). */
  share?: number;
}

export function computeMentionScore(input: MentionScoreInput): number {
  const base = clamp(input.polarity * input.intensity, -1, 1);
  const severityWeight    = SEVERITY_WEIGHTS[input.severity_final] ?? 1.0;
  const subcategoryWeight = SUBCATEGORY_MAP.get(input.subcategory)?.weight ?? 1.0;
  const sourceWeight      = SOURCE_WEIGHTS[input.sourceType] ?? 1.0;
  const recencyWeight     = getRecencyWeight(input.daysAgo);
  const share             = input.share ?? 1.0;
  return base * input.confidence * severityWeight * subcategoryWeight * sourceWeight * recencyWeight * share;
}

// ─── Subcategory score ────────────────────────────────────────────────────────

export function computeSubcategoryScore(mentionScores: number[]): number | null {
  if (mentionScores.length < MIN_MENTIONS_FOR_SCORE) return null;
  const weightedPolarity = mentionScores.reduce((s, m) => s + m, 0) / mentionScores.length;
  return clamp(50 + 50 * weightedPolarity, 0, 100);
}

// ─── Category aspect score ────────────────────────────────────────────────────

export function computeCategoryAspectScore(
  subcategoryScores: Array<{ subcategoryKey: string; score: number | null }>
): number | null {
  let weightedSum = 0;
  let weightSum = 0;
  for (const { subcategoryKey, score } of subcategoryScores) {
    if (score === null) continue;
    const weight = SUBCATEGORY_MAP.get(subcategoryKey)?.weight ?? 1.0;
    weightedSum += score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? null : weightedSum / weightSum;
}

// ─── Overall GPI ─────────────────────────────────────────────────────────────

export function computeOverallGpi(categoryScores: CategoryScore[]): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const cs of categoryScores) {
    const meta = CATEGORY_LIST.find(c => c.key === cs.category);
    if (!meta || !meta.inGpi) continue;
    if (cs.aspectScore === null) continue;
    weightedSum += cs.aspectScore * meta.weight;
    weightSum += meta.weight;
  }
  if (weightSum === 0) return BAYESIAN_PRIOR;
  return bayesianSmooth(weightedSum / weightSum, categoryScores.length);
}

// ─── Bayesian smoothing ───────────────────────────────────────────────────────

export function bayesianSmooth(rawScore: number, n: number): number {
  return (n * rawScore + BAYESIAN_K * BAYESIAN_PRIOR) / (n + BAYESIAN_K);
}

// ─── RPI ─────────────────────────────────────────────────────────────────────

export function computeRpi(hotelGpi: number, competitors: CompetitorScore[]): number | null {
  if (competitors.length === 0) return null;
  const avgGpi = competitors.reduce((s, c) => s + c.gpi, 0) / competitors.length;
  if (avgGpi === 0) return null;
  return (hotelGpi / avgGpi) * 100;
}

// ─── Polarity distribution (5-bucket histogram) ─────────────────────────────
//
// Continuous polarity [-1..+1] → 5 discrete buckets for UI rendering and
// quick "how is this category trending?" reads. Boundaries are deliberately
// asymmetric on the neutral band (0.2 vs 0.6) — pulled from spec §12.10.3
// "intensity = strength, not confidence" guidance: a polarity > 0.2 means
// the guest had a noticeable opinion, > 0.6 means strong.

export type PolarityBucket =
  | 'strong_negative'
  | 'negative'
  | 'neutral'
  | 'positive'
  | 'strong_positive';

export const POLARITY_BUCKET_BOUNDS = {
  strongNegativeMax: -0.6, // polarity ≤ this → strong_negative
  negativeMax:       -0.2, // polarity ≤ this → negative
  positiveMin:       +0.2, // polarity ≥ this → positive
  strongPositiveMin: +0.6  // polarity ≥ this → strong_positive
} as const;

export function polarityToBucket(polarity: number): PolarityBucket {
  if (polarity <= POLARITY_BUCKET_BOUNDS.strongNegativeMax) return 'strong_negative';
  if (polarity <= POLARITY_BUCKET_BOUNDS.negativeMax)       return 'negative';
  if (polarity >= POLARITY_BUCKET_BOUNDS.strongPositiveMin) return 'strong_positive';
  if (polarity >= POLARITY_BUCKET_BOUNDS.positiveMin)       return 'positive';
  return 'neutral';
}

/** Build a SentimentDistribution from a flat list of polarities. */
export function buildDistribution(polarities: number[]): SentimentDistribution {
  const dist: SentimentDistribution = {
    strongNegativeCount: 0,
    negativeCount:       0,
    neutralCount:        0,
    positiveCount:       0,
    strongPositiveCount: 0,
    meanPolarity:        0,
    stdDevPolarity:      null
  };
  if (polarities.length === 0) return dist;

  let sum = 0;
  for (const p of polarities) {
    sum += p;
    switch (polarityToBucket(p)) {
      case 'strong_negative': dist.strongNegativeCount++; break;
      case 'negative':        dist.negativeCount++;       break;
      case 'neutral':         dist.neutralCount++;        break;
      case 'positive':        dist.positiveCount++;       break;
      case 'strong_positive': dist.strongPositiveCount++; break;
    }
  }
  dist.meanPolarity = sum / polarities.length;

  if (polarities.length >= 2) {
    const mean = dist.meanPolarity;
    const variance =
      polarities.reduce((s, p) => s + (p - mean) ** 2, 0) / polarities.length;
    dist.stdDevPolarity = Math.sqrt(variance);
  }
  return dist;
}

// ─── Headline score ───────────────────────────────────────────────────────────

export function computeHeadlineScore(
  avgStars: number,
  aspectScore: number | null,
  mix = SCORE_WEIGHTS.headlineExperienceScore
): number {
  const normalizedRating = ((avgStars - 1) / 4) * 100;
  if (aspectScore === null) return normalizedRating;
  return mix.normalizedRating * normalizedRating + mix.aspectScore * aspectScore;
}

// ─── Presentation helpers (used in render path — not scoring) ─────────────────

export type GpiZone = 'green' | 'yellow' | 'red';

// Bands for the PURE-ASPECT scale (2026-07, GPI_SAF_ASPECT_PLAN.md). GPI is no longer the
// star-anchored headline (~74) — it's the aspect score (venue ~57-71, per-category ~31-73),
// so the old 85/70 bands painted everything red. New bands, calibrated to the real
// distribution: ≥65 green (strong), ≥55 yellow (average), <55 red (needs attention). Used
// for the venue GPI headline AND per-category cells (both aspect-scale). Revisit when the
// venue mix widens beyond resort hotels (all currently 4★+).
export function gpiZone(gpi: number): GpiZone {
  if (gpi >= 65) return 'green';
  if (gpi >= 55) return 'yellow';
  return 'red';
}

export function rpiLabel(rpi: number): string {
  if (rpi >= 110) return 'Çok İyi';
  if (rpi >= 100) return 'Ortanın Üstü';
  if (rpi >= 90)  return 'Ortada';
  return 'Gelişim Gerekli';
}
