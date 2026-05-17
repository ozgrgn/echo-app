/**
 * Scoring utilities.
 *
 * ⚠ Per LAD-1: scoring is BACKEND-AUTHORITATIVE. The functions below are
 * a reference implementation of the contract — useful for client-side
 * what-if scenarios and as executable documentation — but they are NOT
 * used to compute values the user sees in production. Live values come
 * from backend-computed snapshots (Mongo/Redis) and are consumed as-is.
 *
 * Only the presentation helpers (gpiZone, rpiLabel) are used in the
 * render path.
 */

import { CATEGORIES } from './categories.js';
import type {
  CategoryKey,
  CategoryScore,
  CompetitorScore,
  SentimentItem
} from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BAYESIAN_PRIOR = 75;
const BAYESIAN_K = 15;

// Source weights (GR Feedback is excluded from GPI — operational only)
export const SOURCE_WEIGHTS = {
  review:      1.00,
  survey:      0.85,
  gr_feedback: 0.00,   // NOT in GPI
} as const;

/**
 * Severity multipliers — per CATEGORY, not per subcategory.
 *
 * Applied when sentiment is negative: high-impact categories weigh more
 * in the final GPI computation. Calibrated so that:
 *   - FOOD/ROOM = 1.30 (most punishing — guests'in en hassas olduğu alan)
 *   - STAFF/FRONT = 1.15-1.20 (yüksek etki, gözle görülür)
 *   - POOL/FACILITY/VALUE = 1.00-1.10 (baseline)
 *   - ANIM/SPA/GENERAL = 0.75-0.85 (yumuşak — opsiyonel/sezonsal etki)
 *
 * Subcategory-level multipliers bilerek kaldırıldı; subcategory listesi
 * seed olarak yaşadığından (runtime'da LLM yeni key üretebilir) sabit
 * subcategory-level kalibrasyon dayanıklı değil. Category-level kalibrasyon
 * hem schema-stable hem business-meaningful.
 */
export const SEVERITY_MULTIPLIERS: Record<CategoryKey, number> = {
  FOOD:     1.30,
  ROOM:     1.30,
  STAFF:    1.20,
  FRONT:    1.15,
  POOL:     1.10,
  FACILITY: 1.00,
  VALUE:    1.00,
  GENERAL:  0.80,
  ANIM:     0.85,
  SPA:      0.75,
};

// ─── Sentiment weighting (YOUR INPUT NEEDED — see TODO below) ───────────────

/**
 * Convert a single SentimentItem into a numeric weight contribution for the
 * scoring aggregate. Called per-sentiment-per-review during the Bayesian
 * aggregation pipeline.
 *
 * Returns { positiveWeight, negativeWeight, neutralWeight } — exactly one
 * of these will typically be non-zero, summing to the item's effective
 * weight given its intensity + the SEVERITY_MULTIPLIERS lookup.
 *
 * @param item   The sentiment to weight
 * @returns      Triple of weight contributions
 *
 * Trade-off to consider:
 *   - "All sentiments equal" — return weight 1.0 regardless of intensity.
 *     Simpler, more forgiving, easier to explain to hotel users.
 *   - "Intensity-scaled" — weight by intensity (0..1). High-confidence
 *     negatives hurt more; weak negatives barely register.
 *   - "Intensity × severity multiplier on negatives" — combines both. The
 *     spec's SEVERITY_MULTIPLIERS table exists for this — `temizlik` (1.3×)
 *     is more punishing than `servis_hizi` (1.0×) when negative.
 *
 * The spec leaves the exact formula deliberately open here because it
 * encodes business judgment, not math. Your call.
 */
export function weightSentiment(item: SentimentItem): {
  positiveWeight: number;
  negativeWeight: number;
  neutralWeight: number;
} {
  // TODO: implement based on the trade-off you choose.
  // For now, returns equal-weight contribution as a placeholder so the
  // rest of the scoring pipeline compiles and runs.
  const w = 1.0;
  if (item.sentiment === 'positive') return { positiveWeight: w, negativeWeight: 0, neutralWeight: 0 };
  if (item.sentiment === 'negative') return { positiveWeight: 0, negativeWeight: w, neutralWeight: 0 };
  if (item.sentiment === 'mixed')    return { positiveWeight: w * 0.5, negativeWeight: w * 0.5, neutralWeight: 0 };
  return { positiveWeight: 0, negativeWeight: 0, neutralWeight: w };
}

// ─── Bayesian smoothing ───────────────────────────────────────────────────────

export function bayesianSmooth(rawScore: number, n: number): number {
  return (n * rawScore + BAYESIAN_K * BAYESIAN_PRIOR) / (n + BAYESIAN_K);
}

// ─── Category GPI ─────────────────────────────────────────────────────────────
// GPI = (1 - negWeighted / totalWeighted) × 100

export function computeCategoryGpi(
  positiveWeighted: number,
  negativeWeighted: number,
  neutralWeighted: number
): number {
  const total = positiveWeighted + negativeWeighted + neutralWeighted;
  if (total === 0) return BAYESIAN_PRIOR;
  return (1 - negativeWeighted / total) * 100;
}

// ─── Overall GPI ─────────────────────────────────────────────────────────────
// Weighted average of category GPIs

export function computeOverallGpi(categoryScores: CategoryScore[]): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const cs of categoryScores) {
    const meta = CATEGORIES[cs.category];
    weightedSum += cs.gpi * meta.weight;
    weightSum += meta.weight;
  }
  return weightSum === 0 ? 0 : weightedSum / weightSum;
}

// ─── RPI ─────────────────────────────────────────────────────────────────────
// RPI = (hotelGpi / competitorAvgGpi) × 100

export function computeRpi(hotelGpi: number, competitors: CompetitorScore[]): number | null {
  if (competitors.length === 0) return null;
  const avgGpi = competitors.reduce((s, c) => s + c.gpi, 0) / competitors.length;
  if (avgGpi === 0) return null;
  return (hotelGpi / avgGpi) * 100;
}

// ─── GPI color zone (presentation helper — used in render path) ─────────────

export type GpiZone = 'green' | 'yellow' | 'red';

export function gpiZone(gpi: number): GpiZone {
  if (gpi >= 85) return 'green';
  if (gpi >= 70) return 'yellow';
  return 'red';
}

export function rpiLabel(rpi: number): string {
  if (rpi >= 110) return 'Çok İyi';
  if (rpi >= 100) return 'Ortanın Üstü';
  if (rpi >= 90)  return 'Ortada';
  return 'Gelişim Gerekli';
}
