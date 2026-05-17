/**
 * Mock-only helpers for filtering MOCK_REVIEWS by category, sentiment,
 * etc. In production these filter operations live server-side
 * (GET /v1/reviews?category=...&sentiment=...). Mock equivalents here
 * so frontend can render realistic filtered views without a backend.
 */

import { MOCK_REVIEWS } from './reviews.js';
import type { CategoryKey, Review, Sentiment } from '../types.js';

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
