import { CATEGORY_LIST, type CategoryKey } from '@talkwo/echo-core';
import { getHotelScore, filterMockReviews } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

// All valid category keys — derived from CATEGORY_LIST so it stays in sync
// automatically when new categories are added.
const VALID_CATEGORIES: CategoryKey[] = CATEGORY_LIST.map(c => c.key);

export async function load({ params }: { params: { category: string } }) {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const upperKey = params.category.toUpperCase() as CategoryKey;
	if (!VALID_CATEGORIES.includes(upperKey)) {
		throw error(404, `Geçersiz kategori: ${params.category}`);
	}

	const hotelScore = await getHotelScore(venueSlug, '2025-05', token);
	const categoryScore = hotelScore.categoryScores.find((cs) => cs.category === upperKey);
	if (!categoryScore) {
		throw error(404, `Kategori verisi bulunamadı: ${upperKey}`);
	}

	// Mock-only: pull reviews mentioning this category
	const reviews = filterMockReviews({ category: upperKey });

	return { hotelScore, categoryScore, reviews, categoryKey: upperKey };
}
