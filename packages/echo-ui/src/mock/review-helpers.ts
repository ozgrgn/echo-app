/**
 * Mock-only helpers for filtering MOCK_REVIEWS by category, sentiment,
 * etc. In production these filter operations live server-side
 * (GET /v1/reviews?category=...&sentiment=...). Mock equivalents here
 * so frontend can render realistic filtered views without a backend.
 */

import { MOCK_REVIEWS } from './reviews.js';
import type {
  CategoryKey,
  Review,
  Sentiment,
  SentimentDistribution
} from '@talkwo/echo-core';
import { POLARITY_BUCKET_BOUNDS } from '@talkwo/echo-core';

export interface MockReviewFilters {
	category?: CategoryKey;
	subcategory?: string;
	sentiment?: Sentiment;
	lang?: string;
	platform?: string;
	hasOwnerResponse?: boolean;
}

/** Returns reviews where ANY sentiment item matches the filters. */
export function filterMockReviews(filters: MockReviewFilters): Review[] {
	return MOCK_REVIEWS.filter((review) => {
		if (filters.lang && review.lang !== filters.lang) return false;
		if (filters.platform && review.platform !== filters.platform) return false;
		if (filters.hasOwnerResponse !== undefined) {
			const has = !!review.ownerResponse;
			if (has !== filters.hasOwnerResponse) return false;
		}
		if (filters.category || filters.subcategory || filters.sentiment) {
			const matches = review.sentiments.some((s) => {
				if (filters.category && s.category !== filters.category) return false;
				if (filters.subcategory && s.subcategory !== filters.subcategory) return false;
				if (filters.sentiment && s.sentiment !== filters.sentiment) return false;
				return true;
			});
			if (!matches) return false;
		}
		return true;
	});
}

/** Available languages in mock data — for filter chip rendering. */
export function mockAvailableLanguages(): string[] {
	const set = new Set(MOCK_REVIEWS.map((r) => r.lang));
	return Array.from(set).sort();
}

/**
 * Synthesize a plausible polarity distribution for mock data.
 *
 * Given a target `mentionCount` and `meanPolarity` (typically derived from
 * the mock's aspectScore via `(aspectScore - 50) / 50`), produces a 5-bucket
 * histogram whose counts sum to `mentionCount` and whose weighted polarity
 * approximates `meanPolarity`. The distribution shape is a simple Gaussian
 * centered on `meanPolarity` with std-dev 0.4, discretized at the bucket
 * boundaries (§ POLARITY_BUCKET_BOUNDS).
 *
 * This is **mock-only**. In production the aggregation job sees real per-
 * mention polarities and builds the distribution exactly (via
 * `buildDistribution()` in scoring.ts).
 */
export function synthDistribution(
	mentionCount: number,
	meanPolarity: number,
	stdDev = 0.4
): SentimentDistribution {
	if (mentionCount <= 0) {
		return {
			strongNegativeCount: 0,
			negativeCount: 0,
			neutralCount: 0,
			positiveCount: 0,
			strongPositiveCount: 0,
			meanPolarity: 0,
			stdDevPolarity: null
		};
	}

	// Bucket midpoints (representative polarity for each bucket).
	const midpoints = {
		strong_negative: -0.8,
		negative: -0.4,
		neutral: 0.0,
		positive: 0.4,
		strong_positive: 0.8
	};

	// Gaussian PDF (un-normalized) for each bucket midpoint.
	const gauss = (x: number) =>
		Math.exp(-((x - meanPolarity) ** 2) / (2 * stdDev * stdDev));

	const raw = {
		strong_negative: gauss(midpoints.strong_negative),
		negative: gauss(midpoints.negative),
		neutral: gauss(midpoints.neutral),
		positive: gauss(midpoints.positive),
		strong_positive: gauss(midpoints.strong_positive)
	};
	const total = raw.strong_negative + raw.negative + raw.neutral + raw.positive + raw.strong_positive;

	// Floor each bucket, then distribute the remainder to whichever bucket lost
	// the most precision. Ensures sum = mentionCount exactly.
	const fractional = {
		strong_negative: (raw.strong_negative / total) * mentionCount,
		negative: (raw.negative / total) * mentionCount,
		neutral: (raw.neutral / total) * mentionCount,
		positive: (raw.positive / total) * mentionCount,
		strong_positive: (raw.strong_positive / total) * mentionCount
	};
	const counts = {
		strong_negative: Math.floor(fractional.strong_negative),
		negative: Math.floor(fractional.negative),
		neutral: Math.floor(fractional.neutral),
		positive: Math.floor(fractional.positive),
		strong_positive: Math.floor(fractional.strong_positive)
	};
	let remainder =
		mentionCount -
		(counts.strong_negative + counts.negative + counts.neutral + counts.positive + counts.strong_positive);

	const remainders = Object.entries(fractional)
		.map(([k, v]) => ({ key: k as keyof typeof counts, frac: v - Math.floor(v) }))
		.sort((a, b) => b.frac - a.frac);

	for (let i = 0; remainder > 0 && i < remainders.length; i++) {
		counts[remainders[i].key]++;
		remainder--;
	}

	// Recompute the actual mean from the bucket midpoints (close to but not
	// equal to the input meanPolarity — that's fine, it's mock data).
	const actualMean =
		(counts.strong_negative * midpoints.strong_negative +
			counts.negative * midpoints.negative +
			counts.neutral * midpoints.neutral +
			counts.positive * midpoints.positive +
			counts.strong_positive * midpoints.strong_positive) /
		mentionCount;

	return {
		strongNegativeCount: counts.strong_negative,
		negativeCount: counts.negative,
		neutralCount: counts.neutral,
		positiveCount: counts.positive,
		strongPositiveCount: counts.strong_positive,
		meanPolarity: Number(actualMean.toFixed(3)),
		stdDevPolarity: Number(stdDev.toFixed(3))
	};
}

/**
 * Convenience: derive a SentimentDistribution directly from an aspectScore.
 * Used by mock files to keep distribution consistent with the score they
 * hand-pick. `aspectScore` of 50 → meanPolarity 0; 75 → +0.5; 25 → -0.5.
 */
export function synthDistributionFromAspect(
	mentionCount: number,
	aspectScore: number | null,
	stdDev = 0.4
): SentimentDistribution {
	const safeScore = aspectScore ?? 50;
	const meanPolarity = (safeScore - 50) / 50;
	return synthDistribution(mentionCount, meanPolarity, stdDev);
}

// Re-export bucket bounds so callers don't need to import from scoring.js.
export { POLARITY_BUCKET_BOUNDS };
